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
  <div class="mx-auto flex h-[892px] max-w-[1440px] flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-lg">
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
      <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div class="flex min-w-0 items-center gap-1.5 overflow-x-auto">
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
      <aside id="sidebar" class="flex w-[248px] shrink-0 flex-col border-r border-slate-200 bg-slate-100">
        <div data-side="open" class="flex min-h-0 flex-1 flex-col">
          <div class="flex items-center gap-2 px-3 py-2.5">
            <button data-side-toggle class="grid size-8 shrink-0 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-white" aria-label="收起主题库">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M13 9l3 3-3 3"/></svg>
            </button>
            <div class="relative min-w-0 flex-1">
              <svg class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
              <input placeholder="搜索主题" class="h-8 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-2 text-xs text-slate-700 shadow-sm placeholder:text-slate-400" />
            </div>
          </div>
          <div id="themeList" class="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-2"></div>
          <div class="shrink-0 border-t border-slate-200 px-3 py-2.5">
            <button class="btn-outline h-8 w-full px-3 text-xs">
              <svg class="mr-1.5 size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              新建主题
            </button>
          </div>
        </div>
        <div data-side="closed" class="hidden min-h-0 flex-1 flex-col items-center gap-2 px-2 py-2.5">
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

function mountShell(opts) {
  const { active, proto = [], onProto, hint = '', mainClass = 'min-w-0 flex-1 overflow-y-auto bg-slate-50 px-3 py-3' } = opts;

  // 原型状态切换条（不属于产品 UI）
  const protoHost = document.getElementById('proto');
  if (protoHost && proto.length) {
    protoHost.className = 'mx-auto mb-4 flex max-w-[1440px] flex-wrap items-center gap-2 rounded-xl bg-slate-900 px-3 py-2';
    protoHost.innerHTML = `<span class="mr-1 text-2xs font-semibold text-white">原型状态</span>`
      + proto.map(([id, label]) => `<button data-proto="${id}" class="proto-btn h-7 rounded-lg px-2.5 text-2xs font-medium">${label}</button>`).join('')
      + `<span class="ml-auto text-2xs text-slate-400">${hint}</span>`;
  }

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

function renderThemes(selected = 'mono') {
  const list = document.getElementById('themeList');
  const rail = document.getElementById('themeRail');
  if (list) list.innerHTML = THEMES.map((t) => `
    <div data-theme="${t.id}" class="side-theme${t.id === selected ? ' side-theme-on' : ''}">
      <span class="grid size-8 shrink-0 place-items-center rounded-xl text-2xs font-semibold ${t.id === selected ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-500'}">${t.glyph}</span>
      <span class="min-w-0 flex-1">
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="min-w-0 truncate text-sm font-medium text-slate-900">${t.name}</span>
          ${t.dirty ? '<span class="size-1.5 shrink-0 rounded-full bg-amber-400" title="有未保存的改动"></span>' : ''}
          <span class="ml-auto inline-flex shrink-0 items-center rounded-full ${t.kind === '内置' ? 'bg-slate-100 text-slate-600' : 'bg-slate-900 text-white'} px-1.5 py-0.5 text-2xs font-medium">${t.kind}</span>
        </span>
        <span class="mt-0.5 block truncate text-2xs leading-relaxed text-slate-500">${t.summary}</span>
      </span>
      <button data-theme-menu="${t.id}" class="grid size-6 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="${t.name} 更多操作" aria-haspopup="menu">
        <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
      </button>
    </div>`).join('');
  if (list) bindThemeMenus(selected);
  if (rail) rail.innerHTML = THEMES.map((t) => `
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

function bindShell(proto, onProto) {
  document.querySelectorAll('[data-proto]').forEach((b) => b.addEventListener('click', () => setProto(b.dataset.proto, proto, onProto)));
  document.querySelectorAll('[data-side-toggle]').forEach((b) => b.addEventListener('click', () => {
    const closed = !document.querySelector('[data-side="closed"]').classList.contains('hidden');
    setSidebar(!closed);
  }));
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
function setSidebar(closed) {
  document.getElementById('sidebar').className = 'flex shrink-0 flex-col border-r border-slate-200 bg-slate-100 ' + (closed ? 'w-[60px]' : 'w-[248px]');
  document.querySelector('[data-side="open"]').classList.toggle('hidden', closed);
  const c = document.querySelector('[data-side="closed"]');
  c.classList.toggle('hidden', !closed);
  c.classList.toggle('flex', closed);
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
