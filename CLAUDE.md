# CLAUDE.md

## 当前阶段：UI 原型稿优先（2026-08-04 起）

**`docs/ui-spec/` 是桌面版前端重构的唯一依据，优先级高于其它一切文档。**

稿子里一个假的预览、一个说谎的裁决条，都会被原样实现进真实代码——所以稿子的
正确性就是重构的正确性。当前阶段的任务是把稿子修到能当依据用，**不是**改 `src/`。

三条纪律：

1. **稿子与其它文档冲突时以稿子为准**，但**必须在 `docs/ui-spec/DECISIONS.md` 登记裁决**
   （现状 / 冲突双方 / 裁决 / 理由 / 影响页面）。不允许静默偏离——已经发生过
   8 次静默反转，后果是重构的人会同时读到两份互相矛盾的"已定稿"规格。
2. **不改 `src/`。** 可以改：`docs/ui-spec/**`、`docs/*.md`、`DESIGN.md`、
   `CLAUDE.md`、`scripts/check-*.mjs` 门禁。读 `src/` 来核对稿子是鼓励的
   （功能对等清点、以及查"稿子是不是复刻了一个已修好的缺陷"都靠它）。
3. **「页面渲染正常」永远不是验证结论。** 必须真的点，而且要**改一个状态再看别处**
   ——稿子里绝大多数缺陷都是「A 变了 B 没跟着变」这一类，只点单个控件永远发现不了。

### 改动稿子后的必跑流程

```bash
# 1. 重编样式（新增任何类之后必跑，否则 Tailwind 会按 content 扫描把 @layer components 摇掉）
npx tailwindcss -c docs/ui-spec/tailwind.config.cjs -i docs/ui-spec/_src.css -o docs/ui-spec/mockup.css --minify
# 2. 两道门禁（各自都做过「注入违规 → 确认报出 rule id → 还原」自测）
npm run check:ui-spec && npm run check:design-tokens
```

再用 `preview_*` 起 dev server（**不要用 curl 判断服务在不在**，沙箱只放行两个 host），
在三档窗口（960×680 默认 / 1440×892 大屏 / 720×480 最小）下跑机械探针，四项都必须为 0：

| 探针 | 判据 |
| --- | --- |
| 可达性 | `document.elementFromPoint` 在每个可交互元素中心的返回值必须是它自己或其子孙。**先排除落在滚动容器可见框之外的元素**，否则横向滚动条里的每个页签都会被误报，真正的问题会淹在噪声里 |
| aria 状态成对 | 带选中/展开态的 `<button>` 必须有 `aria-pressed\|checked\|selected\|expanded`，**且每次点击之后与视觉类同侧** |
| 滑块可访问名 | `.sl-thumb` 的 `aria-label` / `aria-valuemin` / `aria-valuemax` 缺失数为 0（`Ctl.slider` 推导不到名字时会留 `data-noname` 并 warn） |
| 竖排单字 | 宽度 < 1.6em 且高度 > 2.2em 的纯文本节点数为 0 |

**静态门禁与运行时探针必须两边都跑，缺一不可。** 这不是保险起见：
`aria-state-missing` 有一版判据把 `class="action-tab${on ? …}"` 整族漏掉了
（基类紧跟模板占位符、中间没有空格），静态侧打印 PASS，而浏览器里 5 个动作页签
一个 aria 状态都没有——**是运行时探针把它翻出来的**。反过来，
`text-2xs` 每页计数这类事只有静态侧数得准。

探针里凡是「改一个状态再看别处」的检查，**先确认测试自己是幂等的、测量点是对的**：
有一次把 9 个字段判成「绑定没生效」，实际是上一批已经把值设成了目标值，再设一次自然没变化；
还有一次测量点选在飘字入场之前（t=420，而它 424.4ms 才开始）。
**两次都是探针在说谎，不是稿子在说谎。**

## Session Startup
When starting a new session for **desktop app development**, read these files first (in order):
1. `docs/ui-spec/DECISIONS.md` — 决策裁决表，冲突以它为准
2. `PROGRESS.md` — current phase, completed tasks, active branch, blockers
3. `steady-painting-yeti-prompts.md` — copy the prompt for the next unchecked task

Do NOT re-read the full plan (`docs/plans/steady-painting-yeti.md`) unless crossing a phase boundary or hitting an unexpected issue not covered by the prompts.

## Language
All new code must be written in **TypeScript** (`.ts` / `.tsx`). Legacy `.js` / `.jsx` files may be migrated incrementally but new features, components, and utilities must use TypeScript from the start.

## Overview
CursorDance is both a **Chrome extension (Manifest V3)** and an **Electron desktop application** (in development). It adds customizable mouse interaction effects — particles, ripples, text, animations, custom cursors — to web pages (extension) or to the entire OS desktop (desktop app via transparent overlay windows).

The repo uses **npm workspaces** for monorepo management:
- `cursor-dance-api/` — standalone Node.js AI API server
- `landing/` — independent Vite landing page build
- Root — core extension (Vite MPA: workbench + popup + content scripts) + desktop app (electron-vite: main + preload + renderer)

See `ARCHITECTURE.md` for the directory layout and platform boundaries.

## Commands

Use Node.js 22.12 or newer (`.nvmrc` is the repository baseline).

```
# Extension
npm run dev           # Vite dev server (workbench + popup)
npm run build         # Production build → dist/
npm run test          # Vitest unit tests (extension + shared UI + desktop)
npm run test:smoke    # Playwright E2E smoke tests
npm run ai:dev        # AI API server (scripts/ai-api-server.mjs)

# Desktop (Electron)
npm run dev:electron  # electron-vite dev
npm run build:electron # electron-vite build
npm run package:mac   # electron-builder --mac
npm run package:win   # electron-builder --win
```

## Architecture

### Shared design system
- `DESIGN.md` — unified design language (colors, typography, spacing, radius, shadows, motion, interaction states). Applies to both extension and desktop.
- `DESIGN-desktop.md` — desktop-only UI surfaces (window chrome, tray, keyboard shortcuts, branding)
- Design tokens and UI components in `src/components/ui/` are shared across extension and desktop

### Chrome Extension (existing)
- Three entrypoints: Workbench (`index.html`), Popup (`popup.html`), Content runtime (`src/extension/`)
- Content runtime is authored as TypeScript modules and bundled by Vite into one MV3-compatible IIFE artifact
- Storage: `chrome.storage.local` with localStorage fallback
- Build: Vite MPA (`vite.config.js`) plus the dedicated content bundle (`vite.extension.config.js`)

### Electron Desktop App (new)
```
src/
├── app/                # Shared UI — Workbench + Popup pages (both platforms)
├── components/         # Shared UI component library
├── shared/             # Shared utilities + runtime detection
│   ├── ipc-channels.ts   # Desktop IPC channel constants
│   ├── config/           # Canonical v4 defaults and key-feedback config
│   └── runtime.ts        # PLATFORM / isDesktop() / isExtension()
└── desktop/            # Desktop app (Electron) — all desktop-only code
    ├── main/              # Electron main process
    │   ├── index.ts       # App lifecycle, single-instance lock
    │   ├── windows.ts     # createOverlayWindow, createWorkbenchWindow
    │   ├── tray.ts        # System tray + context menu
    │   ├── ipc-handlers.ts # All ipcMain.handle registrations
    │   ├── native-events.ts # uiohook-napi global mouse capture
    │   ├── electron-store.ts # electron-store config persistence
    │   └── api-server.ts  # cursor-dance-api embedded in main process
    ├── preload/
    │   └── index.ts       # contextBridge: cursorDanceAPI, cursorDanceStorage
    └── renderer/
        ├── engine/        # Shared effect engine (used by both Workbench preview AND overlay)
        │   ├── visual-effects.ts   # Element.animate() rendering
        │   ├── cursor-overlay.ts   # Software cursor
        │   ├── audio.ts            # Web Audio API synthesis
        │   ├── trigger-handlers.ts # Event → action pipeline
        │   ├── config-store.ts     # Config resolution
        │   ├── compute-specs.ts    # Particle/ripple/animation math
        │   ├── action-config.ts    # Action config field pickers
        │   ├── text-semantics.ts   # Text classification (pure data)
        │   ├── app-matcher.ts      # App rule matching (replaces site-matcher)
        │   └── diagnostics.ts      # Runtime event logging
        ├── workbench/     # ThemeWorkbenchPage (reused from extension)
        ├── overlay/       # Overlay window entry (thin: IPC binding → engine)
        └── popup/         # Tray popup panel (reused from extension)
```

### Content script module system (extension only)
The extension is built from `src/extension/content-entry.ts` into one MV3-compatible
IIFE bundle. Shared effect core/runtime, action trigger pipeline, visual effects, cursor overlay and
diagnostics are regular TypeScript modules; audio, page atmosphere and web rule adapters are also
TypeScript modules. `src/extension/content-runtime.ts` directly composes the adapters and owns startup,
configuration bridges, DOM listeners and teardown. Canonical v4 defaults live in `src/shared/config/`;
the extension no longer loads classic runtime scripts or configuration globals.

### Workbench component tree
```
ThemeWorkbenchPage
├── WorkbenchHeader          # Workspace switcher, save, enable toggle
├── ThemeLibrarySidebar      # Create/duplicate/delete/import/export themes
└── main (by workspaceId)
    ├── workbench            # Action config + preview + optional AI panel
    ├── states (StatesPanel) # Cursor state management (platform-filtered: 6 web / 2 desktop)
    ├── sites (SiteRulesPanel)   # Per-host site rules (extension) / per-app rules (desktop)
    └── diagnostics          # Diagnostic event viewer
```

### State management
- `themeWorkbenchStateStore.js` — `useReducer` with 20+ action types
- `useThemeWorkbenchState.js` — Main hook exposing all state + actions
- `useThemeWorkbenchPersistence.js` — Extension: hydrates from `chrome.storage.local`. Desktop: hydrates via IPC → `electron-store`
- Key: `cursordance.config` (Chrome storage / electron-store), schema v2

### Data format (post-unification)
Theme packs store config in `workbenchDraft.actionConfigs` with ~50 flat fields per action covering: trigger, text, particle, ripple, audio, animation, image, cursor feedback.

Default action configs live in two places:
- **Runtime**: `config-store.js` → `getBaseActionConfigs()` (hardcoded for content script)
- **Workbench**: `actionConfigPresets.js` → `getDefaultActionConfigs(themeId)` (importable)

These must stay in sync. A test at `actionConfigSync.test.js` validates this automatically by comparing both outputs.

### Storage module (`src/app/pages/theme-workbench/lib/storage/`)
Chrome Storage API wrappers, split by responsibility (was `extensionStorage.js`, 622 lines):
```
lib/storage/
├── chrome-api.js       # Constants + Chrome API helpers (getChromeApi, canUseLocalStorage, etc.)
├── config-io.js        # Read/write/clear config (extension + live preview) via chrome.storage
├── subscriptions.js    # Storage change listeners (extension config, live preview, runtime diagnostics)
├── extras.js           # Theme export, cursor assets, site context, preview, runtime errors, debug flag
└── index.js            # Barrel re-export (extensionStorage.js re-exports from here)
```

Desktop replaces the storage backend with a `StorageAdapter` interface:
- Extension: `ChromeStorageAdapter` (wraps `chrome.storage.local/session` + localStorage fallback)
- Desktop: `ElectronStoreAdapter` (wraps `electron-store` via IPC)

### AI Scheme Assistant + Agent
Workbench panel with two modes:
- **快速模式** — calls `POST /api/ai/scheme-proposals/stream` (SSE), model generates structured JSON proposal directly
- **Agent 模式** — calls `POST /api/ai/agent/run` (SSE), model uses Function Calling tools (`apply_config_patch`, `get_current_config`, `rollback`, `finalize_proposal`) in a ReAct loop (max 5 iterations) with per-step observability

Backend (`cursor-dance-api/`) is a standalone Node/FC project.

Desktop: the API server runs as an embedded module in the main process or as a forked child process. API endpoint is configurable via `electron-store` (not build-time `VITE_*` env vars).

### Runtime effects pipeline
DOM events (extension) or global mouse IPC events (desktop) → `trigger-handlers.js/ts` resolves cursor state binding and checks trigger zone/throttle/combo windows → `visual-effects.js/ts` renders effects via Web Animations API.

Desktop trigger actions: leftClick, rightClick, doubleClick, longPress, wheel (5 actions; no hover — no DOM to hover over).

Desktop removes: audio ducking (no page media to duck), site-matcher (replaced by app-matcher), atmosphere magnet/text-selection modes (DOM-dependent).

### Landing page (`landing/`)
Independent Vite + React build for the public website. Not part of the Electron app.

## Design
- `docs/ui-spec/DECISIONS.md` — **决策裁决表，冲突以它为准**
- `docs/ui-spec/README.md` — 稿子怎么画的、走查记录、实现级教训（教训不因裁决失效）
- `DESIGN.md` — unified design language for both extension and desktop。动效与色彩两节
  已在 2026-08-04 按裁决 10/11 重写：**动效三层模型**（L1 反馈 150ms / L2 布局因果 200ms
  允许 transform / L3 内容效果不受约束）、**颜色三类**（外壳 / 语义 / 内容·分类色）、
  `prefers-reduced-motion` 改为硬约束
- `DESIGN-desktop.md` — desktop-only UI surfaces (window chrome, tray, keyboard, branding)
- `docs/ux-rearchitecture-spec.md` — 信息架构与任务流的原始论证。**其保存栏 / `DirtyState`
  相关条目已被裁决 1 废弃**，其余（作用域表、§5 页面约束、§6 应用规则模型、§8 实现边界）仍有效

## No-go areas

### Extension-specific
- Do NOT add `behavior.click.effects` back — this old format was removed (2026-05-24)
- Do NOT reintroduce classic content-runtime scripts or a `window.CursorDanceContentModules` registry
- Keep popup, workbench, and content runtime data shapes synchronized

### Desktop-specific
- Do NOT introduce a second component library (MUI, Ant Design, shadcn CLI). Use existing `src/components/ui/` + Radix UI
- Do NOT mix native widgets with Chromium-rendered UI — all UI surfaces use the same design tokens
- Do NOT add `hover` trigger action on desktop (no DOM context)
- Do NOT add audio ducking on desktop (no page media)
- Do NOT let engine logic diverge between extension and desktop — cross-platform behavior belongs in `src/shared/effect-core/` or `src/shared/effect-runtime/`
- Keep the action-config, text-semantics, and compute-specs parity tests green whenever shared engine semantics change

### 已被裁决替换的 no-go 条目（保留可追溯，不要再当规则引用）

这些条目仍写在上面或 `DESIGN.md` 里，但已由 `docs/ui-spec/DECISIONS.md` 推翻：

| 原条目 | 替换来源 |
| --- | --- |
| 「颜色只有两类」/「每视图只用一个强调色」适用于全部界面 | 裁决 11：新增内容色/分类色，`每视图一个强调色` 只约束外壳 |
| 「禁止 transform 过渡（仅 `active:scale`）」/「时长统一 150ms」 | 裁决 10：L2 布局因果层允许 transform，200ms |
| 「自动保存 + 撤销，删掉保存按钮」= 编辑即刻生效到运行时 | 裁决 1：草稿与运行时分开，新增「应用到桌面」 |
| `text-2xs` = 10px | 裁决 8：统一 11px |
| 托盘面板是「最高频入口」（320px 自绘面板） | 裁决 9：跟随 `PROGRESS.md` R1-6，降级成原生菜单 |
| 创作型 Agent 与 AI 助手是两个页面、「不要合并」 | 裁决 7：已并入 `06`，对用户只有一个 AI 入口 |

### General
- Read `docs/project-stabilization-todo.md` and `docs/engineering-backlog.md` before large architecture changes
- Keep `npm run build` (extension) and `npm run test` green — do not break the extension while building the desktop app
