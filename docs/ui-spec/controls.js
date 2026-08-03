/**
 * 配置控件的共享实现（对应真实代码里的 src/components/ui/*）。
 *
 * 为什么抽出来：这些控件原先只活在 library/controls.html 里「展示」，
 * 四个界面照旧用原生 <input type=range> 和 <select>，还多出一套 mini-select。
 * 控件库不落地到界面就只是画册，重构时这套分叉会被原样复制。
 *
 * 用法：
 *   Ctl.mountSliders(root)                        // 扫描 [data-slider] 自动装配
 *   Ctl.select(el, { options, value, onChange })  // 带预览缩略图的下拉
 *   Ctl.number(el, { min, max, unit, onChange })  // 可输入的数值框
 *
 * 手感约定（四个界面必须一致）：
 *   拖柄 hover 放大 · 拖拽出数值气泡 · 轨道下方三角标默认值 · 双击拖柄回默认
 *   方向键 ±step / Shift ±10step · ⌥ 临时关闭吸附 · 标签可横向 scrub
 */
const Ctl = (() => {

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

    el.classList.add('sl');
    el.innerHTML = '<div class="sl-track"></div><div class="sl-fill"></div>'
      + cfg.ticks.map(() => '<span class="sl-tick"></span>').join('')
      + '<span class="sl-default"></span>'
      + `<span class="sl-thumb" data-t="1" tabindex="${cfg.disabled ? -1 : 0}" role="slider"></span>`
      + (cfg.dual ? '<span class="sl-thumb" data-t="2" tabindex="0" role="slider"></span>' : '')
      + '<span class="sl-bubble" hidden></span>';
    if (cfg.disabled) el.classList.add('sl-disabled');

    const norm = (v) => ((v - cfg.min) / (cfg.max - cfg.min)) * 100;
    const fill = el.querySelector('.sl-fill');
    const t1 = el.querySelector('[data-t="1"]');
    const t2 = el.querySelector('[data-t="2"]');
    const bubble = el.querySelector('.sl-bubble');

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
      t1.setAttribute('aria-valuenow', String(cfg.value));
      t1.setAttribute('aria-valuetext', cfg.format(cfg.value, cfg.value2));
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
      setDisabled: (v) => { cfg.disabled = v; el.classList.toggle('sl-disabled', v); },
    };
    el._ctl = api;
    return api;
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
  function select(el, opt) {
    const { options, onChange } = opt;
    let value = opt.value ?? options[0].label;
    el.classList.add('relative');
    el.innerHTML = `
      <button type="button" class="flex h-8 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 text-left shadow-sm transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400" data-trigger aria-haspopup="listbox">
        <span data-thumb class="opt-thumb size-6 shrink-0"></span>
        <span data-label class="min-w-0 flex-1 truncate text-xs text-slate-700"></span>
        <span data-side class="shrink-0 text-2xs text-slate-400"></span>
        <svg class="size-3.5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      <div data-panel class="absolute left-0 top-9 z-30 hidden w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-lg" role="listbox"></div>`;

    const trigger = el.querySelector('[data-trigger]');
    const panel = el.querySelector('[data-panel]');
    const thumbBox = el.querySelector('[data-thumb]');

    function cur() { return options.find((o) => o.label === value) || options[0]; }
    function paint() {
      const o = cur();
      el.querySelector('[data-label]').textContent = o.label;
      el.querySelector('[data-side]').innerHTML = o.side || '';
      thumbBox.innerHTML = o.thumb || '';
      thumbBox.classList.toggle('hidden', !o.thumb);
    }
    function renderPanel() {
      panel.innerHTML = options.map((o) => `
        <button type="button" role="option" aria-selected="${o.label === value}" data-opt="${o.label}" class="opt-row${o.label === value ? ' opt-row-on' : ''}">
          ${o.thumb ? `<span class="opt-thumb">${o.thumb}</span>` : ''}
          <span class="min-w-0 flex-1"><span class="opt-name">${o.label}</span>${o.desc ? `<span class="opt-desc">${o.desc}</span>` : ''}</span>
          ${o.side ? `<span class="shrink-0 text-2xs text-slate-500">${o.side}</span>` : ''}
          ${o.label === value ? '<svg class="size-3.5 shrink-0 text-slate-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6 9 17l-5-5"/></svg>' : ''}
        </button>`).join('');
      panel.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => {
        value = b.dataset.opt;
        paint(); close();
        onChange?.(value, cur());
      }));
    }
    const open = () => {
      document.querySelectorAll('[data-panel]').forEach((p) => p.classList.add('hidden'));
      renderPanel();
      panel.classList.remove('hidden');
    };
    const close = () => panel.classList.add('hidden');
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.classList.contains('hidden') ? open() : close();
    });
    document.addEventListener('click', (e) => { if (!el.contains(e.target)) close(); });
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const i = options.findIndex((o) => o.label === value);
        value = options[clamp(i + (e.key === 'ArrowDown' ? 1 : -1), 0, options.length - 1)].label;
        paint(); onChange?.(value, cur());
      }
    });
    paint();
    const api = { get: () => value, set: (v) => { value = v; paint(); } };
    el._ctl = api;
    return api;
  }

  // ── 可输入的数值框 ─────────────────────────────────────
  function number(el, opt = {}) {
    const min = opt.min ?? 0, max = opt.max ?? 100, unit = opt.unit || '';
    el.classList.add('group', 'relative');
    el.innerHTML = `
      <input data-input class="h-8 w-24 rounded-xl border border-slate-200 bg-white pl-2 pr-10 text-xs font-semibold tabular-nums text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" value="${opt.value ?? min}" />
      ${unit ? `<span class="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-2xs text-slate-400">${unit}</span>` : ''}
      <span class="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button type="button" data-up class="grid h-3 w-4 place-items-center rounded-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="增加">
          <svg class="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m6 15 6-6 6 6"/></svg>
        </button>
        <button type="button" data-down class="grid h-3 w-4 place-items-center rounded-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="减少">
          <svg class="size-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m6 9 6 6 6-6"/></svg>
        </button>
      </span>`;
    const input = el.querySelector('[data-input]');
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
  const SHAPE_PATH = {
    圆点: '<circle cx="12" cy="12" r="6" fill="#0f172a"/>',
    方块: '<rect x="6" y="6" width="12" height="12" rx="2" fill="#0f172a"/>',
    星形: '<path d="M12 4l2.4 6.2H21l-5.3 3.7 2 6.1L12 16.4 6.3 20l2-6.1L3 10.2h6.6z" fill="#0f172a"/>',
    钻石: '<path d="M12 4l7 8-7 8-7-8z" fill="#0f172a"/>',
  };
  const shapeThumb = (name) => `<svg viewBox="0 0 24 24" class="size-4">${SHAPE_PATH[name] || SHAPE_PATH.圆点}</svg>`;

  function clamp(v, a, b) { return Math.min(b, Math.max(a, Number.isFinite(v) ? v : a)); }
  function num(raw, fallback) { const v = Number(raw); return Number.isFinite(v) ? v : fallback; }

  return { slider, mountSliders, select, number, curveThumb, shapeThumb, clamp };
})();
window.Ctl = Ctl;   // 顶层 const 不会挂到 window，显式导出便于跨脚本使用与自检
