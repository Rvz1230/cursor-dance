/**
 * 配置控件的共享实现（对应真实代码里的 src/components/ui/*）。
 *
 * 为什么抽出来：这些控件原先只活在 library/controls.html 里「展示」，
 * 四个界面照旧用原生 <input type=range> 和 <select>，还多出一套 mini-select。
 * 控件库不落地到界面就只是画册，重构时这套分叉会被原样复制。
 *
 * 用法：
 *   Ctl.mountSliders(root)                        // 扫描 [data-slider] 自动装配
 *   Ctl.select(el, { options, value, onChange })  // 带预览缩略图的下拉（>8 条自动出搜索框）
 *   Ctl.number(el, { min, max, unit, onChange })  // 可输入的数值框
 *   Ctl.colorField(el, { palette, opacity })      // 色板 + hex + 吸管 + 结果预览
 *   Ctl.keycap(el, { value })                     // 快捷键捕获
 *   Ctl.pad / Ctl.dial / Ctl.curve                // 二维偏移 / 角度 / 自定义缓动
 *   Ctl.bindSwitches / bindChecks / bindRadioCards（就地接管已有标记）
 *
 * 手感约定（四个界面必须一致）：
 *   拖柄 hover 放大 · 拖拽出数值气泡 · 轨道下方三角标默认值 · 双击拖柄回默认
 *   方向键 ±step / Shift ±10step · ⌥ 临时关闭吸附 · 标签可横向 scrub
 *   与默认值不同时在标签后标一个点
 *
 * **这份约定表是契约，不是愿望。** 上一版里「与默认不同时标点」只在
 * library/controls.html 手写了 4 处，共享层里根本没有——于是 01/02/07 的 36 个滑块
 * 一个脏点都没有，而这段注释读起来像是它们都有。承诺写在共享层、实现留在一个页面，
 * 等于这条承诺对其它页面**不存在**。凡是写进这张表的，都必须在本文件里实现。
 */
const Ctl = (() => {

  /* ═══ 数据：唯一真值源 ═══════════════════════════════════════════
     下面几张表是「同一个数在两处分别写」的解药。它们不是常量集合，
     是**别处不许再抄一份**的声明。 */

  /*
    缓动曲线。

    原先这份数据有三份，而且已经打架了：
      · library/controls.html —— `[label, desc, pts]`
      · 04-keyboard.html:2143 —— `[label, pts, desc]`（元组顺序还不一样）
      · 04-keyboard.html:1413 —— `label → CSS 字符串`，其中「弹性」写的是
        `cubic-bezier(0.68,-0.55,0.27,1.55)`
    于是 04 的下拉**缩略图画的曲线**是 `[.22,1,.36,1.18]`，
    **真跑的动画**是另一条完全不同的曲线（先下冲再过冲 55%）。
    README 记的教训是「一个数出来的数和一个画下去的形状由两处代码分别计算，
    就一定会有一天不一致」——它已经不一致了，而且没有任何视觉痕迹提示这件事。

    过冲百分比也不再手写：两处都写「弹性 · 过冲 1.8%」，
    而按 `[.22,1,.36,1.18]` 实算峰值是 1.062（**6.2%**）。
    手写的数字会漂，`overshoot()` 算出来的不会。
  */
  const EASINGS = [
    ['线性', [0, 0, 1, 1]],
    ['缓出', [0, 0, 0.2, 1]],
    ['缓入', [0.4, 0, 1, 1]],
    ['缓入缓出', [0.4, 0, 0.2, 1]],
    ['弹跳', [0.34, 1.56, 0.64, 1]],
    ['弹性', [0.22, 1, 0.36, 1.18]],
  ];
  const EASING_PTS = new Map(EASINGS);

  /** 三次贝塞尔的 y 分量（P0=0、P3=1，只有两个控制点的 y 可调）。 */
  const bezierY = (t, y1, y2) => {
    const u = 1 - t;
    return 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t;
  };
  /**
   * 曲线峰值超过 1 的百分比（无过冲返回 0）。
   *
   * 采样而不是解析求根：导数是二次式，解析解写得出来，但 200 个采样点的误差
   * 上界（约 ±0.02%）已经远高于「过冲 9.8%」这个读数需要的一位小数，
   * 而解析解要处理判别式为负、根落在 [0,1] 外这几种分支——多出来的分支
   * 就是多出来的出错面。
   *
   * 自校验：`[.34,1.56,.64,1] → 9.8`（与原先手写正确的那一条逐位相同），
   * `[.22,1,.36,1.18] → 6.2`（纠正两处手写的 1.8），`[0,0,.2,1] → 0`。
   */
  function overshoot(pts) {
    const [, y1, , y2] = pts;
    let peak = 1;
    for (let i = 0; i <= 200; i += 1) peak = Math.max(peak, bezierY(i / 200, y1, y2));
    return Math.round((peak - 1) * 1000) / 10;
  }
  /* 声明顺序有意如此：`const` 不提升，`easingDesc` 用到 `easingPts`，
     所以 `easingPts` 必须在它上面。README 教训 #7 记的那次 TDZ 异常
     就是这类顺序问题，而症状是「整段脚本一行都不执行」。 */
  const easingPts = (nameOrPts) => (Array.isArray(nameOrPts) ? nameOrPts : EASING_PTS.get(nameOrPts) || null);
  /** 过冲说明文字。空串表示不过冲——调用方直接用，不要自己再判一次。 */
  const easingDesc = (nameOrPts) => {
    const pts = easingPts(nameOrPts);
    if (!pts) return '';
    const o = overshoot(pts);
    return o > 0 ? `过冲 ${o.toFixed(1)}%` : '';
  };
  /** 真跑动画用的 timing function。**与缩略图读同一份 pts**，这是上面那条缺陷的解。 */
  const cssEasing = (nameOrPts) => {
    const pts = easingPts(nameOrPts);
    return pts ? `cubic-bezier(${pts.map((p) => Number(p.toFixed(3))).join(', ')})` : 'ease-out';
  };
  /** 下拉选项：缩略图、说明、pts 三样都从同一行来。 */
  const easingOptions = () => EASINGS.map(([label, pts]) => ({
    label, pts, desc: easingDesc(pts), thumb: curveThumb(pts),
  }));

  /*
    字体。原先 library 的 `FONTS` 与 04-keyboard 的 `FAMILIES` 是同一份数据的两份拷贝。

    条数从 4 扩到 13 并分组，理由不是「更全」：`Ctl.select` 的搜索框按
    「超过 8 条」触发，而稿子里最长的下拉只有 4 条——**那道分支从来没有在页面上出现过**，
    于是「选项超过 8 条时顶部自动出现搜索框」这句说明既无法验证、也确实没实现。
    真实产品的字体列表必然超过 8 条，所以让它在这里就超过。
  */
  const FONTS = [
    ['系统默认', 'system-ui, -apple-system, sans-serif', '无衬线'],
    ['SF Pro Text', '"SF Pro Text", system-ui, sans-serif', '无衬线'],
    ['Helvetica Neue', '"Helvetica Neue", Helvetica, Arial, sans-serif', '无衬线'],
    ['Inter', 'Inter, system-ui, sans-serif', '无衬线'],
    ['苹方', '"PingFang SC", system-ui, sans-serif', '无衬线'],
    ['微软雅黑', '"Microsoft YaHei", system-ui, sans-serif', '无衬线'],
    ['SF Pro Rounded', '"SF Pro Rounded", system-ui, sans-serif', '圆体'],
    ['Quicksand', 'Quicksand, system-ui, sans-serif', '圆体'],
    ['SF Mono', '"SF Mono", Menlo, monospace', '等宽'],
    ['Menlo', 'Menlo, Consolas, monospace', '等宽'],
    ['JetBrains Mono', '"JetBrains Mono", Menlo, monospace', '等宽'],
    ['Georgia', 'Georgia, "Times New Roman", serif', '衬线'],
    ['宋体', '"Songti SC", Georgia, serif', '衬线'],
  ];
  const fontStack = (label) => (FONTS.find((f) => f[0] === label) || FONTS[0])[1];
  /** 下拉选项：右侧样张用该字体自己渲染，所以「选项长成结果的样子」。 */
  const fontOptions = () => FONTS.map(([label, stack, group]) => ({
    label, group, side: `<span style="font-family:${stack}">Nice! 123</span>`,
  }));

  /**
   * 用户内容色板。
   *
   * **不受外壳调色板约束**（DESIGN.md 色彩节第 3 类 · 裁决 11）：
   * 这是用户给自己的效果挑的颜色，不是界面语义色，所以 violet 出现在这里是对的。
   * 取自 01-workbench 那一份（它的注释已经论证过），补 white——
   * 白色粒子在深色桌面上是常见需求，而 01 那份没有它。
   */
  const CONTENT_PALETTE = ['#F59E0B', '#0EA5E9', '#0D9488', '#F43F5E', '#8B5CF6', '#FFFFFF', '#0F172A'];

  /**
   * 效果类型的分类色（裁决 11）。
   *
   * 搬到这里的理由写在 `05-diagnostics.html` 自己的注释里：
   * 「稿子里两份表是复制关系（两个独立页面、**没有模块系统**）；
   * 实现时必须提成一个共享常量——复制的两份表一定会有一天不一致。」
   * 那个前提已经不成立了：`controls.js` 被 8 个页面加载，就是模块系统。
   * 而两份表**形状已经不同**（01 是 `{name,dot,bar,chip}` 对象、05 是裸 chip 字符串），
   * 05 那份还少了 `触发` 与 `光标反馈` 两条——不一致已经开始了，只是还没体现成颜色差异。
   *
   * 更糟的是门禁那边：`off-palette-color` 的豁免按表**名** `CH_TONE` 放行区块，
   * 所以第二张表照旧通过——「唯一映射源」这个前提从来没有被执行过。
   * 本轮补 `category-tone-table-duplicated` 把它锁上。
   *
   * 裁决 11 要求三处共用：时间轴通道块、01 的「本次输出」chip、05 的事件流。
   * 色值取自 `src/components/ui/theme-identity.ts` 的封闭集合
   * （allowlist 里已登记「主题要能一眼分辨，属内容色」），只是从主题身份扩到效果类型。
   */
  const CH_TONE = {
    trigger:  { name: '触发',     dot: 'bg-slate-400',   bar: 'border-slate-400 bg-slate-50',    chip: 'bg-slate-100 text-slate-600' },
    text:     { name: '飘字',     dot: 'bg-amber-500',   bar: 'border-amber-400 bg-amber-50',    chip: 'bg-amber-50 text-amber-700' },
    particle: { name: '粒子',     dot: 'bg-sky-500',     bar: 'border-sky-400 bg-sky-50',        chip: 'bg-sky-50 text-sky-700' },
    ripple:   { name: '波纹',     dot: 'bg-teal-500',    bar: 'border-teal-400 bg-teal-50',      chip: 'bg-teal-50 text-teal-700' },
    audio:    { name: '音效',     dot: 'bg-rose-500',    bar: 'border-rose-400 bg-rose-50',      chip: 'bg-rose-50 text-rose-700' },
    animation:{ name: '动画',     dot: 'bg-indigo-500',  bar: 'border-indigo-400 bg-indigo-50',  chip: 'bg-indigo-50 text-indigo-700' },
    image:    { name: '贴纸',     dot: 'bg-orange-500',  bar: 'border-orange-400 bg-orange-50',  chip: 'bg-orange-50 text-orange-700' },
    cursor:   { name: '光标反馈', dot: 'bg-slate-500',   bar: 'border-slate-400 bg-slate-50',    chip: 'bg-slate-100 text-slate-600' },
  };
  /** 按 key 取（01 的通道、卡片都用 key）。取不到回落到触发，不返回 undefined。 */
  const toneOf = (key) => CH_TONE[key] || CH_TONE.trigger;
  /** 按中文名取（05 的事件流 payload 里是中文名，它没有 key）。 */
  const toneByName = (name) => Object.values(CH_TONE).find((t) => t.name === name) || CH_TONE.trigger;

  // ── 滑块 ────────────────────────────────────────────────
  function slider(el, opt = {}) {
    const cfg = {
      min: num(el.dataset.min, opt.min ?? 0),
      max: num(el.dataset.max, opt.max ?? 100),
      step: num(el.dataset.step, opt.step ?? 1),
      value: num(el.dataset.value, opt.value ?? 0),
      value2: el.dataset.value2 !== undefined ? Number(el.dataset.value2) : opt.value2,
      def: num(el.dataset.default, opt.def ?? num(el.dataset.value, opt.value ?? 0)),
      def2: el.dataset.default2 !== undefined ? Number(el.dataset.default2) : opt.def2,
      dual: el.dataset.dual === '1' || !!opt.dual,
      bipolar: el.dataset.bipolar === '1' || !!opt.bipolar,
      disabled: el.dataset.disabled === '1' || !!opt.disabled,
      snap: el.dataset.snap === '1' || !!opt.snap,
      ticks: (el.dataset.ticks || opt.ticks || '').toString().split(',').filter(Boolean).map(Number),
      format: opt.format || ((v, v2) => (v2 !== undefined ? `${v}–${v2}` : String(v))),
      onChange: opt.onChange || (() => {}),
      onCommit: opt.onCommit || (() => {}),
    };

    /*
      可访问名：`role="slider"` 少了名字就是「一个滑块」。

      真实代码里名字是显式传的（`control-slider.tsx:59` 的 `aria-label={label}`），
      稿子里 36 个滑块的标签**已经写在标记里**了，只是位置有三种形态，所以在这里推导
      而不是逐个补 36 个 `aria-label`——手抄 36 次必然抄错几个，而且下次新增滑块又会漏。
      推导不到名字时**留痕**（`data-noname` + console.warn），由浏览器探针数出来，
      不是静默降级成无名滑块。
    */
    const name = resolveLabel(el, opt);
    if (!name) {
      el.setAttribute('data-noname', '1');
      console.warn('[Ctl.slider] 推导不到可访问名，请补 data-label：', el.id || el);
    }
    const nameOf = (t) => (!name ? null : cfg.dual ? `${name}${t === '1' ? ' 下限' : ' 上限'}` : name);

    el.classList.add('sl');
    const thumb = (t) => `<span class="sl-thumb" data-t="${t}" tabindex="${cfg.disabled ? -1 : 0}"`
      + ` role="slider" aria-valuemin="${cfg.min}" aria-valuemax="${cfg.max}"`
      + (nameOf(t) ? ` aria-label="${nameOf(t)}"` : '')
      + (cfg.disabled ? ' aria-disabled="true"' : '')
      + '></span>';
    el.innerHTML = '<div class="sl-track"></div><div class="sl-fill"></div>'
      + cfg.ticks.map(() => '<span class="sl-tick"></span>').join('')
      + '<span class="sl-default"></span>'
      + thumb('1')
      + (cfg.dual ? thumb('2') : '')
      + '<span class="sl-bubble" hidden></span>';
    if (cfg.disabled) el.classList.add('sl-disabled');

    const norm = (v) => ((v - cfg.min) / (cfg.max - cfg.min)) * 100;
    const fill = el.querySelector('.sl-fill');
    const t1 = el.querySelector('[data-t="1"]');
    const t2 = el.querySelector('[data-t="2"]');
    const bubble = el.querySelector('.sl-bubble');
    const dirtyEl = resolveDirty(el);

    // 防重入：消费者在 onChange 里回调 set()（把值同步进自己的 readout / 预览）是
    // 很自然的写法，但那样 set → paint → onChange → set 会无限递归直到爆栈。
    // 渲染每次都做（视觉状态必须始终正确），只有**最外层**那次才通知。
    let notifying = false;

    function paint(showBubble) {
      // 不变量收在这里：键盘、scrub、程序化赋值都会经过 paint
      cfg.value = clamp(cfg.value, cfg.min, cfg.max);
      if (cfg.dual) {
        cfg.value2 = clamp(cfg.value2, cfg.min, cfg.max);
        if (cfg.value > cfg.value2) [cfg.value, cfg.value2] = [cfg.value2, cfg.value];
      }
      if (cfg.dual) {
        fill.style.left = norm(cfg.value) + '%';
        fill.style.width = (norm(cfg.value2) - norm(cfg.value)) + '%';
        t1.style.left = norm(cfg.value) + '%';
        t2.style.left = norm(cfg.value2) + '%';
      } else if (cfg.bipolar) {
        const zero = norm(0), cur = norm(cfg.value);
        fill.style.left = Math.min(zero, cur) + '%';
        fill.style.width = Math.abs(cur - zero) + '%';
        t1.style.left = cur + '%';
      } else {
        fill.style.left = '0%';
        fill.style.width = norm(cfg.value) + '%';
        t1.style.left = norm(cfg.value) + '%';
      }
      el.querySelectorAll('.sl-tick').forEach((n, i) => { n.style.left = norm(cfg.ticks[i]) + '%'; });
      el.querySelector('.sl-default').style.left = norm(cfg.def) + '%';
      // 脏点：判据与页面原先手写的那份一致（值 !== 默认值），双拖柄两个值都比
      if (dirtyEl) {
        dirtyEl.hidden = cfg.value === cfg.def && (!cfg.dual || cfg.value2 === cfg.def2);
      }
      t1.setAttribute('aria-valuenow', String(cfg.value));
      t1.setAttribute('aria-valuetext', cfg.format(cfg.value, cfg.value2));
      // 双拖柄时第二个拖柄原先完全没有 aria-valuenow：它自己是一个 role="slider"，
      // 读屏在它上面报的是「滑块，无值」——而它恰恰是「上限」那一头。
      if (t2) {
        t2.setAttribute('aria-valuenow', String(cfg.value2));
        t2.setAttribute('aria-valuetext', cfg.format(cfg.value, cfg.value2));
      }
      if (showBubble) {
        bubble.hidden = false;
        bubble.textContent = cfg.format(cfg.value, cfg.value2);
        bubble.style.left = (cfg.dual ? norm(cfg.value2) : norm(cfg.value)) + '%';
      }
      if (notifying) return;
      notifying = true;
      try {
        cfg.onChange(cfg.value, cfg.value2);
      } finally {
        notifying = false;
      }
    }

    const pctOf = (e) => {
      const r = el.getBoundingClientRect();
      return clamp((e.clientX - r.left) / r.width, 0, 1);
    };
    const quantize = (raw, alt) => {
      let v = cfg.min + raw * (cfg.max - cfg.min);
      v = Math.round(v / cfg.step) * cfg.step;
      if (cfg.snap && !alt) {
        const near = cfg.ticks.find((tk) => Math.abs(tk - v) <= (cfg.max - cfg.min) * 0.03);
        if (near !== undefined) v = near;
      }
      return clamp(v, cfg.min, cfg.max);
    };

    let active = null;
    el.addEventListener('pointerdown', (e) => {
      if (cfg.disabled) return;
      const p = pctOf(e);
      if (cfg.dual) {
        const p1 = (cfg.value - cfg.min) / (cfg.max - cfg.min);
        const p2 = (cfg.value2 - cfg.min) / (cfg.max - cfg.min);
        active = Math.abs(p - p1) <= Math.abs(p - p2) ? 1 : 2;
      } else active = 1;
      el.querySelector(`[data-t="${active}"]`).classList.add('sl-thumb-active');
      el.setPointerCapture(e.pointerId);
      move(e);
    });
    const move = (e) => {
      if (active === null) return;
      const v = quantize(pctOf(e), e.altKey);
      if (active === 1) cfg.value = cfg.dual ? Math.min(v, cfg.value2) : v;
      else cfg.value2 = Math.max(v, cfg.value);
      paint(true);
    };
    el.addEventListener('pointermove', move);
    const end = () => {
      if (active === null) return;
      el.querySelectorAll('.sl-thumb').forEach((n) => n.classList.remove('sl-thumb-active'));
      bubble.hidden = true;
      active = null;
      cfg.onCommit(cfg.value, cfg.value2);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    el.querySelectorAll('.sl-thumb').forEach((th) => {
      th.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        cfg.value = cfg.def;
        if (cfg.def2 !== undefined) cfg.value2 = cfg.def2;
        paint(); cfg.onCommit(cfg.value, cfg.value2);
      });
      th.addEventListener('keydown', (e) => {
        const dir = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
        if (!dir) return;
        e.preventDefault();
        const d = dir * cfg.step * (e.shiftKey ? 10 : 1);
        if (th.dataset.t === '1') cfg.value += d; else cfg.value2 += d;
        paint(); cfg.onCommit(cfg.value, cfg.value2);
      });
    });

    // 标签横向 scrub：<span data-scrub="#id">
    const scrubEl = el.id ? document.querySelector(`[data-scrub="${el.id}"]`) : null;
    if (scrubEl && !cfg.disabled) {
      scrubEl.classList.add('ctl-label-scrub');
      scrubEl.addEventListener('pointerdown', (e) => {
        scrubEl.setPointerCapture(e.pointerId);
        const x0 = e.clientX, v0 = cfg.value;
        const mv = (ev) => { cfg.value = v0 + Math.round(((ev.clientX - x0) / 2) * cfg.step); paint(true); };
        const up = () => {
          scrubEl.removeEventListener('pointermove', mv);
          scrubEl.removeEventListener('pointerup', up);
          bubble.hidden = true;
          cfg.onCommit(cfg.value, cfg.value2);
        };
        scrubEl.addEventListener('pointermove', mv);
        scrubEl.addEventListener('pointerup', up);
      });
    }

    paint();
    const api = {
      get: () => (cfg.dual ? [cfg.value, cfg.value2] : cfg.value),
      set: (v, v2) => { cfg.value = v; if (v2 !== undefined) cfg.value2 = v2; paint(); },
      setDisabled: (v) => {
        cfg.disabled = v;
        el.classList.toggle('sl-disabled', v);
        // 视觉变灰而 aria 不变的话，读屏用户拿到的是一个「可用但改不动」的滑块
        el.querySelectorAll('.sl-thumb').forEach((th) => {
          if (v) th.setAttribute('aria-disabled', 'true'); else th.removeAttribute('aria-disabled');
          th.tabIndex = v ? -1 : 0;
        });
      },
    };
    el._ctl = api;
    return api;
  }

  /**
   * 解析控件的可访问名。
   *
   * 稿子里标签有三种摆法，都已经写在标记里了：
   *   1. `.ctl-row` 里的 `.ctl-label` / `.field-label`（01 / 07 / library）
   *   2. 滑块上方 `justify-between` 那一行的第一个 span（02 / 04）
   *   3. `[data-scrub="<滑块 id>"]`——scrub 标签本来就是这个滑块的标签
   * 所以名字在这里推导，而不是逐个补 36 个 `aria-label`：手抄 36 次会漏，
   * 而且下次新增滑块还会再漏一次。显式 `data-label` 优先级最高，用于推导不到的场合。
   *
   * 读数要剔掉：`.ctl-value` / `[data-out]` 里是**值**，把它拼进名字会让读屏念成
   * 「界面缩放 100 滑块 100」。
   */
  function resolveLabel(el, opt = {}) {
    if (opt.label) return opt.label;
    if (el.dataset.label) return el.dataset.label;
    const clean = (node) => {
      if (!node) return '';
      const copy = node.cloneNode(true);
      copy.querySelectorAll('[data-out], .ctl-value, .sr-only').forEach((n) => n.remove());
      return copy.textContent.replace(/\s+/g, ' ').trim();
    };
    const scrub = el.id ? document.querySelector(`[data-scrub="${el.id}"]`) : null;
    if (scrub) return clean(scrub);
    const row = el.closest('.ctl-row, .ctl-row-wide, [data-knobrow], [data-fieldrow]');
    const rowLabel = row && row.querySelector('.ctl-label, .field-label');
    if (rowLabel) return clean(rowLabel);
    const prev = el.previousElementSibling;
    if (prev) {
      const head = prev.matches('span') ? prev : prev.querySelector('span');
      const text = clean(head);
      if (text) return text;
    }
    return '';
  }

  /**
   * 解析读数元素。
   *
   * 稿子里三处 markup 用的都是「读数 span 上写 data-out="<滑块元素 id>"」
   * （01-workbench、07-settings、library/controls.html），而 mountSliders 原先把
   * data-out 当成写在**滑块**上的 CSS 选择器——于是全稿没有一个 data-out 能被它解析到。
   *
   * 后果专挑唯一信任共享层的那一页：07 的两个滑块读数是死的。而它的方向键 ±1、
   * ⇧ ±10、标签 scrub、双击回默认全都正常工作，值确实走到了 133，只有读数停在 100，
   * 所以症状看起来只像「数字忘了动」，而不像「共享层的约定错了」。
   * 01 / 04 / 02 / library 因为各自手写了一遍 onChange 绕开了这个坑，
   * 反而让这个 bug 一直藏在唯一的正确用法里——**共享层最没人验证的路径就是它自己的默认路径。**
   *
   * 现在以 markup 的约定为准，同时保留滑块上写显式选择器的写法（以 # . [ 开头）。
   */
  function resolveReadout(el) {
    const key = el.dataset.out;
    if (key) {
      return /^[#.[]/.test(key) ? document.querySelector(key) : document.querySelector(`[data-out="${key}"]`);
    }
    return el.id ? document.querySelector(`[data-out="${el.id}"]`) : null;
  }

  /**
   * 解析（必要时创建）「与默认不同」的脏点。
   *
   * 这条手感约定写在本文件头部当作四个界面的契约，但上一版只在
   * library/controls.html 手写了 4 处 `.ctl-dirty`——**共享层里一行都没有**。
   * 所以现在由共享层负责：标记里已经有 `.ctl-dirty` 就用它，没有就**补一个**，
   * 否则 01/02/07 的滑块永远拿不到这个点，而契约表读起来像是它们都有。
   *
   * 锚点与可访问名同源（见 resolveLabel），三种摆法都覆盖。
   *
   * `data-dirty="off"` 是**显式退出**，给已经有等价指示的页面用：
   * 01-workbench 的 `srcDot()` 已经用来源色点表达了「自定义 = 偏离预设」，
   * 再叠一个灰点就是同一件事的两份真值。退出用显式属性而不是靠这里嗅探
   * 页面结构——嗅探会在页面改结构那天静默失效，而失效表现为「点没了」，
   * 没有任何痕迹。
   */
  function resolveDirty(el) {
    const key = el.dataset.dirty;
    if (key === 'off') return null;
    if (key) {
      return /^[#.[]/.test(key) ? document.querySelector(key) : document.querySelector(`[data-dirty="${key}"]`);
    }
    const byId = el.id ? document.querySelector(`[data-dirty="${el.id}"]`) : null;
    if (byId) return byId;
    const anchor = (el.id && document.querySelector(`[data-scrub="${el.id}"]`))
      || (() => {
        const row = el.closest('.ctl-row, .ctl-row-wide, [data-knobrow], [data-fieldrow]');
        return row && row.querySelector('.ctl-label, .field-label');
      })();
    if (!anchor) return null;
    const existing = anchor.querySelector('.ctl-dirty');
    if (existing) return existing;
    const dot = document.createElement('span');
    dot.className = 'ctl-dirty';
    dot.title = '已改动（与默认值不同）';
    dot.hidden = true;
    anchor.appendChild(dot);
    return dot;
  }

  function mountSliders(root = document) {
    return [...root.querySelectorAll('[data-slider]:not([data-mounted])')].map((el) => {
      el.setAttribute('data-mounted', '1');
      const out = resolveReadout(el);
      const fmt = FORMATS[el.dataset.format] || undefined;
      return slider(el, {
        format: fmt,
        onChange: (v, v2) => { if (out) out.textContent = (fmt || ((a, b) => (b !== undefined ? `${a}–${b}` : a)))(v, v2); },
      });
    });
  }
  const FORMATS = {
    tenth: (v) => (v / 10).toFixed(1),
    range: (v, v2) => `${v}–${v2}`,
  };

  // ── 下拉（带预览缩略图的选项） ──────────────────────────
  let selSeq = 0;
  /**
   * 带预览的下拉。
   *
   * 稿子里对这个控件写过三句说明，而上一版**一句都没实现**——
   * 「选项超过 8 条时顶部自动出现搜索框」「分组用分隔线 + 组标题」「↵ 确认」。
   * 前两句因为全稿最长的下拉只有 4 条而无法验证；第三句更糟：
   * `↑↓` 当时是**直接改值**的，与「↵ 确认」在语义上正相反——
   * 说明描述的是一个高亮/确认两段式模型，代码里根本没有「高亮」这个状态。
   *
   * 现在 `hi`（高亮下标）与 `value`（已选值）是两个独立状态，
   * `↑↓`/Home/End 只动 `hi`，`↵` 才把 `hi` 提交成 `value`，`esc` 原样退出。
   */
  function select(el, opt) {
    const { options, onChange } = opt;
    let value = opt.value ?? options[0].label;
    const uid = `sel${(selSeq += 1)}`;
    // 8 是判据而不是口味：再多一条，扫一遍列表就比打两个字慢了。
    const searchable = opt.search ?? (options.length > 8);
    /*
      触发器里 data-label（当前值）和 data-side（样张，比如字体下拉里那句用该字体渲染的
      「Nice! 123」）的收缩优先级原先是反的：label 是 min-w-0 flex-1 truncate、
      side 是 shrink-0。于是**装饰性的样张挤掉了必读的值**——
      实测 04 右栏 300px 档下字体下拉只有 129px，样张吃满 45px，
      「系统默认」需要 49px 却被压到 36px，显示成「系…」：你看不出选的是哪个字体。

      现在 label 不参与收缩、side 先让位并省略。样张是锦上添花，值是这个控件的全部意义。
      trigger 补 overflow-hidden 兜底：万一某天有个特别长的 label，宁可裁掉也不撑破布局。

      注释写在模板字符串**外面**：里面用 HTML 注释的话，正文里的反引号会当场
      终止模板字符串——这正是 check:ui-spec 的 shared-js-syntax 规则记录的那次事故，
      而这次它当场把我拦下来了。
    */
    el.innerHTML = `
      <button type="button" class="flex h-8 w-full items-center gap-2 overflow-hidden rounded-xl border border-slate-200 bg-white px-2 text-left shadow-sm transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" data-trigger aria-haspopup="listbox" aria-expanded="false" aria-controls="${uid}-list">
        <span data-thumb class="opt-thumb size-6 shrink-0"></span>
        <span data-label class="shrink-0 whitespace-nowrap text-xs text-slate-700"></span>
        <span data-side class="ml-auto min-w-0 truncate text-right text-xs text-slate-500"></span>
        <svg class="size-3.5 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div data-panel class="fixed z-50 hidden flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg">
        ${searchable ? `<label class="opt-search">
          <svg class="size-3.5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input data-search type="text" placeholder="筛选…" autocomplete="off" aria-label="筛选选项" aria-controls="${uid}-list" />
        </label>` : ''}
        <div data-list id="${uid}-list" role="listbox" tabindex="-1" class="min-h-0 flex-1 overflow-y-auto focus:outline-none"></div>
        <p data-empty class="opt-empty" hidden>没有匹配的选项</p>
      </div>`;

    const trigger = el.querySelector('[data-trigger]');
    const panel = el.querySelector('[data-panel]');
    const list = el.querySelector('[data-list]');
    const search = el.querySelector('[data-search]');
    const emptyEl = el.querySelector('[data-empty]');
    const thumbBox = el.querySelector('[data-thumb]');
    // 触发器里只有当前值，没有「这是什么」——名字与滑块同源推导（见 resolveLabel）
    const selName = resolveLabel(el, opt);
    if (selName) {
      trigger.setAttribute('aria-label', selName);
      list.setAttribute('aria-label', selName);
    }

    /* `visible` 是过滤后的选项，`hi` 是**高亮**下标——它与 `value` 是两个状态。
       合成一个的话「↑↓ 移动、↵ 确认、esc 原样退出」这三句里的后两句都无处落地：
       没有高亮，↵ 就没有东西可确认；没有未提交态，esc 也没有东西可放弃。 */
    let visible = options.slice();
    let hi = 0;

    function cur() { return options.find((o) => o.label === value) || options[0]; }
    function paint() {
      const o = cur();
      el.querySelector('[data-label]').textContent = o.label;
      el.querySelector('[data-side]').innerHTML = o.side || '';
      thumbBox.innerHTML = o.thumb || '';
      thumbBox.classList.toggle('hidden', !o.thumb);
    }
    /** 搜索命中范围含组名：想找等宽字体的人会直接打「等宽」，而那不是任何一条的 label。 */
    const hit = (o, q) => [o.label, o.desc, o.group].some((s) => s && String(s).toLowerCase().includes(q));
    function rebuild() {
      const q = (search ? search.value : '').trim().toLowerCase();
      visible = q ? options.filter((o) => hit(o, q)) : options.slice();
      let group = null;
      list.innerHTML = visible.map((o, i) => {
        const head = o.group && o.group !== group
          ? `<div class="opt-group${group === null ? '' : ' opt-group-sep'}" role="presentation">${o.group}</div>`
          : '';
        group = o.group || group;
        return head + `
        <button type="button" role="option" id="${uid}-o${i}" aria-selected="${o.label === value}" data-opt="${o.label}" data-i="${i}" class="opt-row${o.label === value ? ' opt-row-on' : ''}">
          ${o.thumb ? `<span class="opt-thumb">${o.thumb}</span>` : ''}
          <span class="min-w-0 flex-1"><span class="opt-name">${o.label}</span>${o.desc ? `<span class="opt-desc">${o.desc}</span>` : ''}</span>
          ${o.side ? `<span class="shrink-0 text-xs text-slate-500">${o.side}</span>` : ''}
          ${o.label === value ? '<svg class="size-3.5 shrink-0 text-slate-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>' : ''}
        </button>`;
      }).join('');
      emptyEl.hidden = visible.length > 0;
      list.querySelectorAll('[data-opt]').forEach((b) => {
        b.addEventListener('click', () => commit(visible[Number(b.dataset.i)]));
        // 指针移动同步高亮：否则鼠标停在 A 上、↵ 却提交了 B——两套指示互相说谎
        b.addEventListener('pointerenter', () => { hi = Number(b.dataset.i); paintHi(); });
      });
      hi = clamp(hi, 0, Math.max(0, visible.length - 1));
      paintHi();
    }
    /** 高亮的可访问投影是 `aria-activedescendant`，挂在**当前有焦点的那个元素**上。 */
    function paintHi() {
      const rows = list.querySelectorAll('.opt-row');
      rows.forEach((r, i) => r.classList.toggle('opt-row-hi', i === hi));
      const host = search || list;
      const active = rows[hi];
      if (active) {
        host.setAttribute('aria-activedescendant', active.id);
        active.scrollIntoView({ block: 'nearest' });
      } else host.removeAttribute('aria-activedescendant');
    }
    function commit(o) {
      if (!o) return;
      value = o.label;
      paint(); close(); trigger.focus();
      onChange?.(value, cur());
    }
    /**
     * 弹层挂到 body 上、用 fixed 定位，而不是留在 el 里用 absolute。
     *
     * **`z-index` 解决不了祖先的 `overflow: hidden`。** 原先弹层是
     * `absolute top-9 z-30`，而效果卡 `.cfg-card` 有 `overflow-hidden`（圆角裁切要用），
     * 于是弹层被祖先直接裁掉——实测「触发区域」下拉展开后**98px 高的弹层有 89px 不可见**，
     * 而 z-index 是 30、层叠顺序完全正确。z-index 越调越没用，因为问题不在层叠。
     *
     * 脱离那个祖先是唯一的解（真实实现里就是 Radix 的 Portal）。代价是位置要自己算，
     * 于是顺带把两件本来就该有的事做了：
     *   · 下方空间不足时**向上翻转**（原先 `top-9` 写死，靠底部的下拉永远朝下捅出去）
     *   · 宽度跟随触发器，但给一个最小宽度——选项里有说明文字，太窄会把它们挤成两行
     * 打开时定位一次；滚动或改窗口尺寸就关掉，不做跟随重定位——
     * 一个跟着滚动飘的浮层比直接关掉更难用。
     */
    /*
      边界是**模拟窗口**而不是浏览器视口（存在 #mockWindow 时）。
      在稿子里这两者差着几百像素：960px 的模拟窗口居中放在 1280px 的浏览器窗格里，
      于是靠右的下拉「夹进视口」之后照旧越过模拟窗口右边缘——而真实应用里
      窗口就是视口，那里根本没有这块多出来的空间。这与 README 记的 22 处视口断点
      是同一族错误：**稿子里的「视口」不是产品里的窗口。**
      07/08/09 不套外壳、没有 #mockWindow，自动退回视口。
    */
    const place = () => {
      const t = trigger.getBoundingClientRect();
      const gap = 6;
      const boundsEl = document.getElementById('mockWindow');
      const b = boundsEl
        ? boundsEl.getBoundingClientRect()
        : { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight };
      const w = Math.max(t.width, 220);
      panel.style.width = `${w}px`;
      panel.style.left = `${Math.max(b.left + 8, Math.min(t.left, b.right - w - 8))}px`;
      // 先量真实高度再决定朝向：选项数量不同，高度不是常量
      panel.style.top = '0px';
      panel.style.maxHeight = '';
      panel.style.visibility = 'hidden';
      const h = panel.getBoundingClientRect().height;
      const below = b.bottom - t.bottom - gap;
      const flipUp = below < h && t.top - gap - b.top > below;
      panel.style.top = flipUp ? `${Math.max(b.top + 8, t.top - gap - h)}px` : `${t.bottom + gap}px`;
      panel.style.maxHeight = `${Math.max(120, (flipUp ? t.top - b.top : b.bottom - t.bottom) - gap - 8)}px`;
      panel.style.visibility = '';
    };
    const isOpen = () => !panel.classList.contains('hidden');
    let closeOnScroll = null;
    const open = () => {
      // 关别人的弹层时必须连它的 aria-expanded 一起改：只 add('hidden') 的话，
      // 上一个下拉会永远停在 aria-expanded="true"——读屏读到的是「两个下拉同时展开」。
      document.querySelectorAll('[data-panel]').forEach((p) => p.classList.add('hidden'));
      document.querySelectorAll('[data-trigger][aria-expanded="true"]')
        .forEach((t) => t.setAttribute('aria-expanded', 'false'));
      if (search) search.value = '';
      if (panel.parentElement !== document.body) document.body.appendChild(panel);
      panel.classList.remove('hidden');
      panel.classList.add('flex');
      trigger.setAttribute('aria-expanded', 'true');
      // 打开时高亮落在已选那条上，而不是第一条：↑↓ 的起点应该是「我现在在哪」
      hi = Math.max(0, options.findIndex((o) => o.label === value));
      rebuild();
      place();
      // 有搜索框就把焦点交给它（打开即可打字），否则焦点进 listbox 本身
      (search || list).focus({ preventScroll: true });
      /* 捕获期监听 scroll 是为了「页面滚了就关掉」（浮层只定位一次，跟着滚会飘）。
         但它会连**列表自己的滚动**一起收到——而列表一旦超过 8 条就是可滚的，
         `paintHi()` 里的 `scrollIntoView` 正是在滚它。漏掉这个判断的后果是
         ↑↓ 移动高亮移到需要滚动的那一条时下拉自己关掉，
         而这只在「列表装不下」的窗口档位下才出现。
         （这条是推断出来的：自动化环境里 scroll 事件根本没被派发，
         实测两档下都没重现，所以我没能观察到它发生——但排除它是无条件正确的。） */
      // resize 的 target 是 window（不是 Node），contains() 收非 Node 会抛，所以先判类型
      closeOnScroll = (e) => { if (!(e.target instanceof Node) || !panel.contains(e.target)) close(); };
      window.addEventListener('scroll', closeOnScroll, true);
      window.addEventListener('resize', closeOnScroll);
    };
    const close = () => {
      // 焦点在弹层里时必须先收回触发器：弹层一藏，焦点就落到 body 上，
      // 键盘用户从此「不知道自己在哪」，Tab 得从页头重新走一遍
      if (panel.contains(document.activeElement)) trigger.focus({ preventScroll: true });
      panel.classList.add('hidden');
      panel.classList.remove('flex');
      trigger.setAttribute('aria-expanded', 'false');
      if (closeOnScroll) {
        window.removeEventListener('scroll', closeOnScroll, true);
        window.removeEventListener('resize', closeOnScroll);
        closeOnScroll = null;
      }
    };
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      isOpen() ? close() : open();
    });
    // 弹层已经挂到 body 上，所以「点外面关闭」必须同时排除 panel——
    // 只判 el.contains 的话，点选项会先被判成点了外面而关闭，选择永远选不上。
    // 这是 portal 化必须连带改的地方，漏了就表现成「下拉能开但选不中」。
    document.addEventListener('click', (e) => {
      if (el.contains(e.target) || panel.contains(e.target)) return;
      close();
    });
    /* 一份键盘处理，挂在三处（触发器 / 搜索框 / listbox）——焦点可能在任意一个上，
       而按键语义完全相同。分三份写就是三份会分别漂移的实现。 */
    const onKey = (e) => {
      if (e.key === 'Escape') { if (isOpen()) { e.preventDefault(); close(); } return; }
      if (e.key === 'Tab') { if (isOpen()) close(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen()) { open(); return; }
        hi = clamp(hi + (e.key === 'ArrowDown' ? 1 : -1), 0, visible.length - 1);
        paintHi();
        return;
      }
      if ((e.key === 'Home' || e.key === 'End') && isOpen()) {
        e.preventDefault();
        hi = e.key === 'Home' ? 0 : visible.length - 1;
        paintHi();
        return;
      }
      // 空格在搜索框里必须是空格。只判 key 的话，打「SF Pro」第三个键就把下拉提交了。
      const confirmKey = e.key === 'Enter' || (e.key === ' ' && e.target !== search);
      if (confirmKey && isOpen()) { e.preventDefault(); commit(visible[hi]); }
    };
    [trigger, list, search].forEach((n) => n && n.addEventListener('keydown', onKey));
    if (search) {
      search.addEventListener('input', () => {
        hi = 0;
        rebuild();
        place();   // 条数变了高度就变了，朝向和翻转都要重算
      });
    }
    paint();
    /* `set()` **不触发 onChange**（与改造前一致）。程序化赋值的调用方基本都在
       另一个控件的 onChange 里（缓动下拉 ↔ 曲线编辑器就是互相 set），
       通知回去等于两个控件循环唤醒对方。滑块那边用防重入标志挡住了同样的形状，
       这里用「set 不通知」这条更简单的约定挡住。 */
    const api = { get: () => value, set: (v) => { value = v; paint(); } };
    el._ctl = api;
    return api;
  }

  // ── 可输入的数值框 ─────────────────────────────────────
  function number(el, opt = {}) {
    const min = opt.min ?? 0, max = opt.max ?? 100, unit = opt.unit || '';
    el.classList.add('group', 'relative');
    /*
      外观走 `_src.css` 的 `.num-field` / `.num-unit` / `.num-step`，不在模板里写整串
      Tailwind。原因不是嫌长：**写死在 JS 模板里的样式没有地方加深色分支**。
      实测 library/components.html 在深色下这个框是一块白底，而旁边的滑块
      （同样把 slate-900 写死在类里）整段消失——同一个根因的两种表现。
    */
    el.innerHTML = `
      <input data-input class="num-field" value="${opt.value ?? min}" />
      ${unit ? `<span class="num-unit">${unit}</span>` : ''}
      <span class="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button type="button" data-up class="num-step" aria-label="增加">
          <svg class="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m6 15 6-6 6 6"/></svg>
        </button>
        <button type="button" data-down class="num-step" aria-label="减少">
          <svg class="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m6 9 6 6 6-6"/></svg>
        </button>
      </span>`;
    const input = el.querySelector('[data-input]');
    const numName = resolveLabel(el, opt);
    if (numName) input.setAttribute('aria-label', numName);
    // 上一次成功提交的值。空串 / 非数字要回退到它，而**不能**静默变成 min。
    let committed = clamp(Number(opt.value ?? min), min, max);
    /**
     * 提交语义（与真实代码 `resolveNumberCommit` 对齐，README「第 1 批 A」记过）：
     *   · 提交时机是 `change`（失焦或 Enter），**不是**每次按键——
     *     每次按键就 clamp 的话，`min=12` 时想输「50」根本输不进去：
     *     按下「5」立刻被 clamp 成 12，第二键变成 122。
     *   · **空串 / 非数字视为放弃编辑，保持原值。**
     *     原先走 `clamp(Number(''), min, max)`，而 `Number('') === 0` → 直接被夹成 min，
     *     于是「全选删掉再改主意」会静默把值变成最小值；`Number('abc')` 更是 NaN 落进 value。
     *   · 超范围才闪一下琥珀色环（提示「我帮你夹过了」），正常提交不闪。
     */
    const commit = (v) => {
      const raw = typeof v === 'string' ? v.trim() : v;
      const n = Number(raw);
      if (raw === '' || !Number.isFinite(n)) { input.value = committed; return; }
      const c = clamp(n, min, max);
      if (c !== n) {
        input.classList.add('ring-2', 'ring-amber-300');
        setTimeout(() => input.classList.remove('ring-2', 'ring-amber-300'), 500);
      }
      committed = c;
      input.value = c;
      opt.onChange?.(c);
    };
    input.addEventListener('change', () => commit(input.value));
    input.addEventListener('keydown', (e) => {
      // Esc 放弃这次编辑，回到上次提交值（编辑期间输入框里是草稿，不是真值）
      if (e.key === 'Escape') { e.preventDefault(); input.value = committed; input.blur(); return; }
      const dir = { ArrowUp: 1, ArrowDown: -1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      commit(Number(input.value) + dir * (e.shiftKey ? 10 : 1));
    });
    el.querySelector('[data-up]').addEventListener('click', () => commit(Number(input.value) + 1));
    el.querySelector('[data-down]').addEventListener('click', () => commit(Number(input.value) - 1));
    const api = {
      get: () => committed,   // 读的是已提交值，不是编辑中的草稿字符串
      set: (v) => { committed = clamp(Number(v), min, max); input.value = committed; },
    };
    el._ctl = api;
    return api;
  }

  // ── 颜色字段：色板 + hex + 吸管 + 结果预览 ─────────────
  /**
   * 原先有两份手写实现：
   *
   *   · `library/controls.html:159` —— **没有 role、没有 aria-checked**，
   *     选中态只由 className 表达；而处理器用 `x.className = '…'` **整串覆盖**，
   *     属教训 #15 那一族（打开时顺手改、关闭时没还原）。
   *     hex 输入框还是**单向**的：点色板会写 hex，改 hex 不回写色板——
   *     与 components.html 已修的「改读数也回写滑块 ❌」同一形态。
   *   · `01-workbench.html:767` —— `role="radio"` + `aria-checked`，**这份是对的**。
   *
   * 所以「库页是参照实现」这句话当时是反的：界面页比控件库正确。
   * 这里照 01 那份写，两边都换成它。
   *
   * 顺带补上这一页立论里唯一缺的那一块：**结果预览**。
   * 这一节的标题是「选项自己长成结果的样子」，而颜色和不透明度改完之后
   * 页面上没有任何地方长成结果——不透明度尤其：90% 和 40% 在界面上完全一样。
   */
  function colorField(el, opt = {}) {
    const palette = opt.palette || CONTENT_PALETTE;
    const name = resolveLabel(el, opt) || '颜色';
    const hasOpacity = opt.opacity !== undefined && opt.opacity !== null;
    /* 三个附件默认都在，但可以单独关掉。
       `compact` 是给窄栏用的（01 的效果卡右栏只有约 300px）：
       只留色板，尺寸收到 size-6。**这不是「简化版控件」**，是同一个控件的一档——
       另开一个「小色板」组件就是第二套实现，而第二套实现就是这一轮在删的东西。 */
    const compact = !!opt.compact;
    const showHex = opt.hex ?? !compact;
    const showEyedrop = opt.eyedropper ?? !compact;
    const showPreview = opt.preview ?? !compact;
    let value = normHex(opt.value) || palette[0];
    let opacity = hasOpacity ? clamp(Number(opt.opacity), 10, 100) : 100;

    el.innerHTML = `
      <div class="flex flex-wrap items-center gap-1.5">
        <span data-swatches role="radiogroup" aria-label="${name}" class="flex flex-wrap items-center gap-1.5">
          ${palette.map((p) => `<button type="button" role="radio" aria-checked="false" data-color="${p}" class="swatch${compact ? ' swatch-sm' : ''}" style="background:${p}" aria-label="${hexName(p)}" title="${hexName(p)} ${p}"></button>`).join('')}
        </span>
        ${showHex || showEyedrop || showPreview ? '<span class="mx-1 h-5 w-px bg-slate-200"></span>' : ''}
        ${showHex ? `<input data-hex type="text" spellcheck="false" aria-label="${name} · 十六进制色值"
               class="h-7 w-[86px] rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold uppercase tabular-nums text-slate-700 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />` : ''}
        ${showEyedrop ? `<button type="button" data-eyedrop class="grid size-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50" aria-label="吸管取色" title="从屏幕取色">
          <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m14 6 4 4M5 19l1-4 8-8 3 3-8 8z"/></svg>
        </button>` : ''}
        ${showPreview ? '<span class="swatch-preview" data-preview title="结果预览：当前颜色 × 不透明度"><span data-preview-fill></span></span>' : ''}
      </div>
      ${hasOpacity ? `<div class="ctl-row mt-2.5">
        <span class="ctl-label" data-op-label>不透明度</span>
        <div data-slider data-dirty="off" data-min="10" data-max="100" data-value="${opacity}" data-default="${opacity}" data-step="1" data-label="${name} · 不透明度"></div>
        <span class="ctl-value"><span data-op-out>${opacity}</span>%</span>
      </div>` : ''}`;

    const hexInput = el.querySelector('[data-hex]');
    const fill = el.querySelector('[data-preview-fill]');
    const opOut = el.querySelector('[data-op-out]');
    const eyedrop = el.querySelector('[data-eyedrop]');

    function paint() {
      el.querySelectorAll('[data-color]').forEach((b) => {
        // 只 toggle 状态类，不整串覆盖 className——被覆盖掉的会是别人加的类，
        // 而那种残留没有视觉痕迹，只会在下一次读它的时候出错
        const on = normHex(b.dataset.color) === value;
        b.classList.toggle('swatch-on', on);
        b.setAttribute('aria-checked', String(on));
      });
      if (hexInput) hexInput.value = value;
      if (fill) {
        fill.style.background = value;
        fill.style.opacity = String(opacity / 100);
      }
      if (opOut) opOut.textContent = String(opacity);
    }
    const emit = notifier(opt.onChange);

    el.querySelectorAll('[data-color]').forEach((b) => b.addEventListener('click', () => {
      const next = normHex(b.dataset.color);
      if (next === value) return;
      value = next; paint(); emit(value, opacity);
    }));

    /* hex → 色板（原先缺的那一半）。提交语义与 Ctl.number 对齐：
       `change`（失焦或 Enter）才落，非法值**放弃编辑、保持原值**，
       而不是静默变成黑色。`Number('')`→0 那一族坑在颜色上的等价物是
       `#` → 解析失败 → 变成 #000000，而用户只是想把内容删掉重打。 */
    const commitHex = () => {
      if (!hexInput) return;
      const next = normHex(hexInput.value);
      if (!next) { hexInput.value = value; return; }
      if (next === value) { hexInput.value = value; return; }
      value = next; paint(); emit(value, opacity);
    };
    if (hexInput) {
      hexInput.addEventListener('change', commitHex);
      hexInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commitHex(); }
        if (e.key === 'Escape') { e.preventDefault(); hexInput.value = value; hexInput.blur(); }
      });
    }

    /* 吸管走浏览器的 EyeDropper API（Chromium 有）。取不到就**留痕**：
       标 data-unsupported 并把原因写进 title，而不是做成一个点了没反应的按钮。
       真实实现里这里是屏幕取色权限（裁决 4 的能力包之一）。 */
    if (eyedrop && typeof window.EyeDropper === 'function') {
      eyedrop.addEventListener('click', async () => {
        try {
          const { sRGBHex } = await new window.EyeDropper().open();
          const next = normHex(sRGBHex);
          if (next) { value = next; paint(); emit(value, opacity); }
        } catch { /* 用户按 esc 取消，不是错误 */ }
      });
    } else if (eyedrop) {
      eyedrop.setAttribute('data-unsupported', '1');
      eyedrop.disabled = true;
      eyedrop.title = '此浏览器不支持屏幕取色（真实应用里需要屏幕录制权限）';
    }

    if (hasOpacity) {
      // 直接 slider() 而不是 mountSliders()：读数在 [data-op-out] 上、由 paint() 统一写，
      // 走 mountSliders 会多标一次 data-mounted 并再找一遍 data-out（这里没有）
      slider(el.querySelector('[data-slider]'), {
        onChange: (v) => { opacity = v; paint(); },
        onCommit: () => emit(value, opacity),
      });
    }
    paint();
    const api = {
      get: () => ({ color: value, opacity }),
      set: (hex, op) => {
        if (hex) value = normHex(hex) || value;
        if (op !== undefined) opacity = clamp(Number(op), 10, 100);
        paint();
      },
    };
    el._ctl = api;
    return api;
  }
  /** `#abc` / `abc` / `#AABBCC` → `#AABBCC`；非法返回 null（**不返回黑色**）。 */
  function normHex(raw) {
    if (typeof raw !== 'string') return null;
    const s = raw.trim().replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(s)) return `#${s.split('').map((c) => c + c).join('').toUpperCase()}`;
    if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s.toUpperCase()}`;
    return null;
  }
  /* 色板格的可访问名。`aria-label="#F59E0B"` 会被读成十四个字符，
     而用户脑子里那个东西叫「琥珀」——名字要是人话。 */
  const HEX_NAMES = {
    '#F59E0B': '琥珀', '#0EA5E9': '天蓝', '#0D9488': '青绿', '#F43F5E': '玫红',
    '#8B5CF6': '紫罗兰', '#FFFFFF': '白', '#0F172A': '近黑',
  };
  const hexName = (hex) => HEX_NAMES[String(hex).toUpperCase()] || '自定义色';

  // ── 快捷键捕获 ─────────────────────────────────────────
  /**
   * 原先两份手写实现（`library/controls.html:384`、`07-settings.html:400`），
   * 两份都靠**重写整串 className** 在三种态之间切换，且都有同一个缺陷：
   *
   *   · 重复点击会**叠加 keydown 监听**——点三次再按键，回调跑三遍
   *     （库页那份因此会把按键写三次）。
   *   · 点页面别处不退出捕获态：按钮永远停在「按下组合键…」，
   *     而下一次按任何键都会被吞掉。
   *
   * 所以捕获态在这里是一个**显式状态**，`stop()` 是唯一的出口，
   * 三条退出路径（成功 / esc / 点外面）都走它。
   */
  function keycap(el, opt = {}) {
    let value = opt.value || '';
    const name = resolveLabel(el, opt) || '快捷键';
    // classList.add 而不是 `el.className = '…'`：整串覆盖会连别人加的类一起吃掉，
    // 而那种残留没有视觉痕迹。两份手写实现都是靠重写整串 className 换态的。
    el.classList.add('keycap');
    el.type = 'button';
    el.setAttribute('aria-label', name);
    let capturing = false;
    let onKey = null;
    let onOutside = null;

    function paint() {
      el.classList.toggle('keycap-capturing', capturing);
      el.classList.toggle('keycap-empty', !capturing && !value);
      el.innerHTML = capturing
        ? '<span class="text-xs font-medium text-slate-900">按下组合键…</span>'
        : (value ? keyChips(value) : '<span class="text-xs font-medium">点击后按下组合键</span>');
      el.setAttribute('aria-label', value ? `${name}：${keyParts(value).join(' ')}` : name);
    }
    function stop() {
      if (!capturing) return;
      capturing = false;
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onOutside, true);
      onKey = null; onOutside = null;
      paint();
    }
    function start() {
      if (capturing) return;   // 幂等：不叠加监听
      capturing = true;
      paint();
      onKey = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') { stop(); return; }
        if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return;   // 只按修饰键还没组成组合
        const combo = [e.metaKey && '⌘', e.ctrlKey && '⌃', e.altKey && '⌥', e.shiftKey && '⇧',
          e.key.length === 1 ? e.key.toUpperCase() : e.key].filter(Boolean).join('');
        value = combo;
        stop();
        opt.onChange?.(value);
      };
      onOutside = (e) => { if (!el.contains(e.target)) stop(); };
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('pointerdown', onOutside, true);
    }
    el.addEventListener('click', start);
    paint();
    const api = { get: () => value, set: (v) => { value = v || ''; paint(); }, cancel: stop };
    el._ctl = api;
    return api;
  }
  const MODIFIER_GLYPHS = ['⌘', '⌃', '⌥', '⇧'];
  /**
   * 把 `⌘⇧Z` 拆成 `['⌘','⇧','Z']`。
   *
   * 07 原先用 `key.split('')` 逐字符出键帽——于是 `⌘1–5` 变成三个键帽
   * 「⌘」「1」「–」「5」，`Enter` 变成五个。修饰键是单字符、主键不一定是。
   */
  function keyParts(str) {
    const chars = [...String(str || '')];
    const parts = [];
    while (chars.length && MODIFIER_GLYPHS.includes(chars[0])) parts.push(chars.shift());
    if (chars.length) parts.push(chars.join(''));
    return parts;
  }
  const keyChips = (str) => keyParts(str).map((p) => `<span class="kbd">${p}</span>`).join('');

  // ── 二维板 / 角度盘 / 曲线编辑器 ────────────────────────
  /*
    这三个控件此前只活在 library/controls.html 的内联脚本里，
    而那一节的标题写着「这三类现在都被拆成两个滑块或六个词，是最该换掉的」——
    换掉的东西自己不进共享层，就只是画册。

    三个都缺同一件事：`role` / `aria-label` / `tabindex` **三者皆无**，
    所以键盘完全不可达、读屏无名。四项机械探针**一个都没报**，
    因为它们的判据认的是 `-on` / `-active` / `bg-slate-9x0` 这三种写法，
    而这三个控件全部绕开了。又一次「分别检查都通过、合起来是坏的」。
  */

  /**
   * 二维偏移板。
   *
   * 键盘可达性用**边缘轴轨**解决，而不是给中心圆点加两个重叠的 `role="slider"`：
   * 两个 thumb 落在同一个点上时 `document.elementFromPoint` 在其中一个的中心
   * 返回的是另一个，**可达性探针会当场误报**——而误报会淹掉真问题（README 教训）。
   * 轴轨顺带把「这个控件由两个分量组成」画出来了，比一个孤立的点更说得清。
   */
  function pad(el, opt = {}) {
    const name = resolveLabel(el, opt) || '偏移';
    const notify = notifier(opt.onChange);
    let x = clamp(opt.x ?? 50, 0, 100);
    let y = clamp(opt.y ?? 50, 0, 100);
    el.classList.add('pad');
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', name);
    el.innerHTML = `
      <div class="pad-cross-v" aria-hidden="true"></div>
      <div class="pad-cross-h" aria-hidden="true"></div>
      <div class="pad-dot" data-dot aria-hidden="true"></div>
      <div class="pad-axis pad-axis-x" data-axis="x" role="slider" tabindex="0"
           aria-label="${name} · 横向" aria-valuemin="0" aria-valuemax="100"><span class="pad-axis-mark" data-mark></span></div>
      <div class="pad-axis pad-axis-y" data-axis="y" role="slider" tabindex="0"
           aria-label="${name} · 纵向" aria-valuemin="0" aria-valuemax="100"><span class="pad-axis-mark" data-mark></span></div>`;
    const dot = el.querySelector('[data-dot]');
    const ax = el.querySelector('[data-axis="x"]');
    const ay = el.querySelector('[data-axis="y"]');

    function paint() {
      dot.style.left = `${x}%`;
      dot.style.top = `${y}%`;
      ax.querySelector('[data-mark]').style.left = `${x}%`;
      ay.querySelector('[data-mark]').style.top = `${y}%`;
      ax.setAttribute('aria-valuenow', String(Math.round(x)));
      ay.setAttribute('aria-valuenow', String(Math.round(y)));
      const text = `X ${Math.round(x)}% · Y ${Math.round(y)}%`;
      ax.setAttribute('aria-valuetext', text);
      ay.setAttribute('aria-valuetext', text);
      notify(Math.round(x), Math.round(y));
    }
    const fromEvent = (e) => {
      const r = el.getBoundingClientRect();
      x = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
      y = clamp(((e.clientY - r.top) / r.height) * 100, 0, 100);
      paint();
    };
    let dragging = false;
    const endDrag = () => { dragging = false; };
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.pad-axis')) return;   // 轴轨自己处理，别一个手势改两个分量
      dragging = true; el.setPointerCapture(e.pointerId); fromEvent(e);
    });
    el.addEventListener('pointermove', (e) => { if (dragging) fromEvent(e); });
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);   // 原先漏了：手势被系统打断后会一直粘着

    [[ax, 'x'], [ay, 'y']].forEach(([node, axis]) => {
      let axisDrag = false;
      const setFrom = (e) => {
        const r = el.getBoundingClientRect();
        if (axis === 'x') x = clamp(((e.clientX - r.left) / r.width) * 100, 0, 100);
        else y = clamp(((e.clientY - r.top) / r.height) * 100, 0, 100);
        paint();
      };
      node.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        axisDrag = true; node.setPointerCapture(e.pointerId); setFrom(e);
      });
      node.addEventListener('pointermove', (e) => { if (axisDrag) setFrom(e); });
      node.addEventListener('pointerup', () => { axisDrag = false; });
      node.addEventListener('pointercancel', () => { axisDrag = false; });
      node.addEventListener('keydown', (e) => {
        const step = (e.shiftKey ? 10 : 1);
        const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
        if (d === undefined) return;
        e.preventDefault();
        // 每条轨只动自己那个分量：在 X 轨上按 ↑ 改 X 是对的（值增大），
        // 让 Y 也动的话，「一个控件两个分量」这件事就又说不清了
        if (axis === 'x') x = clamp(x + d * step, 0, 100);
        else y = clamp(y - d * step, 0, 100);   // 纵向：↑ 往上 = y 变小
        paint();
      });
    });
    paint();
    const api = { get: () => [Math.round(x), Math.round(y)], set: (nx, ny) => { x = clamp(nx, 0, 100); y = clamp(ny, 0, 100); paint(); } };
    el._ctl = api;
    return api;
  }

  /** 角度盘。knob 是 `role="slider"`：←→ ±1°、⇧ ±15°，拖拽时按住 Shift 吸附 15°。 */
  function dial(el, opt = {}) {
    const name = resolveLabel(el, opt) || '角度';
    const notify = notifier(opt.onChange);
    const R = opt.radius ?? 34;
    let deg = ((opt.value ?? 0) % 360 + 360) % 360;
    el.classList.add('dial');
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', name);
    el.innerHTML = `
      <div class="dial-ring" aria-hidden="true"></div>
      <div class="dial-arm" data-arm aria-hidden="true" style="width:${R}px"></div>
      <div class="dial-hub" aria-hidden="true"></div>
      <div class="dial-knob" data-knob role="slider" tabindex="0" aria-label="${name}"
           aria-valuemin="0" aria-valuemax="359" aria-valuenow="${Math.round(deg)}"></div>`;
    const arm = el.querySelector('[data-arm]');
    const knob = el.querySelector('[data-knob]');
    /* 预设 chip 按**容器**取，不按全站选择器取——这与 bindRadioCards 收作用域
       是同一个理由：全站选择器在「今天恰好只有一组」时看不出问题。 */
    const presetRoot = typeof opt.presets === 'string' ? document.querySelector(opt.presets) : opt.presets;
    const presets = presetRoot ? [...presetRoot.querySelectorAll('[data-ang]')] : [];

    function paint() {
      arm.style.transform = `rotate(${deg}deg)`;
      const rad = (deg * Math.PI) / 180;
      knob.style.left = `calc(50% + ${Math.cos(rad) * R}px)`;
      knob.style.top = `calc(50% + ${Math.sin(rad) * R}px)`;
      knob.setAttribute('aria-valuenow', String(Math.round(deg)));
      knob.setAttribute('aria-valuetext', `${Math.round(deg)}°`);
      presets.forEach((b) => {
        const on = Number(b.dataset.ang) === Math.round(deg);
        b.classList.toggle('preset-chip-on', on);
        b.setAttribute('aria-checked', String(on));
      });
      notify(Math.round(deg));
    }
    const set = (next) => { deg = ((Math.round(next) % 360) + 360) % 360; paint(); };
    const fromEvent = (e) => {
      const r = el.getBoundingClientRect();
      let d = (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
      if (e.shiftKey) d = Math.round(d / 15) * 15;
      set(d);
    };
    let dragging = false;
    el.addEventListener('pointerdown', (e) => { dragging = true; el.setPointerCapture(e.pointerId); fromEvent(e); });
    el.addEventListener('pointermove', (e) => { if (dragging) fromEvent(e); });
    el.addEventListener('pointerup', () => { dragging = false; });
    el.addEventListener('pointercancel', () => { dragging = false; });
    knob.addEventListener('keydown', (e) => {
      const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
      if (d === undefined) return;
      e.preventDefault();
      set(deg + d * (e.shiftKey ? 15 : 1));
    });
    presets.forEach((b) => b.addEventListener('click', () => set(Number(b.dataset.ang))));
    paint();
    const api = { get: () => Math.round(deg), set };
    el._ctl = api;
    return api;
  }

  /**
   * 自定义缓动（贝塞尔）编辑器。
   *
   * **修的是几何，不是手感。** 上一版的映射是 `Y(v) = 100 - 80v - 10`，
   * 只给过冲留了 10 个单位（v ≤ 1.125），而拖拽钳位放到 **1.6**。
   * 默认值 `y1 = 1.56`（「弹跳」的真实控制点）算出 `top: -34.8%`，
   * 实测**拖柄浮在盒子上方 40px**——页面上多出一颗与任何容器都无关的黑点，
   * 而它是这个控件最重要的那个手柄。
   *
   * 不变量：**钳位范围 == 可见范围**。改一个必须改另一个，
   * 所以两者都由 `V_MIN` / `V_MAX` 这一对常量导出，没有第二处可以单独漂。
   */
  const V_MIN = -0.6;
  const V_MAX = 1.6;
  function curve(el, opt = {}) {
    const name = resolveLabel(el, opt) || '自定义缓动';
    const notify = notifier(opt.onChange);
    let pts = (opt.pts || [0.34, 1.56, 0.64, 1]).slice();
    const Y = (v) => ((V_MAX - v) / (V_MAX - V_MIN)) * 100;
    const V = (yPct) => V_MAX - (yPct / 100) * (V_MAX - V_MIN);
    el.classList.add('curve');
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', name);
    el.innerHTML = `
      <svg class="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1="${Y(0)}" x2="100" y2="${Y(0)}" stroke="#e2e8f0" stroke-width="0.6" />
        <line x1="0" y1="0" x2="0" y2="100" stroke="#e2e8f0" stroke-width="0.6" />
        <line x1="0" y1="${Y(1)}" x2="100" y2="${Y(1)}" stroke="#eef2f6" stroke-width="0.6" stroke-dasharray="2 2" />
        <path data-path d="" fill="none" stroke="#0f172a" stroke-width="1.4" vector-effect="non-scaling-stroke" />
        <line data-leg="1" stroke="#cbd5e1" stroke-width="0.8" stroke-dasharray="2 2" />
        <line data-leg="2" stroke="#cbd5e1" stroke-width="0.8" stroke-dasharray="2 2" />
      </svg>
      <span class="curve-guide" style="top:${Y(1)}%" aria-hidden="true">1.0</span>
      <span class="curve-guide" style="top:${Y(0)}%" aria-hidden="true">0.0</span>
      <div class="curve-handle" data-h="1" role="slider" tabindex="0" aria-label="${name} · 控制点 1"
           aria-valuemin="0" aria-valuemax="1"></div>
      <div class="curve-handle" data-h="2" role="slider" tabindex="0" aria-label="${name} · 控制点 2"
           aria-valuemin="0" aria-valuemax="1"></div>`;
    const path = el.querySelector('[data-path]');
    const legs = [el.querySelector('[data-leg="1"]'), el.querySelector('[data-leg="2"]')];
    const handles = [el.querySelector('[data-h="1"]'), el.querySelector('[data-h="2"]')];

    function paint() {
      const [x1, y1, x2, y2] = pts;
      path.setAttribute('d', `M0 ${Y(0)} C ${x1 * 100} ${Y(y1)}, ${x2 * 100} ${Y(y2)}, 100 ${Y(1)}`);
      legs[0].setAttribute('x1', 0); legs[0].setAttribute('y1', Y(0));
      legs[0].setAttribute('x2', x1 * 100); legs[0].setAttribute('y2', Y(y1));
      legs[1].setAttribute('x1', 100); legs[1].setAttribute('y1', Y(1));
      legs[1].setAttribute('x2', x2 * 100); legs[1].setAttribute('y2', Y(y2));
      handles[0].style.left = `${x1 * 100}%`; handles[0].style.top = `${Y(y1)}%`;
      handles[1].style.left = `${x2 * 100}%`; handles[1].style.top = `${Y(y2)}%`;
      const over = overshoot(pts);
      path.setAttribute('stroke', over > 0 ? '#d97706' : '#0f172a');
      handles.forEach((h, i) => {
        h.setAttribute('aria-valuenow', String(pts[i * 2]));
        h.setAttribute('aria-valuetext', `x ${pts[i * 2].toFixed(2)} · y ${pts[i * 2 + 1].toFixed(2)}`);
      });
      notify(pts.slice(), over);
    }
    const setPt = (i, nx, ny) => {
      pts[i * 2] = clamp(nx, 0, 1);
      pts[i * 2 + 1] = clamp(ny, V_MIN, V_MAX);   // 与 Y() 同源，所以拖不到盒外
      paint();
    };
    handles.forEach((h, i) => {
      h.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        h.setPointerCapture(e.pointerId);
        const move = (ev) => {
          const r = el.getBoundingClientRect();
          setPt(i, (ev.clientX - r.left) / r.width, V(((ev.clientY - r.top) / r.height) * 100));
        };
        const up = () => {
          h.removeEventListener('pointermove', move);
          h.removeEventListener('pointerup', up);
          h.removeEventListener('pointercancel', up);
          opt.onCommit?.(pts.slice());
        };
        h.addEventListener('pointermove', move);
        h.addEventListener('pointerup', up);
        h.addEventListener('pointercancel', up);
      });
      h.addEventListener('keydown', (e) => {
        const d = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[e.key];
        if (d === undefined) return;
        e.preventDefault();
        const step = e.shiftKey ? 0.1 : 0.01;
        const horiz = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
        const nx = horiz ? pts[i * 2] + d * step : pts[i * 2];
        const ny = horiz ? pts[i * 2 + 1] : pts[i * 2 + 1] + d * step;
        setPt(i, Math.round(nx * 100) / 100, Math.round(ny * 100) / 100);
        opt.onCommit?.(pts.slice());
      });
    });
    paint();
    const api = {
      get: () => pts.slice(),
      set: (next) => { pts = next.slice(); paint(); },
    };
    el._ctl = api;
    return api;
  }

  // ── 开关 / 复选 / 单选卡：就地接管已有标记 ───────────────
  /**
   * 开关。
   *
   * `07-settings.html` 已经把规则写在注释里了：**`aria-checked` 是真值，
   * `.switch-on` 只是它的投影**；反过来写就是两份真值，而这一族缺陷在 09 上
   * 发生过一次。规则写下来了却每页各抄一遍实现，等于规则只在写它的那一页成立。
   */
  function bindSwitches(root = document, onChange) {
    return [...root.querySelectorAll('[data-switch], [data-sw]')]
      .filter((b) => !b.dataset.ctlBound)
      .map((b) => {
        b.dataset.ctlBound = '1';
        if (!b.getAttribute('role')) b.setAttribute('role', 'switch');
        if (!b.hasAttribute('aria-checked')) b.setAttribute('aria-checked', 'false');
        const knob = b.querySelector('.switch-knob');
        const project = () => knob && knob.classList.toggle('switch-on', b.getAttribute('aria-checked') === 'true');
        project();
        b.addEventListener('click', () => {
          b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true'));
          project();
          onChange?.(b.getAttribute('aria-checked') === 'true', b);
        });
        return b;
      });
  }

  /**
   * 复选，含半选。
   *
   * 上一版这三个按钮**没有任何监听**——没有 `role`、没有 `aria-checked`，
   * 点下去 DOM 一个字节都不变，而页头写着「全部可交互」。
   * 半选那一格更只是一根画上去的横线：既不是 `aria-checked="mixed"`，
   * 也不由任何东西推导出来，所以它演示的是「半选长什么样」，
   * 而不是「半选什么时候出现」——而后者才是这个控件唯一难的地方。
   *
   * 现在 `mixed` 由子项推导：`data-check-parent="<组名>"` 收集
   * `data-check-of="<组名>"`，全选 → true、全不选 → false、其余 → mixed；
   * 点父项则把子项**全部**设成同一个值。
   */
  function bindChecks(root = document, onChange) {
    const boxes = [...root.querySelectorAll('[data-check]')].filter((b) => !b.dataset.ctlBound);
    const stateOf = (b) => b.getAttribute('aria-checked') || 'false';
    const glyph = {
      true: '<svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><path d="M20 6 9 17l-5-5"/></svg>',
      mixed: '<span class="check-dash"></span>',
      false: '',
    };
    const project = (b) => {
      const s = stateOf(b);
      const box = b.querySelector('[data-check-box]');
      if (!box) return;
      box.classList.toggle('check-box-on', s !== 'false');
      box.innerHTML = glyph[s] || '';
    };
    boxes.forEach((b) => {
      b.dataset.ctlBound = '1';
      b.type = 'button';
      if (!b.getAttribute('role')) b.setAttribute('role', 'checkbox');
      if (!b.hasAttribute('aria-checked')) b.setAttribute('aria-checked', b.dataset.check === 'true' ? 'true' : 'false');
      if (!b.querySelector('[data-check-box]')) {
        const box = document.createElement('span');
        box.className = 'check-box';
        box.setAttribute('data-check-box', '');
        b.prepend(box);
      }
      project(b);
    });
    const syncParents = () => {
      root.querySelectorAll('[data-check-parent]').forEach((p) => {
        const kids = [...root.querySelectorAll(`[data-check-of="${p.dataset.checkParent}"]`)];
        if (!kids.length) return;
        const on = kids.filter((k) => stateOf(k) === 'true').length;
        p.setAttribute('aria-checked', on === kids.length ? 'true' : (on === 0 ? 'false' : 'mixed'));
        project(p);
        const out = p.querySelector('[data-check-count]');
        if (out) out.textContent = `（${on} / ${kids.length} 已选）`;
      });
    };
    boxes.forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.checkParent) {
        // 半选状态下点父项：**全选**。半选 → 全不选会让人以为自己撤销了什么，
        // 而他刚才什么都没勾
        const next = stateOf(b) !== 'true';
        root.querySelectorAll(`[data-check-of="${b.dataset.checkParent}"]`).forEach((k) => {
          k.setAttribute('aria-checked', String(next));
          project(k);
        });
      } else {
        b.setAttribute('aria-checked', String(stateOf(b) !== 'true'));
        project(b);
      }
      syncParents();
      onChange?.(b);
    }));
    syncParents();
    return boxes;
  }

  /**
   * 单选卡。
   *
   * 作用域收到**最近的 `[role="radiogroup"]`**。上一版用全局
   * `querySelectorAll('[data-radio]')` 清空所有卡片——页面上只有一组时看不出问题，
   * 第二组一出现两组就会互相清空。这类「今天恰好只有一个」的实现是稿子被照抄之后
   * 才会炸的那一种，而炸的时候没人会想到是控件库里的一行。
   */
  function bindRadioCards(root = document, onChange) {
    const groups = new Set([...root.querySelectorAll('[data-radio]')]
      .map((b) => b.closest('[role="radiogroup"]')).filter(Boolean));
    groups.forEach((group) => {
      const items = [...group.querySelectorAll('[data-radio]')];
      items.forEach((b) => {
        if (b.dataset.ctlBound) return;
        b.dataset.ctlBound = '1';
        b.addEventListener('click', () => {
          items.forEach((x) => {
            const on = x === b;
            x.setAttribute('aria-checked', String(on));
            x.classList.toggle('mode-card-on', on);
            const dotEl = x.querySelector('.mode-dot');
            if (dotEl) dotEl.classList.toggle('mode-dot-on', on);
          });
          onChange?.(b);
        });
      });
    });
    return [...groups];
  }

  // ── 选项缩略图：缓动曲线 / 形状 / 字体样张 ──────────────
  function curveThumb(pts, size = 24) {
    const [x1, y1, x2, y2] = pts;
    const over = y1 > 1 || y2 > 1;
    const X = (t) => 3 + t * (size - 6);
    const Y = (t) => size - 3 - t * (size - 6);
    return `<svg viewBox="0 0 ${size} ${size}" class="size-full">
      <line x1="3" y1="${size - 3}" x2="${size - 3}" y2="${size - 3}" stroke="#e2e8f0" stroke-width="1"/>
      <line x1="3" y1="3" x2="${size - 3}" y2="3" stroke="${over ? '#fbbf24' : '#eef2f6'}" stroke-width="1" stroke-dasharray="2 2"/>
      <path d="M${X(0)} ${Y(0)} C ${X(x1)} ${Y(y1)}, ${X(x2)} ${Y(y2)}, ${X(1)} ${Y(1)}" fill="none" stroke="#0f172a" stroke-width="1.4"/>
    </svg>`;
  }
  /*
    形状几何的**唯一真值源**。

    fill 用 `currentColor` 而不是写死 `#0f172a`：这份几何有两个消费者——
    下拉里的缩略图（外壳色）和 `01` 舞台里真正被画出来的粒子（**用户选的颜色**）。
    写死颜色会逼出第二套形状代码，而两套形状代码必然会有一天不一致
    （README 教训：「一个数出来的数和一个画下去的形状由两处代码分别计算，
    就一定会有一天不一致」）。
  */
  const SHAPE_PATH = {
    圆点: '<circle cx="12" cy="12" r="6" fill="currentColor"/>',
    方块: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
    星形: '<path d="M12 4l2.4 6.2H21l-5.3 3.7 2 6.1L12 16.4 6.3 20l2-6.1L3 10.2h6.6z" fill="currentColor"/>',
    钻石: '<path d="M12 4l7 8-7 8-7-8z" fill="currentColor"/>',
  };
  const SHAPE_NAMES = Object.keys(SHAPE_PATH);
  /** 下拉/字段行里的缩略图：外壳色。 */
  const shapeThumb = (name) => `<svg viewBox="0 0 24 24" class="size-4 text-slate-900">${SHAPE_PATH[name] || SHAPE_PATH.圆点}</svg>`;
  /**
   * 舞台用：任意尺寸 + 任意颜色，几何与缩略图同源。
   * color 走 `style="color:…"`，因为 path 里是 `currentColor`。
   */
  const shapeSvg = (name, px, color) =>
    `<svg viewBox="0 0 24 24" style="width:${px}px;height:${px}px;color:${color};display:block">${SHAPE_PATH[name] || SHAPE_PATH.圆点}</svg>`;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, Number.isFinite(v) ? v : a)); }
  function num(raw, fallback) { const v = Number(raw); return Number.isFinite(v) ? v : fallback; }
  /**
   * 防重入通知。
   *
   * 消费者在 `onChange` 里回调 `set()`（把值同步进自己的读数 / 预览 / 另一个控件）
   * 是很自然的写法，但那样 `set → paint → onChange → set` 会无限递归直到爆栈。
   * `slider` 里已经有一份同样的逻辑（见它的 `notifying`），
   * 新控件抽这个共用而不是再各写一份——**渲染每次都做，只有最外层那次通知。**
   */
  function notifier(fn) {
    let busy = false;
    return (...args) => {
      if (busy || typeof fn !== 'function') return;
      busy = true;
      try { fn(...args); } finally { busy = false; }
    };
  }

  return {
    // 控件
    slider, mountSliders, select, number, colorField, keycap, pad, dial, curve,
    bindSwitches, bindChecks, bindRadioCards,
    // 数据的唯一真值源（**别处不要再抄一份**）
    EASINGS, FONTS, CONTENT_PALETTE, SHAPE_NAMES, CH_TONE,
    toneOf, toneByName,
    // 由上面那几张表导出的读数与渲染，缩略图与真跑的动画共用它们
    overshoot, easingPts, easingDesc, easingOptions, cssEasing,
    fontStack, fontOptions, curveThumb, shapeThumb, shapeSvg,
    // 工具
    keyParts, keyChips, normHex, hexName, clamp,
  };
})();
window.Ctl = Ctl;   // 顶层 const 不会挂到 window，显式导出便于跨脚本使用与自检
