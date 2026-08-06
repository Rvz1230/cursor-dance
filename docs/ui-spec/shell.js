/**
 * 应用外壳（标题栏 + 工作区导航 + 主题库侧边栏）。
 *
 * 为什么抽出来：这段结构原先在 4 个页面里各拷了一份，已经开始不一致——
 * 工作台用的是展开态新侧边栏，另外三页还留着 60px 折叠版；工具栏上的
 * 「保存」在一页是按钮、在另一页是自动保存指示。稿子内部先自洽，
 * 实施时它对应真实代码里的 WorkbenchChrome + ThemeLibrarySidebar。
 *
 * 用法：
 *   mountShell({ active: 'cursor-skin', proto: [['normal','① 常规'], ...], onProto: fn, hint: '...' })
 * 页面把主体内容放在 <template id="page">，外壳会把它挂到 <main> 里。
 */

/**
 * 模拟窗口的尺寸档位。**第一档是基准**（初始渲染用它）。
 *
 * 原先外壳写死 `h-[892px] max-w-[1440px]`，而真实桌面端的窗口是
 * `width: 960, height: 680, minWidth: 720, minHeight: 480`
 * （src/desktop/main/workbench-window.ts）。也就是说整套稿子是在一个
 * **比默认窗口宽 50%、高 31%** 的尺寸上画的，而这个基准从没被核对过。
 *
 * 后果不是「窄屏没适配」这种边缘问题，而是**基于尺寸的设计决策全部失真**。
 * 实测同一份 01：
 *   时间轴轨道  1440×892 → 684px   960×680 → 204px   720×480 → 2px
 *   舞台        1440×892 → 408×253 960×680 → 224×41  720×480 → 131×2
 *   配置列高    1440×892 → 314px   960×680 → 102px   720×480 → 0
 * README 说把时间轴改成底部抽屉的全部理由是「原先挤在右列只有 ~400px 宽」，
 * 改完宣称 684px——而 684 只在 1440 下成立，默认窗口下是 204px，
 * **比它要取代的那个 400px 还窄一半**。舞台同理：41px 高连一次文字上浮（54px）都装不下。
 *
 * 所以基准改成桌面默认值，另留大屏档与最小档用于对照。
 * 大屏档保留是必要的——它是「这套设计最舒展时的样子」，但它不能再当默认。
 */
const VIEWPORTS = [
  ['default', '桌面默认 960×680', 960, 680],
  ['large', '大屏 1440×892', 1440, 892],
  ['min', '桌面最小 720×480', 720, 480],
];

/**
 * 按**模拟窗口**宽度分档，写到 #mockWindow 的 data-w 上，页面用
 * `group-data-[w=lg]/win:` 这类变体消费。
 *
 * 为什么必须这样：稿子里原有 42 处 Tailwind 视口断点（`sm:` / `xl:` …），
 * 而它们响应的是**浏览器视口**，不是这个固定尺寸的模拟窗口——**在稿子里全部失效**。
 * 最贵的一处是 `02` 第 60 行的 `xl:grid-cols-[minmax(0,1fr)_360px]`：
 * 它从来没生效过，所以「11 个光标状态分 6 组」这套核心内容一直堆在 380px 舞台**下面**、
 * 首屏一个都看不见——而这正是 02 这一版重新设计的全部重点。
 * 断点写了却不生效，比没写更糟：它让人以为窄屏已经考虑过了。
 *
 * 档位按内容能力切，不按整数好看：
 *   sm  < 860  —— 侧栏自动折叠的同一条线；两列并排已无意义
 *   md  < 1200 —— 真实默认 960 落在这里，两列要用更窄的次列
 *   lg  >= 1200 —— 稿子原来的设计基准
 */
function widthBucket(w) {
  if (w < 860) return 'sm';
  if (w < 1200) return 'md';
  return 'lg';
}

/*
  ══ 工作区按**意图**分组（ux 规格 §3 / DECISIONS.md 裁决 2）══════════

  原先是 5 个等权平铺 tab，而 `shell.js` 在 6 个页面全量加载——后果是
  **应用规则和诊断面板上也摆着一条选中的主题轨**。那两页的作用域是「全局」，
  一个全局页面上摆着「当前主题」，于是每行的「跟随全局」从不说全局是哪一个
  （README 缺陷 30 实测：在侧栏把主题从几何切到流光，`03` 整页纹丝不动）。

  作用域不表达出来，这一族缺陷会一直有新的形态。分组是表达它的手段：
  **个性化组 = 属于当前主题**（有主题侧栏、有撤销、有草稿状态）；
  **自动化 / 系统组 = 全局**（三者全部收掉）。

  顺序即 ⌘1–5 的顺序，所以键盘顺序与视觉顺序一致（⌘3 = 键盘动效）。
*/
const WORKSPACES = [
  ['workbench', '主题与效果', '01-workbench.html', '个性化'],
  ['cursor-skin', '光标皮肤', '02-cursor-skin.html', '个性化'],
  ['keyboard', '键盘动效', '04-keyboard.html', '个性化'],
  ['app-rules', '应用规则', '03-app-rules.html', '自动化'],
  ['diagnostics', '诊断面板', '05-diagnostics.html', '系统'],
];
const WS_GROUPS = ['个性化', '自动化', '系统'];
/** 个性化组的页面在编辑「当前主题」；其余是全局设置。 */
const isThemeScoped = (id) => (WORKSPACES.find((w) => w[0] === id) || [])[3] === '个性化';
let currentWorkspace = 'workbench';

const THEMES = [
  { id: 'mono', name: '几何', kind: '内置', summary: '黑白灰 · 方块粒子 · 几何波纹', glyph: '几' },
  { id: 'drift', name: '流光', kind: '内置', summary: '轨道粒子 · 涟漪扩散 · 沉静青绿', glyph: '流' },
  { id: 'molten', name: '熔金', kind: '内置', summary: '火花喷发 · 能量脉冲 · 熔岩橙金', glyph: '熔' },
  { id: 'sunset', name: '夕霞', kind: '自定义', summary: '钻石飘落 · 回声涟漪 · 落日粉橙', glyph: '夕', dirty: true },
];

/*
  ══ 每个主题必须有**看得出区别**的种子 ══════════════════════════════

  没有区别的话，「切主题」这件事在界面上无法验证——修完和没修一模一样，
  而这正是它上一次坏掉没被发现的原因（实测切主题整页 textContent diff = 0）。

  种子直接照侧栏那四条摘要写，摘要本来就承诺了区别：
    几何：黑白灰 · 方块粒子 · 几何波纹
    流光：轨道粒子 · 涟漪扩散 · 沉静青绿
    熔金：火花喷发 · 能量脉冲 · 熔岩橙金
    夕霞：钻石飘落 · 回声涟漪 · 落日粉橙

  除外观还刻意让**时间**也有区别（熔金更快、夕霞更慢），
  这样切主题时时间轴的总长与色块位置会一起变——否则「时间属于主题」这件事
  也是没被验证过的。
*/
const THEME_SEEDS = {
  mono: {
    cards: { text: { preset: '弹跳', 颜色: '#0F172A' }, particle: { preset: '礼花', 形状: '方块', 颜色: '#0F172A', 数量: 14 }, ripple: { preset: '涟漪', 颜色: '#0F172A', 线宽: 2 } },
    ch: {},
  },
  drift: {
    cards: { text: { preset: '轻盈', 颜色: '#0D9488', 字号: 24, 上浮距离: 72 }, particle: { preset: '气泡', 形状: '圆点', 颜色: '#0D9488', 数量: 22, 扩散半径: 120 }, ripple: { preset: '涟漪', 颜色: '#0EA5E9', 线宽: 1, 最大半径: 160 } },
    ch: { ripple: { dur: 760 }, particle: { dur: 1040 } },
  },
  molten: {
    cards: { text: { preset: '爆裂', 颜色: '#F59E0B', 字号: 34 }, particle: { preset: '火花', 形状: '星形', 颜色: '#F59E0B', 数量: 28, 扩散半径: 132, 重力: 1 }, ripple: { preset: '脉冲', 颜色: '#F59E0B', 线宽: 3, 最大半径: 96 } },
    ch: { ripple: { dur: 420 }, particle: { dur: 640, repeat: { n: 28, stagger: 6 } }, text: { dur: 560, off: 20 } },
  },
  sunset: {
    cards: { text: { preset: '轻盈', 颜色: '#F43F5E', 字号: 26, 上浮距离: 88 }, particle: { preset: '尘埃', 形状: '钻石', 颜色: '#F43F5E', 数量: 18, 重力: 6 }, ripple: { preset: '回声', 颜色: '#F43F5E', 最大半径: 200 } },
    ch: { ripple: { dur: 900 }, particle: { dur: 1180 }, text: { dur: 980, off: 80 } },
  },
};
window.THEME_SEEDS = THEME_SEEDS;   // 01 从这里取（唯一真值源）

/*
  ══ 主题样张：从种子数据派生的静态签名 ══════════════════════════════

  它**不是**缩小的舞台。缩小的舞台需要把 `renderFrame()` 的时间数学复制一份过来，
  而那正是这套稿子反复付过代价的形态（「一个数出来的数和一个画下去的形状
  由两处代码分别计算，就一定会有一天不一致」）。所以这里只画**不含时间的三样**：

    · 波纹 → 一段弧，半径与线宽按种子的「最大半径 / 线宽」归一化
    · 粒子 → 三个该主题的形状与颜色（几何取自 `Ctl.SHAPE_PATH`，与舞台同源）
    · 飘字 → 一条该主题文字颜色的短线

  判据是「改了种子，样张跟着变」——这一点可验，而且它替代单字图标之后
  侧栏第一次能回答「这套主题长什么样」，而不只是「它叫什么」。

  单字图标没有删：它是**用户起的名字**（⋯ 菜单里的「换图标」在改它），
  与派生签名是两件事。收起态的 60px 轨道仍然用单字——那个尺寸下样张读不出来。
*/
function themeThumb(themeId) {
  const seed = (THEME_SEEDS[themeId] || {}).cards || {};
  const rip = seed.ripple || {}, par = seed.particle || {}, txt = seed.text || {};
  const ripColor = rip.颜色 || '#0f172a';
  const parColor = par.颜色 || '#0f172a';
  const txtColor = txt.颜色 || '#0f172a';
  // 最大半径 20–400 → 弧半径 5–13；线宽 1–8 → 0.8–2.2
  const r = 5 + Math.min(1, Math.max(0, ((rip.最大半径 ?? 120) - 20) / 380)) * 8;
  const lw = 0.8 + Math.min(1, Math.max(0, ((rip.线宽 ?? 2) - 1) / 7)) * 1.4;
  const shape = par.形状 || '圆点';
  const dots = [0, 1, 2].map((i) => {
    const a = -0.6 + i * 0.6;
    const cx = 14 + Math.cos(a) * (r + 3), cy = 14 + Math.sin(a) * (r + 3) * 0.6;
    // 几何走 Ctl 的唯一真值源；Ctl 没加载时退回圆点（样张不该成为白屏的原因）
    const geom = window.Ctl ? Ctl.shapeSvg(shape, 5, parColor) : '';
    return geom
      ? `<g transform="translate(${(cx - 2.5).toFixed(1)} ${(cy - 2.5).toFixed(1)})">${geom.replace(/<\/?svg[^>]*>/g, '')}</g>`
      : `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2" fill="${parColor}"/>`;
  }).join('');
  return `<svg viewBox="0 0 44 28" class="size-full" aria-hidden="true">`
    + `<circle cx="14" cy="14" r="${r.toFixed(1)}" fill="none" stroke="${ripColor}" stroke-width="${lw.toFixed(2)}" opacity="0.9"/>`
    + `<g style="color:${parColor}">${dots}</g>`
    + `<rect x="30" y="11" width="10" height="2.4" rx="1.2" fill="${txtColor}"/>`
    + `</svg>`;
}

// ── 主题卡的 ⋯ 菜单 ───────────────────────────────────────
//
// 原先这个 ⋯ 按钮没有任何菜单：无 handler、无菜单项，是个死控件。
// 而真实代码里有五个命令在工作（duplicateTheme / renameTheme / updateThemeIcon /
// exportTheme / deleteTheme），稿子一个都没画——按稿子重构会把它们一起丢掉。
//
// 删除的两条约束直接照 buildDeleteThemePlan 编码进来，稿子必须体现它们，
// 否则实现时会做出一个「点了删除然后报错」的按钮：
//   1. 内置主题不能删（先复制成自定义再改）
//   2. 至少保留一个主题
const THEME_ICONS = ['✦', '✧', '◆', '●', '▲', '■', '♦', '☀', '☾', '❋', '✿', '⚡'];

function closeThemeMenus() {
  document.querySelectorAll('[data-theme-pop]').forEach((n) => n.remove());
}

/**
 * 浮层统一挂到 body 上、fixed 定位。
 *
 * **z-index 解决不了祖先的 overflow。** 三个浮层（主题卡 ⋯、换图标、库 ⋯）原先都是
 * `absolute` 挂在触发元素所在的行上，而 `#themeList` 是 `overflow-y-auto`——
 * 于是靠下的行一展开菜单，「删除」那一项就被列表底边裁掉。
 * 我在 `Ctl.select` 上修过同一个 bug，却**没有按教训 #0 立刻全稿 grep 同一模式**，
 * 所以这三处又各自坏了一遍。收成一个函数才算真的修掉：
 * 以后新增浮层只要走这里，就不会再踩。
 *
 * 定位规则：默认贴在触发元素下方右对齐；下方不够就向上翻；装不下就限高内滚；再夹进边界。
 *
 * **边界默认是 `#mockWindow` 而不是浏览器视口。** 真实应用里窗口就是视口，
 * 所以「夹进视口」在稿子里模拟出来的是一个比真实窗口大得多的边界——浮层会安然
 * 飘到模拟窗口外面去，而同一个浮层在真实的 960×680 窗口里根本放不下。
 * 这与 README 记的 22 处视口断点是同一族错误：**稿子里的「视口」不是产品里的窗口。**
 *
 * 限高同理：原先只翻转不限高，于是 720×480 档下 440×418 的应用挑选浮层
 * 上下都放不下，无论朝哪翻都有一截在窗口外（实测 5 行里只看得到 2 行，
 * 连它自己的「关闭」按钮都在窗口外）。翻转解决的是「朝向」，装不下要靠限高 + 内滚。
 */
function placePopover(pop, anchor, opts = {}) {
  const gap = opts.gap ?? 4;
  document.body.appendChild(pop);
  pop.style.position = 'fixed';
  pop.style.visibility = 'hidden';
  pop.style.left = '0px';
  pop.style.top = '0px';
  pop.style.maxHeight = '';
  const boundsEl = opts.bounds === undefined ? document.getElementById('mockWindow') : opts.bounds;
  const br = boundsEl
    ? boundsEl.getBoundingClientRect()
    : { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight };
  const pad = opts.pad ?? 8;
  const ar = anchor.getBoundingClientRect();
  let { width: w, height: h } = pop.getBoundingClientRect();
  const below = br.bottom - ar.bottom - gap - pad;
  const above = ar.top - br.top - gap - pad;
  const flipUp = below < h && above > below;
  // 两个朝向都装不下才限高，并且照最宽松的那一侧给——限高一定要在算 top 之前，
  // 否则 h 还是未限制前的值，向上翻的顶边会算到边界外面去。
  const room = flipUp ? above : below;
  if (h > room) {
    pop.style.maxHeight = `${Math.max(140, room)}px`;
    pop.style.overflowY = 'auto';
    ({ width: w, height: h } = pop.getBoundingClientRect());
  }
  const top = flipUp ? ar.top - gap - h : ar.bottom + gap;
  // 右对齐触发元素；不够就贴左。两端再夹进边界，避免浮层跑到窗口外
  const wantLeft = opts.alignLeft ? ar.left : ar.right - w;
  pop.style.left = `${Math.max(br.left + pad, Math.min(wantLeft, br.right - w - pad))}px`;
  pop.style.top = `${Math.max(br.top + pad, Math.min(top, br.bottom - h - pad))}px`;
  pop.style.visibility = '';
  return pop;
}

function themeMenuItems(t) {
  const builtin = t.kind === '内置';
  const onlyOne = THEMES.length <= 1;
  const deleteBlockedBy = builtin
    ? '内置主题不能删除，先复制成自定义主题再改'
    : onlyOne ? '至少保留一个主题' : '';
  return [
    { id: 'duplicate', label: '复制为自定义主题' },
    { id: 'rename', label: '重命名' },
    { id: 'icon', label: '换图标' },
    { id: 'export', label: '导出为 .json' },
    { id: 'delete', label: '删除', danger: true, disabledReason: deleteBlockedBy },
  ];
}

function bindThemeMenus(selected) {
  document.querySelectorAll('[data-theme-menu]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = document.querySelector(`[data-theme-pop="${btn.dataset.themeMenu}"]`);
    closeThemeMenus();
    if (open) return;
    const t = THEMES.find((x) => x.id === btn.dataset.themeMenu);
    const pop = document.createElement('div');
    pop.setAttribute('data-theme-pop', t.id);
    pop.setAttribute('role', 'menu');
    pop.className = 'z-50 w-[188px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg';
    pop.innerHTML = themeMenuItems(t).map((it) => {
      const off = !!it.disabledReason;
      const tone = it.danger ? 'text-rose-600' : 'text-slate-700';
      return `<button data-menu-act="${it.id}" ${off ? 'disabled' : ''} role="menuitem"
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${off ? 'cursor-not-allowed text-slate-300' : tone + ' hover:bg-slate-50'}"
        ${off ? `title="${it.disabledReason}"` : ''}>
        <span class="min-w-0 flex-1 truncate">${it.label}</span>
        ${off ? '<span class="shrink-0 text-xs text-slate-300">不可用</span>' : ''}
      </button>`;
    }).join('');
    placePopover(pop, btn);   // 挂 body + fixed，否则被 #themeList 的 overflow-y-auto 裁掉

    pop.querySelectorAll('[data-menu-act]').forEach((mi) => mi.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const act = mi.dataset.menuAct;
      closeThemeMenus();
      if (act === 'icon') return openIconPicker(t, selected);
      const said = {
        duplicate: `已复制「${t.name}」为自定义主题`,
        rename: `重命名「${t.name}」`,
        export: `已导出「${t.name}」`,
        delete: `已删除「${t.name}」`,
      }[act];
      toast(said, () => {});
    }));
  }));
}

// 换图标：真实代码 ICON_OPTIONS 有 20 个图标，这里给出选择面的形态
function openIconPicker(t, selected) {
  closeThemeMenus();
  const anchor = document.querySelector(`[data-theme="${t.id}"] [data-theme-menu]`)
    || document.querySelector(`[data-theme="${t.id}"]`);
  if (!anchor) return;
  const pop = document.createElement('div');
  pop.setAttribute('data-theme-pop', t.id);
  pop.className = 'z-50 w-[188px] rounded-xl border border-slate-200 bg-white p-2 shadow-lg';
  pop.innerHTML = `<div class="mb-1.5 px-1 text-xs font-semibold text-slate-500">换图标</div>
    <div class="grid grid-cols-6 gap-1">
      ${THEME_ICONS.map((g) => `<button data-icon="${g}" class="grid size-7 place-items-center rounded-lg text-xs text-slate-600 transition-colors hover:bg-slate-100">${g}</button>`).join('')}
    </div>`;
  placePopover(pop, anchor);
  pop.querySelectorAll('[data-icon]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const before = t.glyph;
    t.glyph = b.dataset.icon;
    closeThemeMenus();
    renderThemes(selected);
    toast(`已把「${t.name}」的图标换成 ${t.glyph}`, () => { t.glyph = before; renderThemes(selected); });
  }));
}

document.addEventListener('click', closeThemeMenus);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeThemeMenus(); });

function shellMarkup(active, mainClass) {
  // 布局预设只对多列界面有意义；放在外壳里会让另外 4 页出现点了没反应的死控件
  const showLayout = active === 'workbench';
  /*
    当前页用 `aria-current="page"`，其余是普通链接（见上面 nav 那段注释）。

    当前项仍然是 `<button>` 而不是 `<a href="#">`：它没有目标，点它不该发生任何事。
    `aria-current` 让读屏器报「当前页」——这正是原先想用 aria-selected 表达的意思，
    而它是**跨文档导航**该用的那个属性。
  */
  const chip = (id, label, href) => (id === active
    ? `<button aria-current="page" class="ws-chip ws-chip-active">${label}</button>`
    : `<a href="${href}" class="ws-chip">${label}</a>`);

  return `
  <div id="mockWindow" class="group/win mx-auto flex flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-lg" data-w="${widthBucket(VIEWPORTS[0][2])}" style="width:${VIEWPORTS[0][2]}px;height:${VIEWPORTS[0][3]}px">
    <header class="shrink-0 border-b border-slate-200 bg-white">
      <div class="flex h-8 items-stretch pl-3">
        <div class="flex shrink-0 items-center gap-2 pr-2">
          <span class="flex items-center gap-1.5 pr-2">
            <span class="size-3 rounded-full bg-rose-400"></span>
            <span class="size-3 rounded-full bg-amber-400"></span>
            <span class="size-3 rounded-full bg-emerald-400"></span>
          </span>
          <span class="grid size-6 shrink-0 place-items-center rounded-full bg-slate-950 glyph-badge text-white">C</span>
          <div class="text-xs font-semibold leading-tight text-slate-900">CursorDance</div>
        </div>
        <!--
          ── 作用域槽 + 运行态/编辑态（ux §2 与裁决 1 的第 2 层）──

          放在标题栏而不是新开一条带子，有两个理由：
          1. ux §2 要求「当前作用域固定出现在页面标题区域，不随滚动消失」——这里就是那个位置；
          2. **纵向零成本**。01 的纵向预算刚被调到「舞台 240 = 最小值，刚好」，
             再加一条 30px 的带子会立刻把它压穿（那正是 A1 修掉的那个缺陷的成因）。
             而这条 h-8 的标题栏中间本来是一块空的 flex-1。

          左：正在编辑哪个主题（或「全局设置」）。右：桌面此刻在跑哪个 + 两个动作。
          两者一致时右侧收敛成一行「已应用到桌面」——**没有差异就不该占位**。
        -->
        <div id="scopeSlot" data-scope-slot class="flex min-w-0 flex-1 items-center gap-2 self-center px-2 text-xs"></div>
        <div id="applyGroup" class="mr-2 hidden shrink-0 items-center gap-1.5 self-center">
          <button id="applyBtn" class="h-6 rounded-lg bg-slate-900 px-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800">应用到桌面</button>
          <button id="revertBtn" class="h-6 rounded-lg px-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900" title="把草稿退回桌面正在用的那一版">恢复已应用版本</button>
        </div>
        <!--
          ── 全局暂停 / 恢复 ─────────────────────────────────────────

          这块原先是一枚写死的「✓ 已是最新」：**不受任何状态驱动**，而它就贴在
          作用域条旁边。实测改一个字段之后同一行会同时显示「未应用」和「已是最新」——
          它想说的大概是「应用版本已是最新」，但放在草稿状态旁边只会被读成配置状态。
          版本信息属于 07 的「关于」，所以整块删掉，位置让给一个真的高频动作。

          为什么是「暂停」：裁决 9 登记了一个没解的问题——桌面工具的日常循环
          （暂停 / 换场景 / 在这个应用里关掉）比"进工作台调参"高频得多，而 IA 给了
          5 个等权入口，暂停只能去托盘。放在这里不需要推翻 R1-6：它是工作台窗口内的
          一个控件，不是被取消掉的那个自绘托盘面板。

          它与「草稿 / 已应用」是**两个正交的轴**：暂停不改配置，应用不改运行开关。
          所以两者并排不打架——这正是「已是最新」做不到的事。

          三档与 09 的原生菜单**逐字一致**（20 分钟 / 1 小时 / 直到重启）：
          同一个概念在两处给不同的档位，是这份稿子反复付过代价的形态。
        -->
        <button id="pauseBtn" class="mr-2 inline-flex h-6 shrink-0 items-center gap-1.5 self-center rounded-lg px-2 text-xs font-medium transition-colors"
          aria-haspopup="menu" aria-expanded="false"></button>
      </div>
    </header>

    <div class="shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-2">
      <!--
        原先是 grid-cols-[minmax(0,1fr)_auto]：右侧工具组按 max-content 占位、
        左侧工作区导航被压到 0 再由自己的 overflow-x-auto 裁掉。
        在真实最小窗口（720px）下的表现是「主题工作台 / 光标皮肤 / 应」——
        「应用规则」被切成一个字，紧接着就是布局预设按钮，看起来像两组控件叠在一起。
        改成 flex-wrap：装不下时右侧工具组整组换到第二行。
        换行多占 32px 高度，但导航是主要动线，把它切成半个字换不来任何东西。

        注意：这段注释在 JS **模板字符串内部**，所以正文里不能出现反引号——
        它会当场终止模板字符串。我就是这么把整个 shell.js 写成语法错误、
        让五个页面一起白屏的（已加门禁 shared-js-syntax）。
      -->
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <!--
          role="tablist" 是错的，已改成 <nav> + aria-current="page"。

          ARIA 的 tab 模式要求同文档里有 role="tabpanel"，而这五个 chip 里有四个是
          <a href>、点了整页跳走（实测：5 个 role=tab、**0 个 tabpanel**）。
          （这段注释在模板字符串内部，所以正文不能写反引号——门禁刚刚为此拦了我一次。）
          读屏器会报「标签页 1/5」并等着面板在当前页出现，然后文档直接卸载。
          跨文档导航的正确形态是 nav + aria-current。

          这一条有门禁的责任：上一轮 aria-state-missing 只问「有没有状态属性」，
          没问「这个 role 用对了没有」，于是把 aria-selected 逼到了链接上，
          **把一个错的模式固化住了**。已补 nav-role-misuse 一条判据。
        -->
        <nav class="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto" aria-label="工作区">
          ${WS_GROUPS.map((g, gi) => {
            const items = WORKSPACES.filter((w) => w[3] === g);
            if (!items.length) return '';
            /*
              组标签只在 lg 档出现（原先 md 也出现）。

              分组的收益是**作用域清晰**，而那个收益由主题侧栏 / 撤销 / 草稿状态的显隐
              承担（裁决 2 的落地约束），不依赖这三个词；竖线已经把「哪几个是一组」画出来了。
              而它们在 md 档要吃掉约 120px——那一档的横向预算刚够五个 chip 排开，
              导航是这一行唯一的主动线，标签是注解。注解不该挤主动线。
            */
            return `${gi ? '<span class="h-4 w-px shrink-0 bg-slate-200"></span>' : ''}
              <span class="hidden shrink-0 whitespace-nowrap text-xs font-medium text-slate-500 group-data-[w=lg]/win:inline">${g}</span>
              ${items.map(([id, label, href]) => chip(id, label, href)).join('')}`;
          }).join('')}
        </nav>
        <div class="flex min-w-0 items-center justify-end gap-2">
          ${showLayout ? `<div class="flex h-8 items-center gap-0.5 rounded-xl bg-white px-1 shadow-sm ring-1 ring-slate-200">
            <button data-shell-layout="config" aria-pressed="false" class="layout-btn" title="专注配置" aria-label="专注配置">
              <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="12" height="16" rx="1.5"/><rect x="17" y="4" width="4" height="16" rx="1.5"/></svg>
            </button>
            <button data-shell-layout="split" aria-pressed="false" class="layout-btn" title="对半" aria-label="对半">
              <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="8" height="16" rx="1.5"/><rect x="13" y="4" width="8" height="16" rx="1.5"/></svg>
            </button>
            <button data-shell-layout="preview" aria-pressed="false" class="layout-btn" title="专注预览" aria-label="专注预览">
              <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="4" height="16" rx="1.5"/><rect x="9" y="4" width="12" height="16" rx="1.5"/></svg>
            </button>
          </div>` : ''}
          <div class="flex h-8 items-center gap-2 rounded-xl bg-white px-2.5 text-xs shadow-sm ring-1 ring-slate-200">
            <span id="saveState" class="inline-flex items-center gap-1.5 font-medium text-slate-500">
              <svg class="size-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
              <span class="hdr-label">草稿已存</span>
            </span>
            <span class="h-3 w-px bg-slate-200"></span>
            <button id="undoBtn" class="inline-flex items-center gap-1 font-medium text-slate-500 transition-colors hover:text-slate-900 disabled:opacity-40" disabled aria-label="撤销">
              <span class="hdr-label">撤销</span> <span class="kbd hdr-label">⌘Z</span>
              <svg class="hidden size-3 group-data-[w=sm]/win:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/></svg>
            </button>
            <button id="redoBtn" class="inline-flex items-center gap-1 font-medium text-slate-500 transition-colors hover:text-slate-900 disabled:opacity-40" disabled aria-label="重做">
              <svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5"/></svg>
            </button>
          </div>
          ${showLayout ? `<a href="06-ai.html" class="btn-outline h-8 px-2.5 text-xs" aria-label="AI 助手">
            <svg class="size-3.5 group-data-[w=md]/win:mr-1.5 group-data-[w=lg]/win:mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8V4H8M4 8h16v12H4zM9 16h6"/></svg>
            <span class="hdr-label">AI 助手</span> <span class="kbd ml-1.5 hdr-label">⌘J</span>
          </a>` : ''}
          <button id="cmdkBtn" class="btn-outline h-8 px-2.5 text-xs" aria-label="命令面板">
            <svg class="size-3.5 group-data-[w=md]/win:mr-1.5 group-data-[w=lg]/win:mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <span class="hdr-label">命令</span> <span class="kbd ml-1.5 hdr-label">⌘K</span>
          </button>
        </div>
      </div>
    </div>

    <div class="flex min-h-0 flex-1">
      <!--
        初始类名由 sidebarClosed 决定，而不是写死 w-[248px]。
        原先写死 → 变量改成默认收起后 DOM 完全不跟（实测 sidebarW 仍是 248、
        openPaneVisible 仍是 true）：**状态和 DOM 是两份真值**，改了一份不算改。
        bindShell 里还会再 setSidebar(sidebarClosed) 同步一次兜底。
      -->
      <aside id="sidebar" class="motion-layout flex shrink-0 flex-col border-r border-slate-200 bg-slate-100 ${sidebarClosed ? 'w-[60px]' : 'w-[248px]'}">
        <!--
          flex 类必须常在，只用 hidden 控制显隐。
          （注意：本注释在模板字符串内部，不能用反引号包代码名——会截断模板串。
           这是同一个坑的第二次，门禁两次都当场抓到了。）
          原先把 hidden 与 flex 写成三元的两个分支：默认收起时渲染出 hidden、没有 flex，
          而 setSidebar 只删 hidden 不补 flex，于是展开后 pane 退化成 display:block，
          #themeList 的 flex-1 失效 → 列表只有内容高、footer 停在半空，
          表现成「新建主题按钮抢占了主题列表的空间」。
          **同一个属性上的两个状态不能分给两处管**：markup 决定初值、JS 决定后续，
          结果就是 JS 那边不知道 markup 少给了一个类。
        -->
        <div data-side="open" class="${sidebarClosed ? 'hidden ' : ''}flex min-h-0 flex-1 flex-col">
          <!--
            顶部一条工具条：折叠 | 搜索 | ⋯ 库菜单。
            库级操作（导入 / 导出全部）收进这里的 ⋯，而不是堆在底部——
            **这一行本来就是「库」这一层**（折叠、搜索都作用于整个库），
            低频操作放进它的菜单是自然的；底部因此只剩一个干净的主按钮。
            第一版把导入导出摆在底部，和「新建主题」挤成四层视觉元素（分隔线 +
            作用域标签 + 两个分居两端的 ghost 按钮 + 内嵌 kbd 的主按钮），
            70px 高度里塞四层——那是填空，不是设计。
          -->
          <div class="flex items-center gap-1.5 px-2.5 py-2.5">
            <button data-side-toggle class="grid size-8 shrink-0 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-white" aria-label="收起主题库" title="收起主题库">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M13 9l3 3-3 3"/></svg>
            </button>
            <div class="relative min-w-0 flex-1">
              <svg class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
              <input id="themeSearch" placeholder="搜索主题" class="h-8 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-14 text-xs text-slate-700 shadow-sm placeholder:text-slate-500 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />
              <span id="themeCount" class="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 text-xs tabular-nums text-slate-500"></span>
                      <!--
                只用 hidden 的增删来控制显隐，不要同时挂 hidden 和 grid：
                Tailwind 的 display 工具类里 hidden 排在 grid 之后，两个都在时 hidden 恒胜，
                于是这个按钮永远不显示（实测 clearVisible: false）。
                这与「禁用态由 CSS 后代选择器承担、不要用 JS 改类名」是同一类陷阱：
                同一属性上叠两个工具类，结果由样式表顺序决定，不由代码顺序决定。
                注：这段注释在**模板字符串内部**，所以不能用反引号包代码名——
                会直接把模板字符串截断（我刚踩过，门禁的 shared-js-syntax 当场报了出来）。
              -->
              <button id="themeSearchClear" class="absolute right-1.5 top-1/2 hidden size-5 -translate-y-1/2 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="清空搜索">
                <svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <button data-lib-menu class="grid size-8 shrink-0 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-white" aria-label="主题库操作" aria-haspopup="menu" title="主题库：导入 / 导出">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
            </button>
          </div>
          <!--
            列表用 listbox 语义 + roving tabindex：整个列表只占**一个** Tab 位，
            进来之后用 ↑↓ 走。行是 div[role=option] 而不是 button——
            行内还有一个 ⋯ 按钮，做成 button 就是 button 套 button
            （README 已经为 ThemeCard 修过一次这个 a11y 缺陷，不能再犯第二次）。
          -->
          <div id="themeList" role="listbox" aria-label="主题库" class="min-h-0 flex-1 space-y-1 overflow-y-auto px-2.5 pb-2"></div>
          <!--
            底部只留一个主操作。⌘N 不再塞进按钮内部——图标 + 文字 + kbd 三种元素
            靠 ml-auto 撑开会把按钮显得中空；快捷键提示放 title 与 ⋯ 菜单里，
            按钮本身保持一个重心。
          -->
          <div class="shrink-0 border-t border-slate-200 px-2.5 py-2.5">
            <button data-lib-new class="btn-outline h-8 w-full justify-center px-3 text-xs" title="新建主题（⌘N）">
              <svg class="mr-1.5 size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              新建主题…
            </button>
          </div>
        </div>
        <div data-side="closed" class="${sidebarClosed ? '' : 'hidden '}flex min-h-0 flex-1 flex-col items-center gap-2 px-2 py-2.5">
          <button data-side-toggle class="grid size-9 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-white" aria-label="展开主题库">
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M16 9l-3 3 3 3"/></svg>
          </button>
          <button data-side-search class="grid size-9 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-white" aria-label="搜索主题" title="搜索主题">
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          </button>
          <div class="my-0.5 h-px w-6 bg-slate-200"></div>
          <div id="themeRail" role="radiogroup" aria-label="主题" class="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto"></div>
          <!--
            折叠态原先**只有**折叠钮 + 搜索图标 + 主题轨——**没法新建主题、也没法导入导出**。
            而默认态就是折叠态，等于「默认打开的界面里没有新建入口」。
            决策 #5 的后半句只说了「折叠态保留搜索入口」，这一条比它更硬：
            折叠不能让任何操作变得不可达，只能让它更小。
            搜索图标点了会先展开再聚焦搜索框——在 60px 宽里放输入框不现实，
            但「点搜索 → 什么也没发生」是死控件。
          -->
          <div class="mt-auto flex shrink-0 flex-col items-center gap-1 border-t border-slate-200 pt-2">
            <button data-lib-new class="grid size-9 place-items-center rounded-xl text-slate-600 transition-colors hover:bg-white" aria-label="新建主题" title="新建主题（⌘N）">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
            </button>
            <button data-lib-menu class="grid size-9 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-white" aria-label="主题库操作" aria-haspopup="menu" title="主题库：导入 / 导出">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
            </button>
          </div>
        </div>
      </aside>

      <main id="main" class="${mainClass}"></main>
    </div>
  </div>

  <div id="cmdk" class="fixed inset-0 z-50 hidden">
    <div class="absolute inset-0 bg-slate-950/30" data-cmdk-backdrop></div>
    <div class="absolute left-1/2 top-24 w-[520px] -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
      <div class="flex items-center gap-2.5 border-b border-slate-100 px-3.5 py-3">
        <svg class="size-4 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="cmdkInput" role="combobox" aria-expanded="true" aria-controls="cmdkList" aria-autocomplete="list" aria-label="搜索主题、动作、设置" placeholder="搜索主题、动作、设置…" class="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-500" />
        <span class="kbd">esc</span>
      </div>
      <div id="cmdkList" role="listbox" aria-label="命令" class="max-h-[380px] overflow-y-auto p-1.5"></div>
      <div class="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-3.5 py-2 text-xs text-slate-500">
        <span>↑↓ 选择 · ↵ 执行</span><span>⌘1–5 直接切换工作区</span>
      </div>
    </div>
  </div>

  <!--
    ══ 新建主题对话框 ══════════════════════════════════════════════
    这一整个界面**原先不存在**：「新建主题」按钮点了直接冒一条 toast，
    等于凭空出现一个主题——而新建至少要决定三件事（叫什么、什么图标、从哪儿起步），
    这三件事没有任何地方可以填。缺的是一个界面，不是一个按钮。

    为什么必须有「起点」这一段：从零白手起家配一套主题是 ~390 个决策，
    没人会那么干；真实用法是「照着熔金改一版」。所以起点默认是**复制当前主题**，
    而不是空白——把最常见的路径放在默认值上。
    「从内置派生」和「复制当前」不是一回事：当前主题可能已经被改过，
    派生取的是内置的出厂状态，这是「我改坏了想回到干净版本」的入口。

    校验就近内联（决策 #7 的第三分工），不弹第二层对话框：
    重名不是错误、只是需要提示，因为主题名允许重复（真实代码里 id 才是唯一键）。
  -->
  <div id="newTheme" class="fixed inset-0 z-50 hidden">
    <div class="absolute inset-0 bg-slate-950/30" data-newtheme-backdrop></div>
    <div class="absolute left-1/2 top-1/2 w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg" role="dialog" aria-modal="true" aria-labelledby="newThemeTitle">
      <div class="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <span id="newThemeTitle" class="text-sm font-medium text-slate-900">新建主题</span>
        <span class="kbd">esc</span>
      </div>

      <div class="space-y-3.5 px-4 py-3.5">
        <div>
          <label for="ntName" class="mb-1.5 block text-xs font-medium text-slate-500">名称</label>
          <input id="ntName" class="h-8 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />
          <p id="ntNameHint" class="mt-1 hidden text-xs leading-relaxed text-amber-700"></p>
        </div>

        <div>
          <span class="mb-1.5 block text-xs font-medium text-slate-500">图标</span>
          <div id="ntIcons" class="grid grid-cols-12 gap-1"></div>
        </div>

        <div>
          <span class="mb-1.5 block text-xs font-medium text-slate-500">起点</span>
          <div id="ntSeed" class="space-y-1"></div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
        <button data-nt-cancel class="btn-ghost h-8 px-3 text-xs">取消</button>
        <button data-nt-create class="btn-default h-8 px-3 text-xs">创建<span class="kbd ml-1.5">↵</span></button>
      </div>
    </div>
  </div>

  <!--
    ══ 导入主题对话框 ═══════════════════════════════════════════
    原先「导入」点了直接冒一条 toast、凭空多出一个主题——**用户没有任何把 .json
    放进来的路径**，也看不到文件里有什么。这是个假闭环。

    真实的导入必须回答四个问题，缺一个就会出现「导入了但不知道导入了什么」：
      1. 文件从哪来  → 拖放区 + 选择文件（两条路都要，拖放是最快的，
                        但不能只有拖放：键盘用户没法拖）
      2. 里面有什么  → 逐条列出主题包内容（名称 / 图标 / 已配置动作数）
      3. 要哪些      → 逐条勾选。一个包可能含 5 个主题而用户只想要 1 个
      4. 冲突怎么办  → 重名与版本不兼容分开处理：
                        重名 → 三选一（保留两个 / 覆盖 / 跳过）
                        版本不兼容 → **不给选择**，只能跳过并说明原因，
                        因为让用户"强行导入"一个读不了的包只会得到一个坏主题
    第 4 点是这个界面存在的主要理由：前三点勉强能用文件选择器凑，冲突不行。
  -->
  <div id="importTheme" class="fixed inset-0 z-50 hidden">
    <div class="absolute inset-0 bg-slate-950/30" data-import-backdrop></div>
    <div class="absolute left-1/2 top-1/2 flex max-h-[560px] w-[460px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg" role="dialog" aria-modal="true" aria-labelledby="impTitle">
      <div class="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <span id="impTitle" class="text-sm font-medium text-slate-900">导入主题</span>
        <span class="kbd">esc</span>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
        <!-- 阶段一：还没有文件 -->
        <div data-imp-stage="empty">
          <div id="impDrop" class="grid place-items-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center transition-colors">
            <svg class="mb-2 size-7 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 15V3M7 10l5 5 5-5M5 21h14"/></svg>
            <div class="text-xs font-medium text-slate-700">把 .json 主题包拖到这里</div>
            <div class="mt-1 text-2xs text-slate-500">或者</div>
            <button data-imp-pick class="btn-outline mt-2 h-7 px-2.5 text-xs">选择文件…</button>
            <p class="mt-3 max-w-[300px] text-2xs leading-relaxed text-slate-500">
              一个包可以含多个主题。导入前会先列出内容，由你逐条勾选。
            </p>
          </div>
        </div>

        <!-- 阶段二：已解析出内容 -->
        <div data-imp-stage="parsed" class="hidden">
          <div class="mb-2.5 flex items-baseline justify-between gap-2">
            <span class="min-w-0 truncate text-xs text-slate-500" id="impFileName"></span>
            <span class="shrink-0 text-xs text-slate-500">              <button data-imp-all class="font-medium text-slate-600 underline underline-offset-2">全选</button>
              ·
              <button data-imp-none class="font-medium text-slate-600 underline underline-offset-2">全不选</button>
            </span>
          </div>
          <div id="impList" class="space-y-1.5"></div>
        </div>
      </div>

      <div class="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
        <span id="impSummary" class="min-w-0 truncate text-xs text-slate-500"></span>
        <span class="flex shrink-0 items-center gap-2">
          <button data-imp-cancel class="btn-ghost h-8 px-3 text-xs">取消</button>
          <button data-imp-confirm class="btn-default h-8 px-3 text-xs" disabled>导入</button>
        </span>
      </div>
    </div>
  </div>

  <div id="toastHost" class="pointer-events-none fixed left-1/2 top-4 z-50 flex -translate-x-1/2 flex-col gap-2"></div>`;
}

const COMMANDS = [
  ['工作区', [['切到主题工作台', '⌘1'], ['切到光标皮肤', '⌘2'], ['切到应用规则', '⌘3'], ['切到键盘动效', '⌘4'], ['切到诊断面板', '⌘5']]],
  ['主题', [['切换到 流光', ''], ['切换到 熔金', ''], ['新建主题', '⌘N'], ['导出当前主题', ''], ['恢复主题默认', '']]],
  ['编辑', [['撤销上一步', '⌘Z'], ['重做', '⌘⇧Z'], ['打开 AI 助手', '⌘J']]],
];

/**
 * 页面可以往命令面板里注册条目。
 * 这是「显示全部 N 项」的真正解法：一套主题约 390 个配置决策，任何分组都不如
 * 直接搜字段名。items 形如 [label, hintKey, onRun]。
 */
const EXTRA = [];
function registerCommands(group, items) {
  const i = EXTRA.findIndex((g) => g[0] === group);
  if (i >= 0) EXTRA[i] = [group, items]; else EXTRA.push([group, items]);
}
const allCommands = () => [...EXTRA, ...COMMANDS];

// 撤销栈按主题分桶：在主题 A 改了 3 步、切到 B 再按 ⌘Z，撤销 A 的改动是错的。
// 同时提供重做——自动保存模型下没有重做是不完整的。
let currentThemeId = 'mono';
const historyByTheme = new Map();
function hist() {
  if (!historyByTheme.has(currentThemeId)) historyByTheme.set(currentThemeId, { undo: [], redo: [] });
  return historyByTheme.get(currentThemeId);
}

/**
 * 尺寸切换条。放在原型状态条之上，因为它比原型状态更根本：
 * 原型状态问「数据是什么样」，尺寸问「用户的窗口有多大」，
 * 而后者会让前者的每一种状态呈现出不同的装得下 / 装不下。
 */
let viewportId = VIEWPORTS[0][0];
function mountViewportBar() {
  const app = document.getElementById('app');
  if (!app || document.getElementById('viewportBar')) return;
  const bar = document.createElement('div');
  bar.id = 'viewportBar';
  bar.className = 'mx-auto mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2';
  bar.style.width = `${VIEWPORTS[0][2]}px`;
  bar.innerHTML = '<span class="vp-label">窗口尺寸</span>'
    + `<div class="seg-group" role="radiogroup" aria-label="窗口尺寸">${VIEWPORTS.map(([id, label]) => `<button data-vp="${id}" role="radio" aria-checked="${id === viewportId}" class="seg-item${id === viewportId ? ' seg-item-on' : ''}">${label}</button>`).join('')}</div>`
    + '<span id="viewportNote" class="vp-note"></span>';
  app.parentNode.insertBefore(bar, app);
  bar.querySelectorAll('[data-vp]').forEach((b) => b.addEventListener('click', () => applyViewport(b.dataset.vp)));
  paintViewportNote(viewportId);   // 初始档也要有说明，否则默认状态下这一行是空的
}
const VIEWPORT_NOTES = {
  default: ['真实桌面端默认窗口（workbench-window.ts）', 'vp-note'],
  large: ['这套设计最舒展时的样子，但它不是默认', 'vp-note'],
  min: ['Electron 允许拖到的最小尺寸——这一档暴露的是必须提高 minWidth/minHeight 的证据', 'vp-note-warn'],
};
function paintViewportNote(id) {
  const note = document.getElementById('viewportNote');
  if (!note) return;
  const [text, cls] = VIEWPORT_NOTES[id] || ['', 'vp-note'];
  note.textContent = text;
  note.className = cls;
}
function applyViewport(id) {
  const vp = VIEWPORTS.find((v) => v[0] === id);
  if (!vp) return;
  viewportId = id;
  const [, label, w, h] = vp;
  const win = document.getElementById('mockWindow');
  if (win) { win.style.width = `${w}px`; win.style.height = `${h}px`; win.dataset.w = widthBucket(w); }
  ['viewportBar', 'proto'].forEach((k) => { const el = document.getElementById(k); if (el && el.style) el.style.width = `${w}px`; });
  document.querySelectorAll('#viewportBar [data-vp]').forEach((b) => {
    const on = b.dataset.vp === id;
    b.classList.toggle('seg-item-on', on);
    b.setAttribute('aria-checked', String(on));
  });
  paintViewportNote(id);
  // 页面里凡是**按实测几何**定位的东西（01 的播放头就是）都必须重算。
  // 顺带修掉一个真实缺陷：原先没人监听 resize，拖动真实窗口后播放头会留在旧像素位置。
  // 切换尺寸档等于「换了一台机器」，所以重新判一次侧栏该不该折叠
  sidebarAutoDecided = false;
  autoCollapseSidebarIfNarrow();
  window.dispatchEvent(new Event('resize'));
  window.dispatchEvent(new CustomEvent('viewportchange', { detail: { id, label, w, h } }));
}

function mountShell(opts) {
  const { active, proto = [], onProto, hint = '', mainClass = 'min-w-0 flex-1 overflow-y-auto bg-slate-50 px-3 py-3' } = opts;
  currentWorkspace = active;

  // 原型状态切换条（不属于产品 UI）
  const protoHost = document.getElementById('proto');
  if (protoHost && proto.length) {
    protoHost.className = 'mx-auto mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-900 px-3 py-2';
    protoHost.style.width = `${VIEWPORTS[0][2]}px`;
    protoHost.setAttribute('role', 'radiogroup');
    protoHost.setAttribute('aria-label', '原型状态');
    protoHost.innerHTML = `<span class="proto-label">原型状态</span>`
      + proto.map(([id, label]) => `<button data-proto="${id}" role="radio" aria-checked="false" class="proto-btn">${label}</button>`).join('')
      + `<span class="proto-note">${hint}</span>`;
  }

  mountViewportBar();

  const app = document.getElementById('app');
  app.innerHTML = shellMarkup(active, mainClass);

  const tpl = document.getElementById('page');
  if (tpl) document.getElementById('main').append(tpl.content.cloneNode(true));

  renderThemes();
  bindShell(proto, onProto);
  syncHistoryUi();
  bindApplyButtons();
  applyScopeChrome();
  syncScope();
  bindPause();
  syncPause();
  // 切主题要重算作用域条（「桌面正在用」与「未应用」都跟着主题变）
  window.addEventListener('themechange', syncScope);
  // 初始状态延到下一个宏任务：外壳必须先把 DOM 注入（页面脚本顶层要查询它），
  // 而页面的 onProto 处理函数是在后面的 <script> 里声明的，同步调用会 ReferenceError。
  if (proto.length) setTimeout(() => setProto(proto[0][0], proto, onProto), 0);
}

/**
 * 侧栏搜索。原先搜索框是个**裸 `<input>`，没有任何监听**——输进去什么都不会发生，
 * 是典型的「画了控件没接线」，而它恰好又是折叠态唯一保留的入口（决策 #5 的后半句）。
 *
 * 匹配范围包含摘要，不只是主题名：用户记得住的往往是「那个有火花的」
 * 而不是「熔金」。命中处高亮，让人看清为什么这条被留下。
 */
let themeQuery = '';
const themeMatches = (t) => {
  if (!themeQuery) return true;
  const q = themeQuery.toLowerCase();
  return `${t.name} ${t.summary} ${t.kind}`.toLowerCase().includes(q);
};
const markHit = (text) => {
  if (!themeQuery) return text;
  const i = text.toLowerCase().indexOf(themeQuery.toLowerCase());
  if (i < 0) return text;
  return `${text.slice(0, i)}<mark class="rounded bg-amber-100 text-slate-900">${text.slice(i, i + themeQuery.length)}</mark>${text.slice(i + themeQuery.length)}`;
};

/**
 * 当前生效的主题，暴露给页面。
 *
 * 原先 `selected` 只是 `renderThemes` 的一个局部参数，外面读不到——于是 `03` 的
 * 每行主题选择器只能写死一句「跟随全局」，而「全局是哪个」是那一页唯一会被问到的问题。
 * 实测在侧栏把主题从「几何」切到「流光」，`03` 整页纹丝不动。
 * 这与 `09` 的「切主题后状态行说谎」（README 缺陷 19）是同一族：
 * **同一个值在两处显示而只有一处会更新。** 收成一个真值源 + 一个事件。
 */
let activeThemeId = 'mono';
const activeTheme = () => THEMES.find((t) => t.id === activeThemeId) || THEMES[0];
window.activeTheme = activeTheme;

/*
  ══ 按主题分桶的编辑状态 ══════════════════════════════════════════

  为什么必须有这一层：撤销栈已经**按主题分桶**了（historyByTheme），
  也就是说这套设计的前提是「每个主题有自己的编辑状态」。而页面把
  CARDS / CH / TRIGGER 放在模块作用域，是**一份全局状态**。两个模型互相矛盾，
  实测出来的后果是一条闭环：

    1. 在「几何」里把波纹 涟漪 → 回声
    2. 切到「流光」：**回声还在**，而撤销按钮变成「没有可撤销的改动」（disabled）
       → 用户看着一个自己改不回去的值
    3. 切回「几何」撤销 → 涟漪
    4. 再切「流光」：**它也变回涟漪了**

  即：主题只是个标签，而撤销栈假设它是数据。这与 README 已经修过两次的
  「同一个值在两处显示而只有一处会更新」（03 缺陷 30 / 09 缺陷 19）同源，
  只是这一次错的那一处是**最重要的那一页**。

  实现刻意做得很薄：一个 Map + 一个懒初始化的 factory。
  页面只需要在 themechange 时把自己的引用重新指向新桶并重渲染。
*/
/*
  ══ 运行态 与 编辑态（DECISIONS.md 裁决 1 的第 2 层）══════════════════

  桌面端「编辑」就是在**实时改变你此刻正在用的桌面**：演示中拖一下「粒子数量」，
  满屏真的多出粒子。README 决策 #1 删掉「保存」按钮删对了——那是「保存到磁盘」的焦虑；
  但它连带删掉的是**「发布到运行时」这个开关**，而这两件事在桌面端完全不同。

  兜底手段也撑不住「撤销是唯一的后悔手段」：真实代码 `undoStack.ts:23` 的
  `UNDO_MAX_DEPTH = 40`，且是内存态、不跨重启。

  模型刻意做得很小：
    appliedThemeId  桌面此刻在跑哪个主题
    dirtyThemes     哪些主题的草稿还没应用过
  真正的配置快照由页面自己管（它们才知道自己的状态形状），
  通过 registerRuntimeBridge 把 snapshot/restore 交给外壳调用。
  **没注册桥的页面不显示「恢复已应用版本」**——一个按了没反应的按钮比没有更糟。
*/
let appliedThemeId = 'mono';
/*
  拆开运行态与编辑态之后，「全局主题」这个说法有了**两个可能的指代**，
  而应用规则里那句「跟随全局」显然指的是**桌面此刻真正在跑的那个**——
  规则决定的是运行时行为，不是我正在编辑的草稿。

  所以 `03` 必须读 appliedTheme() 而不是 activeTheme()。
  不区分的话会得到一个很难查的谎：我在工作台把主题切到「流光」准备调参（还没应用），
  应用规则页立刻显示「跟随全局 → 流光」，而桌面上跑的还是几何。
  这与 README 缺陷 19 / 30 是同一族——同一个词在两处指不同的东西。
*/
const appliedTheme = () => THEMES.find((t) => t.id === appliedThemeId) || THEMES[0];
window.appliedTheme = appliedTheme;
const dirtyThemes = new Set();
let runtimeBridge = null;
window.registerRuntimeBridge = (bridge) => { runtimeBridge = bridge; syncScope(); };

/** 页面每次改动后调用（`touch()` 里已经统一调了，页面不必自己记得）。 */
function markDraftDirty() {
  if (!isThemeScoped(currentWorkspace)) return;   // 全局页面的改动不进主题草稿
  dirtyThemes.add(activeThemeId);
  syncScope();
}

/*
  ══ 全局暂停 / 恢复 ═══════════════════════════════════════════════

  运行时开关，与「草稿 / 已应用」正交：暂停不改配置，应用不改运行开关。

  状态放 sessionStorage：它是**全局运行态**，跨页导航不该丢
  （侧栏收起状态也是这么持久化的，决策 #5）。而 localStorage 会跨会话留下来，
  那就变成「上次退出时暂停了，这次打开还是暂停」——一个自己不会恢复的暂停
  比没有暂停更糟。

  三档与 `09` 的原生菜单逐字一致：20 分钟 / 1 小时 / 直到重启。
  同一个概念在两处给不同档位，是这份稿子反复付过代价的形态。
*/
const PAUSE_TIERS = [[20, '20 分钟'], [60, '1 小时'], [0, '直到重启']];
const PAUSE_KEY = 'cd.spec.pause';
let pauseTimer = 0;

function readPause() {
  try { return JSON.parse(sessionStorage.getItem(PAUSE_KEY)) || { on: false, until: null }; }
  catch { return { on: false, until: null }; }
}
function writePause(v) {
  try { sessionStorage.setItem(PAUSE_KEY, JSON.stringify(v)); } catch { /* 隐私模式下写不进去，不该因此崩 */ }
}

/** 剩余分秒。到点自动恢复——一个说了「20 分钟」却不自己回来的暂停是在说谎。 */
function pauseLabel(p) {
  if (!p.on) return '效果开着';
  if (!p.until) return '已暂停 · 直到重启';
  const left = p.until - Date.now();
  if (left <= 0) return null;                    // 到点：调用方负责恢复
  const m = Math.floor(left / 60000), sec = Math.floor((left % 60000) / 1000);
  return `已暂停 · ${m}:${String(sec).padStart(2, '0')} 后恢复`;
}

function syncPause() {
  const btn = document.getElementById('pauseBtn');
  /*
    清理必须排在**所有** return 之前。

    `09` 的 startPause 把 clearInterval 写在「直到重启」那条早退之后，
    于是「先暂停 20 分钟、再改成直到重启」会留下一个还在跑的旧倒计时，
    1.3 秒后把「直到重启」覆写成 19:59，到点还擅自把 paused 置回 false。
    门禁 interval-cleanup-after-early-return 就是为这个加的——这里不重犯。
  */
  clearInterval(pauseTimer);
  pauseTimer = 0;
  if (!btn) return;

  const p = readPause();
  const label = pauseLabel(p);
  if (label === null) {                          // 计时到点，自动恢复
    writePause({ on: false, until: null });
    return syncPause();
  }
  btn.className = 'mr-2 inline-flex h-6 shrink-0 items-center gap-1.5 self-center rounded-lg px-2 text-xs font-medium transition-colors '
    + (p.on
      ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900');
  btn.innerHTML = (p.on
    ? '<svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 5v14M15 5v14"/></svg>'
    : '<svg class="size-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 4l12 8-12 8z"/></svg>')
    + `<span class="whitespace-nowrap">${label}</span>`;
  btn.title = p.on ? '点击立即恢复' : '点击选择暂停时长（与托盘菜单同一组档位）';
  btn.setAttribute('aria-label', label);
  // 有倒计时才需要秒级刷新；「直到重启」和启用态都不需要（省一个空转的 interval）
  if (p.on && p.until) pauseTimer = setInterval(syncPause, 1000);
}

function bindPause() {
  const btn = document.getElementById('pauseBtn');
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const p = readPause();
    // 暂停中 → 一键恢复。**恢复是最急的那个动作，不该再让人从菜单里挑一次。**
    if (p.on) {
      writePause({ on: false, until: null });
      syncPause();
      toast('效果已恢复', null, { draft: false });   // 运行开关不是配置改动（裁决 1）
      return;
    }
    const pop = document.createElement('div');
    pop.setAttribute('role', 'menu');
    pop.className = 'z-50 w-[168px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg';
    pop.innerHTML = '<div class="px-3 py-1 text-2xs font-medium text-slate-500">临时暂停 · 演示时最常用</div>'
      + PAUSE_TIERS.map(([m, label]) => `<button data-tier="${m}" role="menuitem" class="row-menu-item">${label}</button>`).join('');
    placePopover(pop, btn);   // 挂 body + fixed：标题栏祖先有 overflow-hidden，absolute 会被裁
    btn.setAttribute('aria-expanded', 'true');
    pop.querySelectorAll('[data-tier]').forEach((mi) => mi.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const m = Number(mi.dataset.tier);
      writePause({ on: true, until: m ? Date.now() + m * 60000 : null });
      pop.remove();
      btn.setAttribute('aria-expanded', 'false');
      syncPause();
      toast(m ? `已暂停 ${m} 分钟` : '已暂停，直到重启', null, { draft: false });
    }));
  });
}

function syncScope() {
  const slot = document.getElementById('scopeSlot');
  if (!slot) return;
  const themeScoped = isThemeScoped(currentWorkspace);
  const applyGroup = document.getElementById('applyGroup');

  if (!themeScoped) {
    // 全局作用域：主题侧栏 / 撤销 / 草稿状态**全部收掉**（裁决 2）。
    // 留任何一个都会重新制造「这一页到底在改哪个主题」的歧义。
    slot.innerHTML = '<span class="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-0.5 font-medium text-slate-600">'
      + '<svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>'
      + '全局设置</span><span class="truncate text-slate-500">不属于任何主题</span>';
    applyGroup.classList.add('hidden');
    applyGroup.classList.remove('flex');
    return;
  }

  const editing = activeTheme();
  const applied = THEMES.find((t) => t.id === appliedThemeId) || THEMES[0];
  const dirty = dirtyThemes.has(activeThemeId);
  const inSync = !dirty && appliedThemeId === activeThemeId;

  slot.innerHTML = `<span class="truncate font-medium text-slate-700">正在编辑：${editing.name}</span>`
    + (inSync
      ? '<span class="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-slate-500">'
        + '<svg class="size-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>'
        + '已应用到桌面</span>'
      : `<span class="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 ring-1 ring-amber-200">未应用</span>`
        + `<span class="hidden shrink-0 whitespace-nowrap text-slate-500 group-data-[w=lg]/win:inline">桌面正在用：${applied.name}</span>`);

  applyGroup.classList.toggle('hidden', inSync);
  applyGroup.classList.toggle('flex', !inSync);
  const revert = document.getElementById('revertBtn');
  // 没有页面桥就没有可恢复的东西——不画这个按钮，而不是画一个点了没反应的
  if (revert) revert.classList.toggle('hidden', !runtimeBridge);
}
window.syncScope = syncScope;

/*
  全局作用域的页面（应用规则 / 诊断面板）要收掉三样：主题侧栏、撤销/重做、草稿状态。

  三样必须**一起**收。只收侧栏留着撤销，用户会问「撤销的是哪个主题的改动」；
  只收撤销留着侧栏，就是缺陷 30 的原样（一个全局页面上摆着选中的主题）。
  ux §3 的原话是「进入自动化或系统时，主内容获得完整页面宽度」——
  那句话的**实质**是这三样都不属于这两页。
*/
function applyScopeChrome() {
  if (isThemeScoped(currentWorkspace)) return;
  document.getElementById('sidebar')?.remove();
  // 撤销/重做/草稿状态共处一个胶囊，整块移除；否则会留下一个空壳描边
  document.getElementById('saveState')?.closest('div')?.remove();
}

function bindApplyButtons() {
  const apply = document.getElementById('applyBtn');
  const revert = document.getElementById('revertBtn');
  if (apply) apply.addEventListener('click', () => {
    const from = appliedThemeId;
    const wasDirty = dirtyThemes.has(activeThemeId);
    appliedThemeId = activeThemeId;
    dirtyThemes.delete(activeThemeId);
    runtimeBridge?.snapshot?.();
    syncScope();
    // 「桌面正在跑哪个」变了，凡是读 appliedTheme() 的页面都要跟着变
    // （03 的「跟随全局」就读它）。同一个值在两处显示而只有一处更新，
    // 是这份稿子出现最多次的缺陷，所以新增第二个消费者时就把事件建好。
    window.dispatchEvent(new CustomEvent('appliedthemechange', { detail: appliedTheme() }));
    const undo = () => {
      appliedThemeId = from;
      if (wasDirty) dirtyThemes.add(activeThemeId);
      syncScope();
      return () => { appliedThemeId = activeThemeId; dirtyThemes.delete(activeThemeId); syncScope(); return undo; };
    };
    toast(`已把「${activeTheme().name}」应用到桌面`, undo, { draft: false });
  });
  if (revert) revert.addEventListener('click', () => {
    if (!runtimeBridge) return;
    runtimeBridge.restore?.();
    dirtyThemes.delete(activeThemeId);
    syncScope();
    toast(`已退回桌面正在用的那一版`, undefined, { draft: false });
  });
}

const themeBuckets = new Map();
function themeState(themeId, factory) {
  if (!themeBuckets.has(themeId)) themeBuckets.set(themeId, factory(themeId));
  return themeBuckets.get(themeId);
}
window.themeState = themeState;
/** 页面注册「切主题了」的回调。立刻拿到一次当前值，省掉各页自己写初始化。 */
window.onThemeChange = (fn) => {
  window.addEventListener('themechange', (e) => fn(e.detail));
  return fn(activeTheme());
};

function renderThemes(selected = 'mono') {
  const changed = selected !== activeThemeId;
  activeThemeId = selected;
  if (changed) window.dispatchEvent(new CustomEvent('themechange', { detail: activeTheme() }));
  const list = document.getElementById('themeList');
  const rail = document.getElementById('themeRail');
  const shown = THEMES.filter(themeMatches);
  const countEl = document.getElementById('themeCount');
  if (countEl) countEl.textContent = themeQuery ? `${shown.length} / ${THEMES.length}` : '';
  if (list && themeQuery && !shown.length) {
    // 三种空态语义不同（同第 1 批 A 的 EmptyState 分类）：这里是「被筛掉了」，
    // 所以下一步动作是「清空搜索」，不是「新建主题」。
    list.innerHTML = `<div class="mt-6 px-1 text-center">
      <div class="text-xs font-medium text-slate-600">没有匹配「${themeQuery}」的主题</div>
      <div class="mt-1 text-xs leading-relaxed text-slate-500">名称、摘要、内置/自定义都会被搜到</div>
      <button data-clear-search class="btn-outline mt-2.5 h-7 px-2.5 text-xs">清空搜索</button>
    </div>`;
    list.querySelector('[data-clear-search]').addEventListener('click', () => {
      themeQuery = '';
      const input = document.getElementById('themeSearch');
      if (input) input.value = '';
      renderThemes(selected);
    });
    if (rail) rail.innerHTML = '';
    return;
  }
  // 紧凑卡：摘要一行截断。折两行时一张卡 ~100px、五张就 500px，
  // 而侧栏的任务是「快速切主题」——一屏看得见几个比每条摘要读全更重要。
  // 名称与图标永不截断（它们是身份），摘要截断但 title 存全文（可查证）。
  // roving tabindex：整个列表只占一个 Tab 位，选中的那行才是 0，其余 -1。
  if (list) list.innerHTML = shown.map((t) => `
    <div data-theme="${t.id}" role="option" aria-selected="${t.id === selected}" tabindex="${t.id === selected ? 0 : -1}"
      class="side-theme${t.id === selected ? ' side-theme-on' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
      <span class="grid h-8 w-11 shrink-0 place-items-center overflow-hidden rounded-lg border ${t.id === selected ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50'}" title="${t.name} 的效果样张（由主题数据派生）">${themeThumb(t.id)}</span>
      <span class="min-w-0 flex-1">
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="min-w-0 truncate text-xs font-medium text-slate-900">${markHit(t.name)}</span>
          ${t.dirty ? '<span class="size-1.5 shrink-0 rounded-full bg-amber-400" title="有未保存的改动"></span>' : ''}
          ${t.kind === '自定义' ? '<span class="ml-auto shrink-0 text-xs font-medium text-slate-500">自定义</span>' : ''}
        </span>
        <span class="mt-px block truncate text-2xs text-slate-500" title="${t.summary}">${markHit(t.summary)}</span>
      </span>
      <button data-theme-menu="${t.id}" tabindex="-1" class="grid size-6 shrink-0 place-items-center rounded-lg text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="${t.name} 更多操作" aria-haspopup="menu">
        <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
      </button>
    </div>`).join('');
  if (list) bindThemeMenus(selected);
  if (rail) rail.innerHTML = shown.map((t) => `
    <button data-theme="${t.id}" role="radio" aria-checked="${t.id === selected}" class="relative grid size-10 shrink-0 place-items-center rounded-xl border ${t.id === selected ? 'border-slate-950 bg-white shadow-sm' : 'border-slate-200 bg-white'}" title="${t.name}" aria-label="选择主题 ${t.name}">
      <span class="grid size-7 place-items-center rounded-lg glyph-badge ${t.id === selected ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-500'}">${t.glyph}</span>
      ${t.dirty ? '<span class="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-400 ring-2 ring-slate-100"></span>' : ''}
    </button>`).join('');
  document.querySelectorAll('[data-theme]').forEach((el) => el.addEventListener('click', (e) => {
    if (e.target.closest('button[aria-label*="更多"]')) return;
    const id = el.dataset.theme;
    renderThemes(id);
    setHistoryTheme(id);
    const h = hist();
    if (h.undo.length) toast(`已切到「${THEMES.find((t) => t.id === id).name}」· 该主题有 ${h.undo.length} 步可撤销`);
  }));
}

function setProto(id, proto, onProto) {
  document.body.dataset.proto = id;
  document.querySelectorAll('.proto-btn').forEach((b) => {
    const on = b.dataset.proto === id;
    // 只切「要变的那一个类」+ 同步 aria：原先整串 className 重建，
    // 基础类与 _src.css 里的 .proto-btn 各写一份，改一处必然漏另一处
    b.classList.toggle('proto-btn-on', on);
    b.setAttribute('aria-checked', String(on));
  });
  document.querySelectorAll('[data-show]').forEach((el) => {
    el.classList.toggle('hidden', !el.dataset.show.split(' ').includes(id));
  });
  onProto?.(id);
}

// ── 新建主题对话框 ────────────────────────────────────────
let ntIcon = '✦';
let ntSeed = 'copy';   // 默认「复制当前主题」：白手起家不是真实用法
const nextUntitled = () => {
  const used = THEMES.filter((t) => /^未命名主题/.test(t.name)).length;
  return used ? `未命名主题 ${used + 1}` : '未命名主题';
};
function openNewTheme() {
  const box = document.getElementById('newTheme');
  if (!box) return;
  ntIcon = '✦'; ntSeed = 'copy';
  const name = document.getElementById('ntName');
  name.value = nextUntitled();
  renderNtIcons(); renderNtSeed(); validateNt();
  box.classList.remove('hidden');
  // 全选而不是把光标放末尾：默认名是占位符，用户几乎总是要整个替掉
  name.focus(); name.select();
}
const closeNewTheme = () => document.getElementById('newTheme')?.classList.add('hidden');
function renderNtIcons() {
  const host = document.getElementById('ntIcons');
  if (!host) return;
  host.innerHTML = THEME_ICONS.map((g) => `
    <button type="button" data-nt-icon="${g}" aria-pressed="${g === ntIcon}"
      class="grid size-6 place-items-center rounded-lg text-xs transition-colors ${g === ntIcon ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'}">${g}</button>`).join('');
  host.querySelectorAll('[data-nt-icon]').forEach((b) => b.addEventListener('click', () => { ntIcon = b.dataset.ntIcon; renderNtIcons(); }));
}
function renderNtSeed() {
  const host = document.getElementById('ntSeed');
  if (!host) return;
  const cur = THEMES.find((t) => t.id === currentThemeId) || THEMES[0];
  const OPTS = [
    ['copy', `复制当前主题「${cur.name}」`, '连同你已经改过的部分一起带走'],
    ['builtin', '从内置主题派生', '取出厂状态，不含你的改动'],
    ['blank', '空白', '全部回到默认值 · 约 390 项要自己配'],
  ];
  host.innerHTML = OPTS.map(([id, title, desc]) => `
    <button type="button" data-nt-seed="${id}" aria-pressed="${id === ntSeed}"
      class="flex w-full items-start gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors ${id === ntSeed ? 'border-slate-900 bg-white shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}">
      <span class="mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full border ${id === ntSeed ? 'border-slate-900' : 'border-slate-300'}">
        ${id === ntSeed ? '<span class="size-1.5 rounded-full bg-slate-900"></span>' : ''}
      </span>
      <span class="min-w-0">
        <span class="block text-xs font-medium text-slate-800">${title}</span>
        <span class="hint-sub">${desc}</span>
      </span>
    </button>`).join('');
  host.querySelectorAll('[data-nt-seed]').forEach((b) => b.addEventListener('click', () => { ntSeed = b.dataset.ntSeed; renderNtSeed(); }));
}
/** 校验就近内联（决策 #7）。重名只提示不阻止——主题名允许重复，唯一键是 id。 */
function validateNt() {
  const input = document.getElementById('ntName');
  const hint = document.getElementById('ntNameHint');
  const create = document.querySelector('[data-nt-create]');
  if (!input || !hint || !create) return true;
  const v = input.value.trim();
  const dup = THEMES.some((t) => t.name === v);
  const empty = !v;
  hint.classList.toggle('hidden', !(empty || dup));
  hint.textContent = empty ? '名称不能为空' : dup ? `已经有一个叫「${v}」的主题了，仍可创建（靠图标区分）` : '';
  hint.className = 'mt-1 text-xs leading-relaxed ' + (empty ? 'text-rose-600' : 'text-amber-700') + (empty || dup ? '' : ' hidden');
  create.disabled = empty;
  create.classList.toggle('opacity-40', empty);
  return !empty;
}
function bindNewThemeDialog() {
  const box = document.getElementById('newTheme');
  if (!box || box.dataset.bound) return;
  box.dataset.bound = '1';
  document.querySelectorAll('[data-lib-new]').forEach((b) => b.addEventListener('click', openNewTheme));
  box.querySelector('[data-newtheme-backdrop]').addEventListener('click', closeNewTheme);
  box.querySelector('[data-nt-cancel]').addEventListener('click', closeNewTheme);
  const name = document.getElementById('ntName');
  name.addEventListener('input', validateNt);
  name.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); box.querySelector('[data-nt-create]').click(); }
    // Esc 由这里吞掉，避免同一次按键既关对话框又触发外面的 Esc 处理（关菜单/清搜索）
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeNewTheme(); }
  });
  box.querySelector('[data-nt-create]').addEventListener('click', () => {
    if (!validateNt()) return;
    const created = {
      id: `new-${Date.now().toString(36)}`,
      name: document.getElementById('ntName').value.trim(),
      kind: '自定义', glyph: ntIcon,
      summary: { copy: '复制自当前主题', builtin: '派生自内置主题', blank: '空白起点 · 尚未配置' }[ntSeed],
    };
    THEMES.push(created);
    closeNewTheme();
    currentThemeId = created.id;
    renderThemes(created.id);
    toast(`已创建「${created.name}」`, () => {
      const i = THEMES.indexOf(created);
      if (i >= 0) THEMES.splice(i, 1);
      currentThemeId = 'mono';
      renderThemes(currentThemeId);
      return () => { THEMES.push(created); currentThemeId = created.id; renderThemes(created.id); };
    });
  });
}

/**
 * 库级 ⋯ 菜单。复用主题卡 ⋯ 的弹层形态，但作用域是**整个库**，
 * 所以菜单项与主题卡的不重叠：那边是「这一个主题」，这边是「全部」。
 * 两个 ⋯ 长得一样但作用域不同，靠**位置**区分（工具条 vs 行内）——
 * 这也是为什么导出全部不能放在行内 ⋯ 里。
 */
const LIB_MENU = [
  { id: 'import', label: '导入…', hint: '.json，可多选' },
  { id: 'exportAll', label: '导出全部', hint: `${'' /* 运行时填数量 */}` },
  { id: 'reveal', label: '在 Finder 中显示' },
];
function bindLibraryMenu() {
  document.querySelectorAll('[data-lib-menu]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const already = document.querySelector('[data-lib-pop]');
    closeThemeMenus();
    if (already) return;
    const pop = document.createElement('div');
    pop.setAttribute('data-lib-pop', '1');
    pop.setAttribute('data-theme-pop', 'lib');   // 复用统一的关闭逻辑（点外面 / Esc）
    pop.setAttribute('role', 'menu');
    pop.className = 'absolute z-50 w-[200px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg';
    pop.innerHTML = LIB_MENU.map((it) => `
      <button data-lib-act="${it.id}" role="menuitem" class="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50">
        <span class="min-w-0 flex-1 truncate">${it.label}</span>
        ${it.id === 'exportAll' ? `<span class="shrink-0 text-xs text-slate-500">${THEMES.length} 个</span>`
          : it.hint ? `<span class="shrink-0 text-xs text-slate-500">${it.hint}</span>` : ''}
      </button>`).join('');
    // 走同一个 placePopover：折叠态里按钮只有 36px 宽，右对齐会让菜单探到侧栏外，
    // 所以这里用左对齐；夹进视口的逻辑由 placePopover 统一负责。
    placePopover(pop, btn, { alignLeft: true });
    pop.querySelectorAll('[data-lib-act]').forEach((mi) => mi.addEventListener('click', (ev) => {
      ev.stopPropagation();
      closeThemeMenus();
      const act = mi.dataset.libAct;
      if (act === 'import') return doImport();
      if (act === 'exportAll') return toast(`已导出全部 ${THEMES.length} 个主题为 cursordance-themes.json`);
      toast('已在 Finder 中显示配置目录');
    }));
  }));
}

/**
 * 主题列表的键盘导航。原先列表完全不可键盘到达——
 * 四个主题卡都是 div，没有 tabindex、没有 role，Tab 直接从搜索框跳到底部按钮。
 *
 * 采用 roving tabindex（listbox 的标准做法）而不是给每行 tabindex=0：
 * 后者会让 Tab 在 5 个主题里按 5 次才能走出侧栏。
 * 键位选择跟随 macOS 列表惯例：↑↓ 移动 / ↵ 打开 / ⌘⌫ 删除 / Esc 回搜索框。
 * 删除必须走同一套约束（内置不可删、至少留一个），否则键盘路径会绕过它们。
 */
function bindThemeListKeys() {
  const list = document.getElementById('themeList');
  const search = document.getElementById('themeSearch');
  if (!list || list.dataset.keysBound) return;
  list.dataset.keysBound = '1';
  const rows = () => [...list.querySelectorAll('[data-theme]')];
  const focusRow = (i) => {
    const all = rows();
    if (!all.length) return;
    const n = Math.max(0, Math.min(i, all.length - 1));
    all.forEach((r, k) => { r.tabIndex = k === n ? 0 : -1; });
    all[n].focus();
    all[n].scrollIntoView({ block: 'nearest' });
  };
  // 搜索框按 ↓ 进列表——搜完直接往下走是最自然的动作
  if (search) search.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown') return;
    e.preventDefault();
    focusRow(0);
  });
  list.addEventListener('keydown', (e) => {
    const all = rows();
    const i = all.indexOf(e.target.closest('[data-theme]'));
    if (i < 0) return;
    const t = THEMES.find((x) => x.id === all[i].dataset.theme);
    if (e.key === 'ArrowDown') { e.preventDefault(); focusRow(i + 1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); i === 0 && search ? search.focus() : focusRow(i - 1); return; }
    if (e.key === 'Home') { e.preventDefault(); focusRow(0); return; }
    if (e.key === 'End') { e.preventDefault(); focusRow(all.length - 1); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); all[i].click(); return; }
    if (e.key === 'Escape' && search) { e.preventDefault(); search.focus(); return; }
    // ⋯ 菜单也要能键盘打开，否则重命名/复制/导出只有鼠标能到
    if (e.key === '.' || e.key === 'ContextMenu') {
      e.preventDefault();
      all[i].querySelector('[data-theme-menu]')?.click();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'Backspace' || e.key === 'Delete')) {
      e.preventDefault();
      // 走与 ⋯ 菜单同一套约束，不能因为换了入口就绕过
      const blocked = themeMenuItems(t).find((x) => x.id === 'delete')?.disabledReason;
      if (blocked) { toast(blocked); return; }
      toast(`已删除「${t.name}」`, () => {});
    }
  });
}

/** 主题库：搜索接线 + 导入导出。这三处原先都只有外观，没有行为。 */
function bindThemeLibrary() {
  const input = document.getElementById('themeSearch');
  const clear = document.getElementById('themeSearchClear');
  if (input) {
    const sync = () => {
      themeQuery = input.value.trim();
      if (clear) { clear.classList.toggle('hidden', !themeQuery); clear.classList.add('grid'); }
      renderThemes(currentThemeId);
    };
    input.addEventListener('input', sync);
    // Esc 清空而不是让浏览器吞掉：搜索框里 Esc 的通行语义就是「取消这次搜索」
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !input.value) return;
      e.preventDefault(); e.stopPropagation();
      input.value = ''; sync();
    });
    if (clear) clear.addEventListener('click', () => { input.value = ''; themeQuery = ''; sync(); input.focus(); });
  }
  bindNewThemeDialog();
  bindImportDialog();
  bindLibraryMenu();
  bindThemeListKeys();
  // 折叠态的搜索图标：先展开再聚焦。60px 宽放不下输入框，
  // 但「点了搜索什么也没发生」是死控件，所以给它一个确定的落点。
  document.querySelectorAll('[data-side-search]').forEach((b) => b.addEventListener('click', () => {
    sidebarAutoDecided = true;
    setSidebar(false);
    const el = document.getElementById('themeSearch');
    if (el) { el.focus(); el.select(); }
  }));
  const imp = document.querySelector('[data-lib-import]');
  const exp = document.querySelector('[data-lib-export]');
  // 导入是**新增**一个主题，所以要能撤销；导出只产出文件、不改状态，所以不需要。
  // 这条区分就是决策 #7「一次性结果 → toast（带撤销）」的具体应用。
  if (imp) imp.addEventListener('click', doImport);
  if (exp) exp.addEventListener('click', () => toast(`已导出全部 ${THEMES.length} 个主题为 cursordance-themes.json`));
}

/**
 * 导入。抽成函数是因为它现在有两个入口（库 ⋯ 菜单、以及可能的拖放），
 * 行为必须一致——同一件事的两条路径分别实现是稿子里已经出现过的病
 * （单个主题导出在 ⋯ 菜单、库导出在别处，语义靠位置区分是有意的；
 * 但**同一个** 导入 有两份实现就只是重复）。
 * 导入会新增状态，所以带撤销（决策 #7）。
 */
/** 模拟的主题包内容。故意造出三种情况：正常、重名、版本不兼容。 */
const IMPORT_FIXTURE = [
  { key: 'a', name: '霓虹', glyph: '霓', actions: 3, note: '5 个动作里 3 个已配置' },
  { key: 'b', name: '几何', glyph: '几', actions: 5, note: '5 个动作全部已配置', dup: true },
  { key: 'c', name: '墨滴', glyph: '墨', actions: 2, note: '5 个动作里 2 个已配置' },
  { key: 'd', name: '旧版粒子', glyph: '旧', actions: 0, note: '主题包版本 v2，当前只读 v4', bad: true },
];
let impItems = [];
function doImport() {
  const box = document.getElementById('importTheme');
  if (!box) return;
  impItems = [];
  box.querySelector('[data-imp-stage="empty"]').classList.remove('hidden');
  box.querySelector('[data-imp-stage="parsed"]').classList.add('hidden');
  document.getElementById('impSummary').textContent = '';
  box.querySelector('[data-imp-confirm]').disabled = true;
  box.classList.remove('hidden');
  box.querySelector('[data-imp-pick]').focus();
}
const closeImport = () => document.getElementById('importTheme')?.classList.add('hidden');
/** 模拟「文件已选好、已解析」——原型里没有真实文件系统，但闭环的形状要完整 */
function impParse(fileName = 'cursordance-pack.json') {
  const box = document.getElementById('importTheme');
  impItems = IMPORT_FIXTURE.map((f) => ({
    ...f,
    // 不兼容的默认不勾选且不可勾选；重名的默认勾上、冲突策略默认「保留两个」
    take: !f.bad,
    onDup: 'keep',
  }));
  document.getElementById('impFileName').textContent = `${fileName} · ${impItems.length} 个主题`;
  box.querySelector('[data-imp-stage="empty"]').classList.add('hidden');
  box.querySelector('[data-imp-stage="parsed"]').classList.remove('hidden');
  renderImpList();
}
function renderImpList() {
  const host = document.getElementById('impList');
  if (!host) return;
  host.innerHTML = impItems.map((it) => `
    <div class="rounded-xl border ${it.bad ? 'border-slate-200 bg-slate-50' : it.take ? 'border-slate-900 bg-white shadow-sm' : 'border-slate-200 bg-white'} px-2.5 py-2">
      <div class="flex items-center gap-2.5">
        <button data-imp-take="${it.key}" ${it.bad ? 'disabled' : ''} aria-pressed="${it.take}"
          class="grid size-4 shrink-0 place-items-center rounded border ${it.bad ? 'cursor-not-allowed border-slate-200 bg-slate-100' : it.take ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 bg-white'}"
          aria-label="选择 ${it.name}">
          ${it.take && !it.bad ? '<svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><path d="M20 6 9 17l-5-5"/></svg>' : ''}
        </button>
        <span class="grid size-7 shrink-0 place-items-center rounded-lg glyph-badge ${it.bad ? 'bg-slate-100 text-slate-500' : 'bg-slate-900 text-white'}">${it.glyph}</span>
        <span class="min-w-0 flex-1">
          <span class="flex min-w-0 items-center gap-1.5">
            <span class="min-w-0 truncate text-xs font-medium ${it.bad ? 'text-slate-500' : 'text-slate-900'}">${it.name}</span>
            ${it.dup ? '<span class="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700">同名已存在</span>' : ''}
            ${it.bad ? '<span class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">无法导入</span>' : ''}
          </span>
          <span class="mt-px block truncate text-2xs text-slate-500">${it.note}</span>
        </span>
      </div>
      ${it.dup && it.take ? `
        <div class="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2">
          <span class="shrink-0 text-xs text-slate-500">同名处理</span>
          <div class="seg-group" role="radiogroup" aria-label="同名处理">
            ${[['keep', '保留两个'], ['overwrite', '覆盖'], ['skip', '跳过']].map(([v, l]) =>
              `<button data-imp-dup="${it.key}|${v}" role="radio" aria-checked="${it.onDup === v}" class="seg-item${it.onDup === v ? ' seg-item-on' : ''}">${l}</button>`).join('')}
          </div>
        </div>` : ''}
      ${it.bad ? '<p class="hint-note">主题包版本比当前应用旧，字段结构已变。强行导入只会得到一个坏主题，所以这一项只能跳过。</p>' : ''}
    </div>`).join('');

  host.querySelectorAll('[data-imp-take]').forEach((b) => b.addEventListener('click', () => {
    const it = impItems.find((x) => x.key === b.dataset.impTake);
    if (!it || it.bad) return;
    it.take = !it.take;
    renderImpList();
  }));
  host.querySelectorAll('[data-imp-dup]').forEach((b) => b.addEventListener('click', () => {
    const [k, v] = b.dataset.impDup.split('|');
    const it = impItems.find((x) => x.key === k);
    if (it) { it.onDup = v; renderImpList(); }
  }));
  syncImpSummary();
}
function syncImpSummary() {
  const taken = impItems.filter((x) => x.take && !x.bad && x.onDup !== 'skip');
  const blocked = impItems.filter((x) => x.bad).length;
  const el = document.getElementById('impSummary');
  const btn = document.querySelector('[data-imp-confirm]');
  if (el) el.textContent = `将导入 ${taken.length} 个` + (blocked ? ` · ${blocked} 个无法导入` : '');
  if (btn) { btn.disabled = !taken.length; btn.classList.toggle('opacity-40', !taken.length); }
}
function bindImportDialog() {
  const box = document.getElementById('importTheme');
  if (!box || box.dataset.bound) return;
  box.dataset.bound = '1';
  box.querySelector('[data-import-backdrop]').addEventListener('click', closeImport);
  box.querySelector('[data-imp-cancel]').addEventListener('click', closeImport);
  box.querySelector('[data-imp-pick]').addEventListener('click', () => impParse());
  box.querySelector('[data-imp-all]').addEventListener('click', () => { impItems.forEach((x) => { if (!x.bad) x.take = true; }); renderImpList(); });
  box.querySelector('[data-imp-none]').addEventListener('click', () => { impItems.forEach((x) => { x.take = false; }); renderImpList(); });

  // 拖放：dragover 必须 preventDefault，否则浏览器会当成导航、直接打开文件
  const drop = document.getElementById('impDrop');
  const hot = (on) => drop.classList.toggle('border-slate-900', on) || drop.classList.toggle('bg-white', on);
  ['dragenter', 'dragover'].forEach((k) => drop.addEventListener(k, (e) => { e.preventDefault(); hot(true); }));
  ['dragleave', 'drop'].forEach((k) => drop.addEventListener(k, (e) => { e.preventDefault(); hot(false); }));
  drop.addEventListener('drop', (e) => {
    const f = e.dataTransfer?.files?.[0];
    impParse(f ? f.name : 'cursordance-pack.json');
  });

  box.querySelector('[data-imp-confirm]').addEventListener('click', () => {
    const taken = impItems.filter((x) => x.take && !x.bad && x.onDup !== 'skip');
    if (!taken.length) return;
    const before = THEMES.slice();
    taken.forEach((it) => {
      if (it.dup && it.onDup === 'overwrite') {
        const hit = THEMES.find((t) => t.name === it.name);
        if (hit) { hit.glyph = it.glyph; hit.summary = `已被导入覆盖 · ${it.note}`; return; }
      }
      THEMES.push({
        id: `imp-${it.key}-${Date.now().toString(36)}`,
        // 「保留两个」时给个后缀，否则列表里两条一模一样、分不出哪个是新的
        name: it.dup && it.onDup === 'keep' ? `${it.name}（导入）` : it.name,
        kind: '自定义', glyph: it.glyph, summary: it.note,
      });
    });
    closeImport();
    renderThemes(currentThemeId);
    toast(`已导入 ${taken.length} 个主题`, () => {
      THEMES.splice(0, THEMES.length, ...before);
      renderThemes(currentThemeId);
      return () => { document.querySelector('[data-imp-confirm]')?.click(); };
    });
  });
}

function bindShell(proto, onProto) {
  document.querySelectorAll('[data-proto]').forEach((b) => b.addEventListener('click', () => setProto(b.dataset.proto, proto, onProto)));
  document.querySelectorAll('[data-side-toggle]').forEach((b) => b.addEventListener('click', () => {
    sidebarAutoDecided = true;   // 用户亲手开合过就锁定，尺寸变化不再替他决定
    setSidebar(!sidebarClosed);
  }));
  setSidebar(sidebarClosed);   // 兜底同步：状态与 DOM 只能有一份真值
  autoCollapseSidebarIfNarrow();
  bindThemeLibrary();
  document.getElementById('undoBtn').addEventListener('click', doUndo);
  document.getElementById('redoBtn').addEventListener('click', doRedo);
  document.getElementById('cmdkBtn').addEventListener('click', () => toggleCmdk());
  document.querySelector('[data-cmdk-backdrop]').addEventListener('click', () => toggleCmdk(false));
  document.getElementById('cmdkInput').addEventListener('input', (e) => renderCmdk(e.target.value));
  // ↑↓/↵ 必须挂在输入框上：焦点一直在这里，挂到 document 上会先被下面那个
  // 全局分发器吃掉（它对 ArrowDown 不设防，但 Enter 会与「主题轨回车打开」抢）
  document.getElementById('cmdkInput').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveCmdkSel(1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); moveCmdkSel(-1); return; }
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); runCmdkSel(); }
  });
  document.addEventListener('keydown', (e) => {
    const inField = e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName);
    const mod = e.metaKey || e.ctrlKey;
    /*
      ── 按键捕获面与外壳快捷键的归属契约 ──

      `04` 的整个前提是「点一下屏幕预览，然后直接打字」，而它的提示语原文是
      **「试试 ⌘K、⇧、⏎ 看语义分层」**——实测按下 ⌘K 打开的是外壳的命令面板，
      焦点被抢进 `#cmdkInput`，`defaultPrevented = true`。用户照着提示做，
      得到的是一个完全无关的界面。

      而这不是「换一个示例快捷键」能解决的：外壳占着 ⌘K / ⌘Z / ⌘⇧Z / ⌘1–5 / ⌘N / ⌘J，
      **在一个用来演示按键的面里，这些恰好都是用户会去按的键**，冲突面是 10 个。
      所以需要的是一条**归属契约**：捕获面激活时外壳整体让位，只留 Escape 作为出口。

      判断收在这一个漏斗里（而不是让 04 自己 stopPropagation）：
      将来任何一个新的捕获面只要调 `setCaptureMode(true)` 就自动正确，
      不需要谁记得再改一遍分发逻辑。
    */
    if (captureMode && e.key !== 'Escape') return;
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); toggleCmdk(); return; }
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
    // ⌘N 现在可以注册了：README 原来说它「刻意没注册，因为新建的状态还私有」——
    // 那条理由的前提是**没有新建界面**，而现在有了对话框，⌘N 有确定的落点。
    // 注册一个没实现的键位会吃掉原生行为又什么都不做，比没有更糟；有了落点就该给。
    if (mod && e.key.toLowerCase() === 'n' && !inField) { e.preventDefault(); openNewTheme(); return; }
    /*
      ⌘J 之前**只有徽标没有注册**：页头那枚 AI 助手按钮上挂着 `⌘J` 的 kbd、
      命令面板里也列着「打开 AI 助手 ⌘J」，而 keydown 里根本没有 `j` 分支。
      这比「没有快捷键」更糟——它和上面 ⌘N 那条注释说的是同一件事的两面：
      注册一个没落点的键位会吃掉原生行为又什么都不做，
      而**画一个没注册的徽标会让用户以为自己按错了**。
      落点是确定的（`06-ai.html`，和那枚按钮的 href 同一个），所以补上。
    */
    if (mod && e.key.toLowerCase() === 'j' && !inField) { e.preventDefault(); window.location.href = '06-ai.html'; return; }
    if (e.key === 'Escape') { closeNewTheme(); closeImport(); toggleCmdk(false); return; }
    if (mod && ['1', '2', '3', '4', '5'].includes(e.key) && !inField) {
      e.preventDefault();
      const target = WORKSPACES[Number(e.key) - 1];
      if (target) window.location.href = target[2];
    }
  });
}
/**
 * 侧边栏**默认收起**。
 *
 * 这是对 README 决策 #5「主题库侧边栏默认展开」的**有意反转**（产品决定，2026-08-03）。
 * 理由站得住：248px 侧栏在新基准 960px 下占 26%，而它承载的是**低频**任务
 * （切主题、新建、导入导出），主区承载的是高频任务（调参数）。
 * 决策 #5 是在 1440px 基准上定的，那里 248px 只占 17%。
 * 折叠态保留搜索入口与主题轨（决策 #5 的后半句仍然成立），所以收起不等于失去入口。
 *
 * 注意：真实代码在「第 0 批」已按决策 #5 改成默认展开且折叠态持久化，
 * 这次只改稿子。实施时要把默认值反过来，但**持久化必须保留**——
 * 默认收起 + 不持久化会让每次重启都把用户展开的侧栏收掉。
 */
/*
  捕获模式：页面里的「按键捕获面」（目前只有 04 的屏幕预览）激活时，
  外壳把全部快捷键让给它，只保留 Escape 作为出口。
  必须有**可见徽标**——一个悄悄改变了所有快捷键含义的模式，
  比快捷键冲突本身更糟（用户会以为快捷键坏了）。
*/
let captureMode = false;
function setCaptureMode(on, label) {
  captureMode = !!on;
  let badge = document.getElementById('captureBadge');
  if (captureMode) {
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'captureBadge';
      badge.className = 'pointer-events-none fixed left-1/2 top-3 z-[60] -translate-x-1/2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-lg';
      document.body.appendChild(badge);
    }
    badge.textContent = `${label || '正在捕获按键'} · Esc 退出`;
  } else if (badge) {
    badge.remove();
  }
}
window.setCaptureMode = setCaptureMode;
window.isCaptureMode = () => captureMode;

let sidebarClosed = true;
let sidebarAutoDecided = false;
function setSidebar(closed) {
  sidebarClosed = closed;
  /*
    **只增删宽度类，绝不重建整串 className。**

    这一行原先是 `el.className = '一长串字面量' + (closed ? 'w-[60px]' : 'w-[248px]')`，
    于是每次开合都把 markup 上的其它类冲掉——加 `.motion-layout` 之后立刻现形：
    实测侧栏的 `transitionProperty` 是 `all` / `0s`，也就是类根本不在元素上了。

    这正是门禁 `classname-rebuild-with-layout` 在防的反模式，README 也为它记过一次
    （`01` 点一下底色就把舞台的 flex 尺寸冲成 `h-[212px]`）。同一个坑在这里换了个位置。
  */
  const el = document.getElementById('sidebar');
  el.classList.toggle('w-[60px]', closed);
  el.classList.toggle('w-[248px]', !closed);
  // 两个 pane 的 `flex` 都常在，这里**只**管 hidden——
  // 显隐和布局方式分开管理，才不会出现「删了 hidden 却没有 flex」那种半初始化状态。
  document.querySelector('[data-side="open"]').classList.toggle('hidden', closed);
  document.querySelector('[data-side="closed"]').classList.toggle('hidden', !closed);
}
/**
 * 窄窗口下侧栏自动折叠。
 *
 * 侧栏是固定 248px。在真实最小窗口（720px）下它占 34%，主区只剩 470px；
 * 决策 #5 说「主题库侧边栏默认展开」，但那条是在 1440px 基准上定的——
 * 248px 在 1440 下是 17%，在 720 下是 34%，同一个常量在两个尺寸下是两种设计。
 * 折叠态保留搜索入口（决策 #5 的后半句），所以折叠不等于失去入口。
 *
 * 只在首次布局时决定，之后尊重用户的开合意图——否则每次改窗口大小
 * 都把用户刚展开的侧栏收起来（同 01 抽屉那条：联动必须双向）。
 */
function autoCollapseSidebarIfNarrow() {
  if (sidebarAutoDecided) return;
  const win = document.getElementById('mockWindow');
  const w = win ? win.getBoundingClientRect().width : 0;
  if (!w) return;
  sidebarAutoDecided = true;
  // 默认已经是收起，这里只剩「大屏下要不要自动展开」这一个问题。答案是**不要**：
  // 自动展开会覆盖产品决定的默认值，而且用户在 lg 档展开过一次之后
  // sidebarAutoDecided 已锁，行为会随「他先看哪一档」而不同——那是不可预测的。
  if (w < 860) setSidebar(true);
}

function toggleCmdk(force) {
  const el = document.getElementById('cmdk');
  const open = force === undefined ? el.classList.contains('hidden') : force;
  el.classList.toggle('hidden', !open);
  if (open) { renderCmdk(); setTimeout(() => document.getElementById('cmdkInput').focus(), 30); }
}
let cmdkRuns = [];
function renderCmdk(q = '') {
  const kw = q.trim().toLowerCase();
  cmdkRuns = [];
  // 无关键词时不铺开字段（否则几百条淹没命令）；一输入就优先展示字段命中
  const groups = allCommands().filter(([g]) => kw || g !== '字段');
  const html = groups.map(([group, items]) => {
    const hit = items.filter(([label]) => !kw || label.toLowerCase().includes(kw));
    if (!hit.length) return '';
    return `<div class="flex items-baseline gap-1.5 px-2 pb-1 pt-2"><span class="text-xs font-semibold text-slate-500">${group}</span>`
      + (hit.length > 6 ? `<span class="text-xs tabular-nums text-slate-300">${hit.length}</span>` : '') + '</div>'
      + hit.slice(0, 12).map(([label, key, run]) => {
        const idx = cmdkRuns.push(run || null) - 1;
        return `<button data-run="${idx}" id="cmdkOpt-${idx}" role="option" aria-selected="false" class="cmdk-item">
          <svg class="size-3.5 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          <span class="min-w-0 flex-1 truncate">${label}</span>${key ? `<span class="kbd">${key}</span>` : ''}</button>`;
      }).join('')
      + (hit.length > 12 ? `<div class="px-2 pb-1 text-2xs text-slate-500">还有 ${hit.length - 12} 条，继续输入以缩小范围</div>` : '');
  }).join('');
  const list = document.getElementById('cmdkList');
  list.innerHTML = html || '<div class="px-2 py-6 text-center text-xs text-slate-500">没有匹配的命令</div>';
  list.querySelectorAll('[data-run]').forEach((b) => b.addEventListener('click', () => {
    const fn = cmdkRuns[Number(b.dataset.run)];
    toggleCmdk(false);
    fn?.();
  }));
  cmdkSel = cmdkRuns.length ? 0 : -1;
  paintCmdkSel();
}
/*
  ↑↓ 选择 · ↵ 执行 —— 面板底部**一直写着**这句，但它从来没有实现。

  这是「稿子自己说谎」那一族里最不容易被发现的形态：面板打开、能搜、能点，
  唯一不成立的是它自己许诺的那条键盘路径。而 `.cmdk-item-on` 这个类
  在 `_src.css` 里定义好了却**零处使用**——两边合起来正好是「看起来做过了」。
  aria-state-missing 那条门禁抓到 cmdk-item 没有状态属性，才把这件事翻出来。

  选中态的真值是 `cmdkSel`（索引），`.cmdk-item-on` 与 `aria-selected` 都是它的投影，
  另外把 `aria-activedescendant` 写在输入框上——焦点始终在输入框里，
  读屏器只能靠这个属性知道「现在高亮的是哪一条」。
*/
let cmdkSel = -1;
function paintCmdkSel() {
  const list = document.getElementById('cmdkList');
  if (!list) return;
  const rows = [...list.querySelectorAll('[data-run]')];
  rows.forEach((b, i) => {
    const on = i === cmdkSel;
    b.classList.toggle('cmdk-item-on', on);
    b.setAttribute('aria-selected', String(on));
    if (on) b.scrollIntoView({ block: 'nearest' });
  });
  const input = document.getElementById('cmdkInput');
  if (input) {
    if (cmdkSel >= 0 && rows[cmdkSel]) input.setAttribute('aria-activedescendant', rows[cmdkSel].id);
    else input.removeAttribute('aria-activedescendant');
  }
}
function moveCmdkSel(delta) {
  const rows = document.querySelectorAll('#cmdkList [data-run]');
  if (!rows.length) return;
  cmdkSel = (cmdkSel + delta + rows.length) % rows.length;
  paintCmdkSel();
}
function runCmdkSel() {
  const rows = document.querySelectorAll('#cmdkList [data-run]');
  const row = rows[cmdkSel];
  if (!row) return;
  const fn = cmdkRuns[Number(row.dataset.run)];
  toggleCmdk(false);
  fn?.();
}

// ── 自动保存 + 撤销：全站统一（取代脏状态 + 保存按钮）
function touch() {
  const el = document.getElementById('saveState');
  if (!el) return;
  el.innerHTML = '<svg class="size-3 animate-spin text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 1 0 9 9"/></svg> 草稿保存中';
  clearTimeout(touch.t);
  touch.t = setTimeout(() => {
    el.innerHTML = '<svg class="size-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg> 草稿已存';
  }, 420);
}
/*
  toast 原先捆了三件事：显示提示、压撤销栈、标记「草稿已存」。
  加进第四件（标记草稿未应用）时当场出了一个缺陷：**「应用到桌面」自己也弹 toast**，
  于是它先把 dirty 清掉、紧接着 toast 又把它标回去——实测点了应用之后
  作用域条照旧显示「未应用」。

  所以第三个参数把「这是一次配置改动吗」显式化。默认是（页面的所有改动都经过 toast），
  但发布 / 回退这类**元操作**要传 `{ draft: false }`。
  一个函数默默替调用方决定语义，就一定会有一天决定错。
*/
function toast(text, undo, opts = {}) {
  touch();
  if (opts.draft !== false) markDraftDirty();   // 改动进的是**草稿**；发布到运行时是另一个显式动作（裁决 1）
  if (undo) { hist().undo.push(undo); hist().redo.length = 0; }
  syncHistoryUi();
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  el.className = 'pointer-events-auto flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg';
  el.innerHTML = `<span class="text-xs font-medium text-slate-600">${text}</span>`;
  if (undo) {
    const b = document.createElement('button');
    b.className = 'text-xs font-semibold text-slate-900 underline underline-offset-2';
    b.textContent = '撤销';
    b.addEventListener('click', () => { doUndo(); el.remove(); });
    el.appendChild(b);
  }
  host.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
function syncHistoryUi() {
  const h = hist();
  const u = document.getElementById('undoBtn');
  if (u) {
    u.disabled = h.undo.length === 0;
    u.title = h.undo.length ? `撤销（${h.undo.length} 步可撤销）` : '没有可撤销的改动';
  }
  const r = document.getElementById('redoBtn');
  if (r) {
    r.disabled = h.redo.length === 0;
    r.title = h.redo.length ? `重做（${h.redo.length} 步可重做）` : '没有可重做的改动';
  }
}
function doUndo() {
  const h = hist();
  const entry = h.undo.pop();
  if (!entry) return;
  const redo = entry();               // 撤销函数可返回一个「重做」函数
  if (typeof redo === 'function') h.redo.push(redo);
  syncHistoryUi();
  touch();
}
function doRedo() {
  const h = hist();
  const entry = h.redo.pop();
  if (!entry) return;
  const undo = entry();
  if (typeof undo === 'function') h.undo.push(undo);
  syncHistoryUi();
  touch();
}
/** 切主题：栈跟着主题走，并把当前主题的可撤销步数反映到按钮上。 */
function setHistoryTheme(id) {
  currentThemeId = id;
  syncHistoryUi();
}
