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

const WORKSPACES = [
  ['workbench', '主题工作台', '01-workbench.html'],
  ['cursor-skin', '光标皮肤', '02-cursor-skin.html'],
  ['app-rules', '应用规则', '03-app-rules.html'],
  ['keyboard', '键盘动效', '04-keyboard.html'],
  ['diagnostics', '诊断面板', '05-diagnostics.html'],
];

const THEMES = [
  { id: 'mono', name: '几何', kind: '内置', summary: '黑白灰 · 方块粒子 · 几何波纹', glyph: '几' },
  { id: 'drift', name: '流光', kind: '内置', summary: '轨道粒子 · 涟漪扩散 · 沉静青绿', glyph: '流' },
  { id: 'molten', name: '熔金', kind: '内置', summary: '火花喷发 · 能量脉冲 · 熔岩橙金', glyph: '熔' },
  { id: 'sunset', name: '夕霞', kind: '自定义', summary: '钻石飘落 · 回声涟漪 · 落日粉橙', glyph: '夕', dirty: true },
];

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
    pop.className = 'absolute right-2 z-50 mt-1 w-[188px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg';
    pop.innerHTML = themeMenuItems(t).map((it) => {
      const off = !!it.disabledReason;
      const tone = it.danger ? 'text-rose-600' : 'text-slate-700';
      return `<button data-menu-act="${it.id}" ${off ? 'disabled' : ''} role="menuitem"
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${off ? 'cursor-not-allowed text-slate-300' : tone + ' hover:bg-slate-50'}"
        ${off ? `title="${it.disabledReason}"` : ''}>
        <span class="min-w-0 flex-1 truncate">${it.label}</span>
        ${off ? '<span class="shrink-0 text-2xs text-slate-300">不可用</span>' : ''}
      </button>`;
    }).join('');
    btn.closest('[data-theme]').style.position = 'relative';
    btn.closest('[data-theme]').append(pop);

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
  const host = document.querySelector(`[data-theme="${t.id}"]`);
  if (!host) return;
  host.style.position = 'relative';
  const pop = document.createElement('div');
  pop.setAttribute('data-theme-pop', t.id);
  pop.className = 'absolute right-2 z-50 mt-1 w-[188px] rounded-xl border border-slate-200 bg-white p-2 shadow-lg';
  pop.innerHTML = `<div class="mb-1.5 px-1 text-2xs font-semibold text-slate-500">换图标</div>
    <div class="grid grid-cols-6 gap-1">
      ${THEME_ICONS.map((g) => `<button data-icon="${g}" class="grid size-7 place-items-center rounded-lg text-xs text-slate-600 transition-colors hover:bg-slate-100">${g}</button>`).join('')}
    </div>`;
  host.append(pop);
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
  const chip = (id, label, href) => (id === active
    ? `<button class="ws-chip ws-chip-active">${label}</button>`
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
          <span class="grid size-6 shrink-0 place-items-center rounded-full bg-slate-950 text-2xs font-semibold text-white">C</span>
          <div class="text-xs font-semibold leading-tight text-slate-900">CursorDance</div>
        </div>
        <div class="min-w-0 flex-1"></div>
        <span class="mr-2 inline-flex h-6 shrink-0 items-center gap-1.5 self-center rounded-lg px-2 text-2xs font-medium text-slate-500">
          <svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>
          已是最新
        </span>
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
        <div class="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          ${WORKSPACES.map(([id, label, href]) => chip(id, label, href)).join('')}
        </div>
        <div class="flex min-w-0 items-center justify-end gap-2">
          ${showLayout ? `<div class="flex h-8 items-center gap-0.5 rounded-xl bg-white px-1 shadow-sm ring-1 ring-slate-200">
            <button data-shell-layout="config" class="layout-btn" title="专注配置" aria-label="专注配置">
              <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="12" height="16" rx="1.5"/><rect x="17" y="4" width="4" height="16" rx="1.5"/></svg>
            </button>
            <button data-shell-layout="split" class="layout-btn" title="对半" aria-label="对半">
              <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="8" height="16" rx="1.5"/><rect x="13" y="4" width="8" height="16" rx="1.5"/></svg>
            </button>
            <button data-shell-layout="preview" class="layout-btn" title="专注预览" aria-label="专注预览">
              <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="4" height="16" rx="1.5"/><rect x="9" y="4" width="12" height="16" rx="1.5"/></svg>
            </button>
          </div>` : ''}
          <div class="flex h-8 items-center gap-2 rounded-xl bg-white px-2.5 text-2xs shadow-sm ring-1 ring-slate-200">
            <span id="saveState" class="inline-flex items-center gap-1.5 font-medium text-slate-500">
              <svg class="size-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>
              已保存
            </span>
            <span class="h-3 w-px bg-slate-200"></span>
            <button id="undoBtn" class="inline-flex items-center gap-1 font-medium text-slate-400 transition-colors hover:text-slate-900 disabled:opacity-40" disabled>
              撤销 <span class="kbd">⌘Z</span>
            </button>
            <button id="redoBtn" class="inline-flex items-center gap-1 font-medium text-slate-400 transition-colors hover:text-slate-900 disabled:opacity-40" disabled aria-label="重做">
              <svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5"/></svg>
            </button>
          </div>
          ${showLayout ? `<a href="06-ai.html" class="btn-outline h-8 px-2.5 text-2xs">
            <svg class="mr-1.5 size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8V4H8M4 8h16v12H4zM9 16h6"/></svg>
            AI 助手 <span class="kbd ml-1.5">⌘J</span>
          </a>` : ''}
          <button id="cmdkBtn" class="btn-outline h-8 px-2.5 text-2xs">
            <svg class="mr-1.5 size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            命令 <span class="kbd ml-1.5">⌘K</span>
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
      <aside id="sidebar" class="flex shrink-0 flex-col border-r border-slate-200 bg-slate-100 ${sidebarClosed ? 'w-[60px]' : 'w-[248px]'}">
        <div data-side="open" class="${sidebarClosed ? 'hidden' : 'flex'} min-h-0 flex-1 flex-col">
          <div class="flex items-center gap-2 px-3 py-2.5">
            <button data-side-toggle class="grid size-8 shrink-0 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-white" aria-label="收起主题库">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M13 9l3 3-3 3"/></svg>
            </button>
            <div class="relative min-w-0 flex-1">
              <svg class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
              <input id="themeSearch" placeholder="搜索主题" class="h-8 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-14 text-xs text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />
              <span id="themeCount" class="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 text-2xs tabular-nums text-slate-400"></span>
                      <!--
                只用 hidden 的增删来控制显隐，不要同时挂 hidden 和 grid：
                Tailwind 的 display 工具类里 hidden 排在 grid 之后，两个都在时 hidden 恒胜，
                于是这个按钮永远不显示（实测 clearVisible: false）。
                这与「禁用态由 CSS 后代选择器承担、不要用 JS 改类名」是同一类陷阱：
                同一属性上叠两个工具类，结果由样式表顺序决定，不由代码顺序决定。
                注：这段注释在**模板字符串内部**，所以不能用反引号包代码名——
                会直接把模板字符串截断（我刚踩过，门禁的 shared-js-syntax 当场报了出来）。
              -->
              <button id="themeSearchClear" class="absolute right-1.5 top-1/2 hidden size-5 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="清空搜索">
                <svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
          <div id="themeList" class="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-2"></div>
          <!--
            底部原先只有「新建主题」。README 的目录写着 ThemeLibrarySidebar 负责
            create / duplicate / delete / **import** / export，而**导入在整个稿子里不存在**——
            导出只藏在主题卡的 ⋯ 菜单里（单个主题），导入一个入口都没有。
            这是「稿子丢掉了真实代码里已在工作的功能」那一类，只是这次丢的是入口而不是行为。
            导入放在这里而不是 ⋯ 菜单里：⋯ 是**针对某一个主题**的操作，
            而导入产生的是新主题，它没有宿主，天然属于主题库这一层。
          -->
          <div class="shrink-0 space-y-1.5 border-t border-slate-200 px-3 py-2.5">
            <button class="btn-outline h-8 w-full px-3 text-xs">
              <svg class="mr-1.5 size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              新建主题
            </button>
            <div class="grid grid-cols-2 gap-1.5">
              <button data-lib-import class="btn-ghost h-7 px-2 text-2xs" title="从 .json 导入主题包">
                <svg class="mr-1 size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3M7 10l5 5 5-5M5 21h14"/></svg>
                导入
              </button>
              <button data-lib-export class="btn-ghost h-7 px-2 text-2xs" title="导出全部主题为一个 .json">
                <svg class="mr-1 size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 8l5-5 5 5M5 21h14"/></svg>
                导出全部
              </button>
            </div>
          </div>
        </div>
        <div data-side="closed" class="${sidebarClosed ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col items-center gap-2 px-2 py-2.5">
          <button data-side-toggle class="grid size-9 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-white" aria-label="展开主题库">
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M16 9l-3 3 3 3"/></svg>
          </button>
          <button class="grid size-9 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-white" aria-label="搜索主题" title="搜索主题 ⌘K">
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          </button>
          <div class="my-0.5 h-px w-6 bg-slate-200"></div>
          <div id="themeRail" class="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto"></div>
        </div>
      </aside>

      <main id="main" class="${mainClass}"></main>
    </div>
  </div>

  <div id="cmdk" class="fixed inset-0 z-50 hidden">
    <div class="absolute inset-0 bg-slate-950/30" data-cmdk-backdrop></div>
    <div class="absolute left-1/2 top-24 w-[520px] -translate-x-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
      <div class="flex items-center gap-2.5 border-b border-slate-100 px-3.5 py-3">
        <svg class="size-4 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input id="cmdkInput" placeholder="搜索主题、动作、设置…" class="min-w-0 flex-1 border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" />
        <span class="kbd">esc</span>
      </div>
      <div id="cmdkList" class="max-h-[380px] overflow-y-auto p-1.5"></div>
      <div class="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-3.5 py-2 text-2xs text-slate-400">
        <span>↑↓ 选择 · ↵ 执行</span><span>⌘1–5 直接切换工作区</span>
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
  bar.innerHTML = '<span class="mr-1 text-2xs font-semibold text-slate-900">窗口尺寸</span>'
    + `<div class="seg-group">${VIEWPORTS.map(([id, label]) => `<button data-vp="${id}" class="seg-item${id === viewportId ? ' seg-item-on' : ''}">${label}</button>`).join('')}</div>`
    + '<span id="viewportNote" class="ml-auto text-2xs text-slate-500"></span>';
  app.parentNode.insertBefore(bar, app);
  bar.querySelectorAll('[data-vp]').forEach((b) => b.addEventListener('click', () => applyViewport(b.dataset.vp)));
  paintViewportNote(viewportId);   // 初始档也要有说明，否则默认状态下这一行是空的
}
const VIEWPORT_NOTES = {
  default: ['真实桌面端默认窗口（workbench-window.ts）', 'text-slate-500'],
  large: ['这套设计最舒展时的样子，但它不是默认', 'text-slate-500'],
  min: ['Electron 允许拖到的最小尺寸——这一档暴露的是必须提高 minWidth/minHeight 的证据', 'font-medium text-amber-700'],
};
function paintViewportNote(id) {
  const note = document.getElementById('viewportNote');
  if (!note) return;
  const [text, tone] = VIEWPORT_NOTES[id] || ['', 'text-slate-500'];
  note.textContent = text;
  note.className = `ml-auto text-2xs ${tone}`;
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
    b.className = 'seg-item' + (b.dataset.vp === id ? ' seg-item-on' : '');
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

  // 原型状态切换条（不属于产品 UI）
  const protoHost = document.getElementById('proto');
  if (protoHost && proto.length) {
    protoHost.className = 'mx-auto mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-900 px-3 py-2';
    protoHost.style.width = `${VIEWPORTS[0][2]}px`;
    protoHost.innerHTML = `<span class="mr-1 text-2xs font-semibold text-white">原型状态</span>`
      + proto.map(([id, label]) => `<button data-proto="${id}" class="proto-btn h-7 rounded-lg px-2.5 text-2xs font-medium">${label}</button>`).join('')
      + `<span class="ml-auto text-2xs text-slate-400">${hint}</span>`;
  }

  mountViewportBar();

  const app = document.getElementById('app');
  app.innerHTML = shellMarkup(active, mainClass);

  const tpl = document.getElementById('page');
  if (tpl) document.getElementById('main').append(tpl.content.cloneNode(true));

  renderThemes();
  bindShell(proto, onProto);
  syncHistoryUi();
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

function renderThemes(selected = 'mono') {
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
      <div class="mt-1 text-2xs leading-relaxed text-slate-400">名称、摘要、内置/自定义都会被搜到</div>
      <button data-clear-search class="btn-outline mt-2.5 h-7 px-2.5 text-2xs">清空搜索</button>
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
  if (list) list.innerHTML = shown.map((t) => `
    <div data-theme="${t.id}" class="side-theme${t.id === selected ? ' side-theme-on' : ''}">
      <span class="grid size-8 shrink-0 place-items-center rounded-xl text-2xs font-semibold ${t.id === selected ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-500'}">${t.glyph}</span>
      <span class="min-w-0 flex-1">
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="min-w-0 truncate text-sm font-medium text-slate-900">${markHit(t.name)}</span>
          ${t.dirty ? '<span class="size-1.5 shrink-0 rounded-full bg-amber-400" title="有未保存的改动"></span>' : ''}
          <span class="ml-auto inline-flex shrink-0 items-center rounded-full ${t.kind === '内置' ? 'bg-slate-100 text-slate-600' : 'bg-slate-900 text-white'} px-1.5 py-0.5 text-2xs font-medium">${t.kind}</span>
        </span>
        <!--
          摘要改成折两行而不是截断：侧栏是固定 248px，在真实默认的 960px 窗口下
          文字框只有 125px 而摘要要 147px，四条摘要**全部**被截成「黑白灰 · 方块粒子 · 几...」，
          恰好把最有辨识度的那部分（粒子形状 / 波纹类型）切掉了。
          侧栏纵向有大片空余，折行的代价接近于零；截断的代价是四个主题看起来一模一样。
        -->
        <span class="mt-0.5 line-clamp-2 block text-2xs leading-relaxed text-slate-500">${markHit(t.summary)}</span>
      </span>
      <button data-theme-menu="${t.id}" class="grid size-6 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="${t.name} 更多操作" aria-haspopup="menu">
        <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
      </button>
    </div>`).join('');
  if (list) bindThemeMenus(selected);
  if (rail) rail.innerHTML = shown.map((t) => `
    <button data-theme="${t.id}" class="relative grid size-10 shrink-0 place-items-center rounded-xl border ${t.id === selected ? 'border-slate-950 bg-white shadow-sm' : 'border-slate-200 bg-white'}" title="${t.name}" aria-label="选择主题 ${t.name}">
      <span class="grid size-7 place-items-center rounded-lg text-2xs font-semibold ${t.id === selected ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-500'}">${t.glyph}</span>
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
    b.className = 'proto-btn h-7 rounded-lg px-2.5 text-2xs font-medium ' + (on ? 'bg-white text-slate-900' : 'text-slate-300 hover:bg-slate-800');
  });
  document.querySelectorAll('[data-show]').forEach((el) => {
    el.classList.toggle('hidden', !el.dataset.show.split(' ').includes(id));
  });
  onProto?.(id);
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
  const imp = document.querySelector('[data-lib-import]');
  const exp = document.querySelector('[data-lib-export]');
  // 导入是**新增**一个主题，所以要能撤销；导出只产出文件、不改状态，所以不需要。
  // 这条区分就是决策 #7「一次性结果 → toast（带撤销）」的具体应用。
  if (imp) imp.addEventListener('click', () => {
    const added = { id: `imported-${THEMES.length}`, name: '导入的主题', kind: '自定义', summary: '来自 .json · 3 个动作已配置', glyph: '导' };
    THEMES.push(added);
    renderThemes(currentThemeId);
    toast(`已导入「${added.name}」`, () => {
      const i = THEMES.indexOf(added);
      if (i >= 0) THEMES.splice(i, 1);
      renderThemes(currentThemeId);
      return () => { THEMES.push(added); renderThemes(currentThemeId); };
    });
  });
  if (exp) exp.addEventListener('click', () => toast(`已导出全部 ${THEMES.length} 个主题为 cursordance-themes.json`));
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
  document.addEventListener('keydown', (e) => {
    const inField = e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName);
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); toggleCmdk(); return; }
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
    if (e.key === 'Escape') { toggleCmdk(false); return; }
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
let sidebarClosed = true;
let sidebarAutoDecided = false;
function setSidebar(closed) {
  sidebarClosed = closed;
  document.getElementById('sidebar').className = 'flex shrink-0 flex-col border-r border-slate-200 bg-slate-100 ' + (closed ? 'w-[60px]' : 'w-[248px]');
  document.querySelector('[data-side="open"]').classList.toggle('hidden', closed);
  const c = document.querySelector('[data-side="closed"]');
  c.classList.toggle('hidden', !closed);
  c.classList.toggle('flex', closed);
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
    return `<div class="flex items-baseline gap-1.5 px-2 pb-1 pt-2"><span class="text-2xs font-semibold text-slate-400">${group}</span>`
      + (hit.length > 6 ? `<span class="text-2xs tabular-nums text-slate-300">${hit.length}</span>` : '') + '</div>'
      + hit.slice(0, 12).map(([label, key, run]) => {
        const idx = cmdkRuns.push(run || null) - 1;
        return `<button data-run="${idx}" class="cmdk-item">
          <svg class="size-3.5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          <span class="min-w-0 flex-1 truncate">${label}</span>${key ? `<span class="kbd">${key}</span>` : ''}</button>`;
      }).join('')
      + (hit.length > 12 ? `<div class="px-2 pb-1 text-2xs text-slate-400">还有 ${hit.length - 12} 条，继续输入以缩小范围</div>` : '');
  }).join('');
  const list = document.getElementById('cmdkList');
  list.innerHTML = html || '<div class="px-2 py-6 text-center text-2xs text-slate-400">没有匹配的命令</div>';
  list.querySelectorAll('[data-run]').forEach((b) => b.addEventListener('click', () => {
    const fn = cmdkRuns[Number(b.dataset.run)];
    toggleCmdk(false);
    fn?.();
  }));
}

// ── 自动保存 + 撤销：全站统一（取代脏状态 + 保存按钮）
function touch() {
  const el = document.getElementById('saveState');
  if (!el) return;
  el.innerHTML = '<svg class="size-3 animate-spin text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 1 0 9 9"/></svg> 保存中';
  clearTimeout(touch.t);
  touch.t = setTimeout(() => {
    el.innerHTML = '<svg class="size-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg> 已保存';
  }, 420);
}
function toast(text, undo) {
  touch();
  if (undo) { hist().undo.push(undo); hist().redo.length = 0; }
  syncHistoryUi();
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  el.className = 'pointer-events-auto flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg';
  el.innerHTML = `<span class="text-xs font-medium text-slate-600">${text}</span>`;
  if (undo) {
    const b = document.createElement('button');
    b.className = 'text-2xs font-semibold text-slate-900 underline underline-offset-2';
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
