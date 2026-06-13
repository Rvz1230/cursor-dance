# CursorDance Chrome 扩展 → Electron 桌面应用 迁移方案

## Context

CursorDance 目前是一个 Chrome Manifest V3 扩展，在网页内渲染光标特效（粒子、波纹、文字、自定义光标等）。本方案将其改造为 **Electron 桌面应用**，效果覆盖整个操作系统桌面（所有应用之上），而非仅限于浏览器页面。

核心思路：保留现有的 React 管理界面和 DOM-based 效果渲染引擎，用 Electron 的透明浮层窗口 + 系统级鼠标事件捕获替代 Chrome 扩展的运行环境。

## 已确认需求

| 维度 | 决策 |
|------|------|
| 产品形态 | 全桌面特效，所有 app 之上生效 |
| 使用场景 | 日常办公、演示录屏、桌面美化 |
| 触发动作 | 6 种全保留：左键、右键、双击、长按、滚轮、悬停 |
| 平台 | macOS + Windows 双平台，macOS 先做 |
| 保留功能 | AI 方案助手、多主题管理、应用规则（原站点规则）、自定义光标图片、音效 |
| 新增功能 | 软件光标替代系统光标（基于现有自定义光标图片功能扩展） |
| 不做 | 悬停动作（桌面语义不明确，先不做，交付 5 种动作）；音频闪避（桌面无页面媒体） |
| 发布模式 | 免费、开源 |

### 软件光标动画方案

基于现有 `cursor-overlay.js` 的 `stateCursorNode`（DOM `<img>` 跟随鼠标）扩展，三种动画方式可选：

| 方式 | 实现 | 场景 |
|------|------|------|
| CSS animation 播放 spritesheet | 帧序列光标（走路小动物等） |
| `Element.animate()` (Web Animations API) | 缩放、旋转、淡入淡出 |
| JS 逐帧切换 `img.src` | 与插件版自定义光标图片机制完全一致，复用数据模型 |

不需要 Mousecape 那样的 CoreGraphics 私有 API。

### 预览 ↔ 运行时渲染一致性（关键发现）

**现状问题**：插件版的两个渲染实现是**不同的**——
- 预览面板（`WorkbenchPreviewRail.tsx`）：用 CSS `@keyframes` + `<style>` 标签注入 + CSS 自定义属性
- 运行时（`visual-effects.js`）：用 `Element.animate()` API 直接操作 DOM

这导致预览看到的效果和实际网页渲染的**不一定完全一致**。

**桌面版解决方案**：统一为一个渲染引擎。

Workbench 预览面板的 `SimplePreviewStage` 和 overlay 窗口都 import 同一个 `engine/visual-effects.ts`，调用相同的 `renderParticles(x, y, config)` 等函数。Workbench 预览渲染在一个内嵌 `<div class="preview-stage">` 里（绝对定位、800×400），overlay 渲染在全屏浮层里——渲染目标不同，但渲染逻辑完全相同。

具体做法：
- 把 `public/content-runtime/visual-effects.js` 迁移为 `src/renderer/engine/visual-effects.ts`（ES module）
- Workbench 预览面板和 overlay 入口都 import 它
- 预览面板用 `previewAtViewportCenter()` 模拟一次鼠标事件，overlay 用全局鼠标 IPC 事件
- 现有的 `WorkbenchPreviewRail.tsx` 里 CSS @keyframes 预览代码逐步废弃，改为调用 engine 模块

### 全屏 / Spaces 兼容

已验证：Electron 可以做到在全屏应用和多桌面 Space 之上渲染透明浮层。

macOS 关键三板斧：
```javascript
app.dock.hide();
win.setAlwaysOnTop(true, 'screen-saver');           // 最高层级，非 'floating'
win.setVisibleOnAllWorkspaces(true, {
  visibleOnFullScreen: true,
  skipTransformProcessType: true,
});
```

配合渲染器节流防止（macOS Sequoia 15.x 已知坑）：
```javascript
webPreferences: {
  backgroundThrottling: false,
  additionalArguments: [
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-features=CalculateNativeWinOcclusion',
  ],
},
win.webContents.setBackgroundThrottling(false);
win.webContents.setFrameRate(60);
```

### 应用规则匹配方案

使用 `get-windows`（sindresorhus 出品，`active-win` 的继任者，Node 18+, ESM）获取活跃窗口元数据。

三级匹配，用户在工作台配置里可选：

| 优先级 | 匹配维度 | 来源字段 | 例子 |
|--------|----------|----------|------|
| 1 | 进程名 | `owner.name` | `Google Chrome`, `Code` |
| 2 | Bundle ID（macOS）| `owner.bundleId` | `com.microsoft.VSCode` |
| 3 | 窗口标题（模糊）| `title` | `index.ts — cursor-dance` |

匹配模式沿用插件版的 `exact` / `glob` 两种。

### 技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| 桌面框架 | Electron 33+ | Chromium 内核完全兼容 Web Animations API + Web Audio API |
| 构建 | electron-vite | 与现有 Vite 生态无缝对接，原生 multi-renderer |
| UI | React 18 + 现有自定义 Radix UI 封装 + framer-motion + Tailwind CSS 3 | 已有 11 个 UI 组件（button/select/slider/tabs/toast/dialog/popover/accordion/alert-dialog/input/switch），设计语言在 DESIGN.md 明确定义 |
| 状态 | useReducer（不动）| 现有 themeWorkbenchStateStore 直接复用 |
| 存储 | electron-store | JSON 文件持久化，API 最简 |
| 全局鼠标 | uiohook-napi | 跨平台；抽象 IInputSource 接口，macOS ARM 出问题可用 CGEvent fallback |
| 活跃窗口 | get-windows | 跨平台获取进程名/标题/Bundle ID |
| 打包 | electron-builder | macOS dmg/zip + Windows nsis/portable |
| 更新 | electron-updater | GitHub Releases 分发 |
| AI 服务 | 主进程内嵌模块 | cursor-dance-api 纯 HTTP 代理 I/O 绑定，不阻塞事件循环 |

**不引入**：Redux/Zustand（useReducer 够用）、React Router（工作台用 tab 切换）、Tailwind v4（保持 v3 减少摩擦）、shadcn/ui CLI（项目已有自定义封装，风格与 shadcn 不同）

### 设计体系：统一基础 + 桌面扩展

不拆成两套独立的设计体系。工作台、面板卡、控件、弹出面板、AI 助手、诊断面板在两个版本里是同一份 React 代码，共享同一套视觉规范。

```
DESIGN.md（基础体系，插件版 + 桌面版共用）
├── 色彩    ← light mode，预留 dark 扩展位（v2）
├── 排版    ← 增加桌面原生字号对齐（macOS 11pt / Windows 9pt body）
├── 间距    ← 4px 基准标度（4/8/12/16/20/24/32/48）
├── 圆角阴影 ← 增加 overlay 窗口专属层级
├── 动效    ← 增加页面转场、面板展开/收起（继承 framer-motion）
├── 交互状态 ← 增加 pressed / focus ring / dragged
└── 组件规范 ← Button/Select/Slider/... 两个版本同一套代码，不变

DESIGN-desktop.md（桌面版专属，仅补充插件版不存在的 UI 表面）
├── 窗口体系   ← 标题栏、红绿灯对齐、最小尺寸、overlay 窗口层级
├── 系统托盘   ← 托盘菜单、弹出面板动画
├── 键盘与菜单 ← 快捷键体系、macOS 菜单栏
└── 品牌落地   ← 托盘图标、DMG 背景、应用图标
```

### 窗口标题栏方案

窗口标题栏是窗口最顶部的 bar，包含标题文字和窗口控制按钮（macOS 红绿灯）。插件版没有这个概念（浏览器自带标签栏+地址栏），桌面版需要处理。

**决策**：
- Workbench 窗口：**自绘标题栏**（`frame: false` + CSS `-webkit-app-region: drag`），和现有 `WorkbenchHeader.tsx` 的 workspace tab 栏合并，做成紧凑顶栏
- Overlay 窗口：无标题栏（透明浮层，不需要）
- Tray Popup 窗口：无边框 + 无标题栏（纯内容 + 圆角 + 阴影浮动面板）
- Windows 平台自绘标题栏行为与 macOS 不同（双击最大化、拖拽边缘 resize），需要平台判断

## 遗漏点与补充（全面审查后）

以下是在方案初稿后，对照原项目所有功能模块逐一排查发现的缺口和问题。

### 触发区域匹配：桌面版该怎么做？

**问题**：`trigger-handlers.js` 的 `matchesTriggerZone()` 依赖于 DOM——用 `target instanceof Element`、`target.closest()` 判断用户点击在什么类型的元素上（链接、按钮、文本区等）。桌面版本**没有 DOM 元素**可匹配。

**决策**：
- v1（当前）：所有触发区域当作「任意区域」，`matchesTriggerZone` 恒返回 `true`
- v2（未来）：基于 `get-windows` 返回的活跃窗口信息做粗略分类——比如浏览器窗口里点击 vs 编辑器窗口里点击，用于不同的应用规则。这是一个递进功能，不做在当前版本

### creative mouse (atmosphere.js)：削还是留？

**问题**：`atmosphere.js` 是 100% DOM 依赖的——元素磁铁模式（`.cm-blend-layer` 包装 DOM 子元素）、文本选择模式（`getComputedStyle`、`textContent`）、magnet 目标扫描（`document.querySelectorAll('.g-animation')`）。这些在桌面上完全无法运行。

**决策**：只保留 **normal follow 模式**（内点即时跟随 + 外点 lerp 缓动）。这部分是纯坐标运算 + `requestAnimationFrame`，不含 DOM 依赖。磁铁模式和文本选择模式**削掉**。

实施：从 `atmosphere.js` 提取 `updateFollow()` 函数（约 60 行）和 `animate()` rAF 循环，其余约 300 行删除。

### 软件开发光标 ≠ 系统光标替换

需要澄清：桌面版的软件光标是在 overlay 窗口用 DOM 元素绘制的，和系统光标是**两个独立的东西**。

- 系统光标继续正常存在，但 overlay 窗口内用 CSS `cursor: none` 隐藏了它
- 软件光标是 overlay 里一个跟随鼠标的 `<img>` / `<div>`
- 当用户在当前桌面使用 CursorDance 时，overlay 盖在所有屏幕之上，所以系统光标始终被 overlay 隐藏
- 用户感知到的是软件光标（跟自定义光标图片功能完全一致）

注意：这跟 Mousecape 的 `CoreGraphics` API 调用完全不是一回事。Mousecape 是在操作系统层面替换光标，CursorDance 桌面版只是用 overlay 窗口**遮住**系统光标、用自己的 DOM 元素**模拟**一个。

### 首次启动 / 引导

原插件版**没有新手引导**。桌面版需要从头建：
- 首次启动：自动打开 Workbench 窗口，展示默认主题，提示用户「点击桌面任意位置试试效果」
- 辅助功能权限请求提示（macOS 全局鼠标事件需要）（原插件不需要）
- 可选：带 2-3 步的简短功能导览

不做过度的引导流程——聚焦在「打开即用」。

### 主题导入/导出：文件对话框适配

**导出**：原来用 `<a download>` + `Blob` URL。Electron 中 `blob:` URL 可能被阻止导航。改为 `dialog.showSaveDialog()` + `fs.writeFile()`。
**导入**：原来用 `<input type="file">`，在 Electron 中可直接用。也可改为 `dialog.showOpenDialog()` 更符合桌面体验。

### 不再活跃的功能（趁迁移机会清理）

- **悬停动作（hover）**：桌面不适用，删除相关 handler 和 UI 配置卡（`HoverFeedbackCard` 在 workbench 里的悬停配置面板要保留还是隐藏？————隐藏，菜单栏里不显示 hover 选项）
- **音频闪避（audio-duck-profile.js）**：桌面无页面媒体，删除
- **site-matcher.js**：URL 匹配 → 应用匹配，重写，但数据模型保留

### 可安全保留的组件

- **StateTestZone.tsx** — 纯 React 事件处理，在 Electron 完全可用
- **DiagnosticsPanel.tsx** — UI 是纯 React，只需替换底层的 `chrome.storage.local` → `electron-store`
- **text-semantics.js** — 零 DOM 依赖，纯数据转换，直接迁
- **PopupPage.tsx** — 绝大多数逻辑（主题选择、预览、开启/关闭）不依赖 chrome API，只需替换 2 个调用（`openOptionsPage` 和 `chrome.tabs.sendMessage`）

```
Main Process（主进程）
├── uiohook-napi        → 全局鼠标事件捕获
├── screen              → 多显示器管理
├── Tray                → 系统托盘 + 右键菜单
├── electron-store      → 配置持久化（替代 chrome.storage）
├── Window Manager      → 创建/销毁 overlay 窗口 + workbench 窗口
├── IPC Handlers        → 主进程 ↔ 渲染进程通信桥梁
└── AI Server (fork)    → cursor-dance-api 子进程

Renderer Processes（渲染进程）
├── Overlay Window × N  → 每显示器一个透明穿透窗口，运行效果引擎
│   └── 复用的效果引擎（visual-effects, cursor-overlay, audio, atmosphere）
├── Workbench Window    → 主题编辑器（复用现有 ThemeWorkbenchPage）
└── Tray Popup Window   → 快捷切换面板（复用现有 PopupPage）
```

## 阶段零：代码梳理与公共组件提取（开始写桌面代码之前）

### 目标
在不影响现有插件版的前提下，把共享代码归置到位，桌面版能直接引用。只动文件位置和导出格式，不改业务逻辑。

### 0.1 提取 StorageAdapter 接口

**问题**：`config-io.ts`、`subscriptions.ts`、`extras.ts` 中 `chrome.storage.*` 调用和配置读写/订阅逻辑混在一起，桌面版需要干净的接口插槽。

**动作**：
```typescript
// src/shared/storage/StorageAdapter.ts（新文件）
interface StorageAdapter {
  readConfig(): Promise<Config>;
  writeConfig(config: Config): Promise<void>;
  readLivePreview(): Promise<Config | null>;
  writeLivePreview(config: Config): Promise<void>;
  clearLivePreview(): Promise<void>;
  onChanged(callback: (config: Config) => void): () => void;
}
```

插件版提供 `ChromeStorageAdapter`（封装 `chrome.storage.local/session`），桌面版提供 `ElectronStoreAdapter`（封装 `electron-store` + IPC）。`config-io.ts` 中的 `normalizeStoredConfig`、`resolveCursorAssets` 等纯数据转换函数不碰。

### 0.2 提取 WorkbenchControls 通用部分到 `src/components/ui/`

**问题**：`WorkbenchControls.tsx` 包含 14 个组件，其中 Panel、FieldRow、ControlSlider、SectionTitle、SmallSelect、ColorOptions、ThemeCard 等是通用表单/布局组件，桌面版所有新设置界面都需要。

**动作**：
- `Panel`, `SectionTitle`, `FieldRow`, `ControlSlider`, `SmallSelect`, `ColorOptions`, `ThemeCard` → 移到 `src/components/ui/`
- `ActionTab`, `ColumnResizeHandle` 等 workbench 专属的留在原地
- 现有 import 路径更新（IDE 全局搜索替换）

### 0.3 纯函数文件迁移

**问题**：`public/config-runtime/compute-specs.js`、`action-config.js`、`text-semantics.js` 是零依赖纯函数，但写成 IIFE 挂 `window.CursorDanceConfigHelpers`，桌面版 ES module 不能 import。

**动作**：
- 迁成 `src/renderer/engine/compute-specs.ts`、`action-config.ts`、`text-semantics.ts`
- 导出为具名 ESM export
- 插件版的 `public/config-runtime/` 里用 `window.CursorDanceConfigHelpers` 继续引用，不破坏现有扩展构建
- 注意：`action-config.js` 和 `text-semantics.js` 是「两个入口同一份逻辑」，保证两边同步即可

### 0.4 清理 Chrome API 降级代码

**问题**：storage 目录中大量 `getChromeApi()` 检查 + `localStorage` fallback + `BroadcastChannel` fallback——约 200 行。Electron 中主进程始终在线，不需要这些 fallback。

**动作**：在提取 `StorageAdapter` 接口后，插件版的 `ChromeStorageAdapter` 保留现有降级逻辑（因为开发时 Vite dev server 不提供 chrome API）。桌面版 `ElectronStoreAdapter` 无需 fallback。删除的是工作台渲染进程中只针对桌面版的降级代码——插件版的不动。

### 0.5 保持插件版功能不变

**原则**：阶段零的所有变动**必须在 npm run build（扩展构建）通过后才算完成**。Vitest 测试套件（98 tests）和 Playwright smoke tests 全部绿才进入阶段一。

| 梳理动作 | 影响范围 | 产出 |
|----------|----------|------|
| 提取 `StorageAdapter` 接口 | `storage/` 目录 | `src/shared/storage/StorageAdapter.ts`，双版本各注入实现 |
| 抽 `WorkbenchControls` 通用部分到 `ui/` | `src/components/ui/` | Panel, FieldRow, ControlSlider, SectionTitle, SmallSelect, ColorOptions, ThemeCard |
| `compute-specs.js` → `.ts` | `public/config-runtime/` → `src/renderer/engine/` | 双版本共用纯函数 |
| `action-config.js` → `.ts` | 同上 | 双版本共用纯函数 |
| `text-semantics.js` → `.ts` | 同上 | 双版本共用纯函数 |
| 清理 `chrome.*` 降级代码 | `storage/*.ts` | 删除约 200 行（仅针对桌面版分支） |
| 验证 | 根目录 | `npm run build` + `npm run test` 全绿 |

## 阶段一：项目脚手架

### 目标
在 monorepo 中加入 Electron 构建能力，同时保持现有 Chrome 扩展构建可用。

### 具体步骤

1. **安装依赖**
   - `electron` (^28+), `electron-vite`, `electron-builder` 加入 root `devDependencies`
   - `electron-store` 加入 dependencies
   - `uiohook-napi` 加入 dependencies（全局鼠标事件）

2. **目录结构**
   ```
   src/
   ├── main/              # NEW: Electron 主进程
   │   ├── index.ts       # 应用生命周期、单实例锁
   │   ├── windows.ts     # createOverlayWindow, createWorkbenchWindow
   │   ├── tray.ts        # 系统托盘
   │   ├── ipc-handlers.ts
   │   ├── native-events.ts  # uiohook-napi 封装
   │   ├── screen-utils.ts   # 多显示器/DPI
   │   └── electron-store.ts # electron-store 封装
   ├── preload/           # NEW: preload 脚本
   │   └── index.ts       # contextBridge 暴露 cursorDanceAPI
   └── renderer/          # 迁移自 src/app/pages
       ├── workbench/     # 主题编辑器（React, 几乎不动）
       ├── popup/         # 托盘弹出面板（React, 几乎不动）
       └── overlay/       # NEW: 透明浮层效果引擎
           ├── index.html
           ├── index.ts   # 入口：绑定 IPC 事件 → trigger pipeline
           └── engine/    # 从 public/content-runtime/ 迁移的效果模块
   ```

3. **electron-vite.config.mjs**
   - 三个渲染进程入口：workbench, popup-tray, overlay
   - 主进程和 preload 配置
   - 保留 `@` → `src/renderer` 别名
   - Tailwind CSS v3 + PostCSS 配置复用

4. **package.json scripts**
   ```json
   {
     "dev:electron": "electron-vite dev",
     "build:electron": "electron-vite build",
     "package:mac": "electron-builder --mac",
     "package:win": "electron-builder --win"
   }
   ```
   保留现有的 `dev`, `build`, `test` 等扩展构建脚本。

### 关键决策
- 选 `electron-vite` 而非 `electron-forge`：项目已深度使用 Vite + React + TS，electron-vite 集成最自然
- 保持非严格 TypeScript 模式 (`strict: false`) 以降低迁移摩擦

---

## 阶段二：效果引擎迁移（核心工作）

### 2.1 事件源替换

**现状**：`public/content-runtime/trigger-handlers.js` 监听 `document` 上的 DOM 指针事件（capture phase）。

**改造**：
1. `src/main/native-events.ts` → 使用 `uiohook-napi` 捕获全局鼠标事件（mousemove, mousedown, mouseup, wheel）。**不含 hover**——桌面版不做悬停动作（5 种触发动作：左键、右键、双击、长按、滚轮）
2. 主进程通过 IPC 广播到所有 overlay 窗口：`overlayWindow.webContents.send('cursor-event', normalizedEvent)`
3. preload 暴露 `window.cursorDanceAPI.onCursorEvent(callback)`
4. `src/renderer/overlay/index.ts` 将 IPC 事件桥接到 trigger pipeline

**注意**：`uiohook-napi` 可能在某些平台有问题（Apple Silicon, 特定 Linux 发行版）。抽象一个 `IInputSource` 接口，必要时可替换为 `iohook` 或 `@nut-tree/nut-js`。

### 2.2 透明浮层窗口

每个显示器创建一个 `BrowserWindow`：

```typescript
app.dock.hide();                                                  // 隐藏 Dock（macOS）
const win = new BrowserWindow({
  transparent: true,
  frame: false,
  alwaysOnTop: true,
  skipTaskbar: true,
  focusable: false,
  type: 'normal',                // macOS: 不用 'toolbar'/'panel'，避免 Spaces 管理 bug
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,
    sandbox: false,
    backgroundThrottling: false,
    additionalArguments: [
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-features=CalculateNativeWinOcclusion',
    ],
  },
});
win.setIgnoreMouseEvents(true, { forward: true });
win.setAlwaysOnTop(true, 'screen-saver');                          // 最高层级，盖过全屏
win.setVisibleOnAllWorkspaces(true, {
  visibleOnFullScreen: true,
  skipTransformProcessType: true,
});
win.setFullScreenable(false);
win.webContents.setBackgroundThrottling(false);
win.webContents.setFrameRate(60);
```

`type: 'normal'` 而非 `'toolbar'/'panel'`，因为在 macOS 14+ 上 `panel` 类型与虚拟桌面切换存在已知冲突。

`src/main/screen-utils.ts` 负责：
- `screen.getAllDisplays()` 遍历创建窗口
- 监听 `display-added` / `display-removed` / `display-metrics-changed`
- DPI 缩放因子处理

### 2.3 渲染引擎改造 + 预览一致性策略

**关键发现**：效果引擎使用 `Element.animate()`（Web Animations API）+ 纯 DOM 操作，在 Electron Chromium 渲染进程中**完全兼容**。

**插件版的预览与运行时是两个不同的实现**（`WorkbenchPreviewRail.tsx` 用 CSS @keyframes + `<style>` 注入，`visual-effects.js` 用 `Element.animate()`），桌面版统一为**单一引擎**。

```
统一渲染引擎 (src/renderer/engine/)
├── visual-effects.ts      ← Element.animate() 渲染
├── cursor-overlay.ts      ← 软件光标
├── audio.ts               ← Web Audio API
├── trigger-handlers.ts    ← 事件 → 动作 pipeline
├── config-store.ts        ← 配置解析
├── atmosphere.ts          ← creative mouse 氛围
├── compute-specs.ts       ← 纯数学计算
├── action-config.ts       ← 动作配置字段
├── text-semantics.ts      ← 文字语义
├── default-config.ts      ← 默认配置
├── app-matcher.ts         ← 应用规则匹配
└── diagnostics.ts         ← 诊断日志
         ↑
         │  import
    ┌────┴──────────────┐
    │                   │
Workbench 预览          Overlay 窗口
(内嵌 <div>)           (全屏透明浮层)
使用 previewAtCenter()  使用全局鼠标 IPC 事件
```

- 引擎模块放在 `src/renderer/engine/`（共享路径，绕开 workbench/overlay 目录）
- 预览面板和 overlay 入口都 **import 同一个 `visual-effects.ts`**，调用相同的 `renderParticles(x, y, config)` 等函数
- 唯一区别：预览用 `previewAtViewportCenter()` 模拟，overlay 用全局鼠标 IPC 事件
- 不需要验证一致性——代码是同一份

**引擎入口**（`src/renderer/engine/entry.ts`）做 DI 注入：
```typescript
export function createEffectEngine(deps: {
  window: Window;
  document: Document;
  configStore: ConfigStore;
}) {
  const visualEffects = createVisualEffects(deps);
  const audioRuntime = createAudioRuntime(deps);
  const cursorOverlay = createCursorOverlay(deps);
  const triggerHandlers = createTriggerHandlers(deps);
  return { visualEffects, audioRuntime, cursorOverlay, triggerHandlers };
}
```

预览面板和 overlay 各自提供自己的 `window`/`document`，引擎逻辑完全共享。

从 `public/content-runtime/` 迁移到 `src/renderer/engine/`：

| 源文件 | 新文件 | 改动 |
|--------|--------|------|
| `visual-effects.js` | `engine/visual-effects.ts` | 移除 IIFE，ES module；移除 chrome.* 调用 |
| `cursor-overlay.js` | `engine/cursor-overlay.ts` | DOM 事件绑定 → 结构化事件消费 |
| `audio.js` | `engine/audio.ts` | 移除音频闪避，Web Audio API 不变 |
| `trigger-handlers.js` | `engine/trigger-handlers.ts` | 事件源从 DOM event 变为结构化 CursorEvent；移除 hover 相关逻辑 |
| `config-store.js` | `engine/config-store.ts` | chrome.storage → 静态数据注入（不含 chrome API 调用） |
| `atmosphere.js` | `engine/atmosphere.ts` | DOM 事件 → 结构化事件 |
| `compute-specs.js` | `engine/compute-specs.ts` | 纯数学，几乎不动 |
| `action-config.js` | `engine/action-config.ts` | 几乎不动 |
| `text-semantics.js` | `engine/text-semantics.ts` | 几乎不动 |
| `config.js` | `engine/default-config.ts` | 移除 IIFE，ES module |
| `diagnostics.js` | `engine/diagnostics.ts` | 适配 |
| `site-matcher.js` | `engine/app-matcher.ts` | URL hostname 匹配 → 进程名/标题匹配 |
| `audio-duck-profile.js` | **删除** | 桌面模式不需要 |

### 2.4 光标隐藏策略

方案：overlay 窗口注入 CSS `* { cursor: none !important }`，同时在 overlay 内用 DOM 元素渲染软件光标（即现有的 `stateCursorNode` 模式来自 `cursor-overlay.js`）。系统原生光标在 overlay 区域内被 CSS 隐藏。

### 2.5 可复用的关键文件

以下纯逻辑代码几乎不需要改动：
- `public/config-runtime/compute-specs.js` — 粒子物理、波纹层、动画视觉样式计算
- `src/app/pages/theme-workbench/hooks/themeWorkbenchStateStore.ts` — 状态管理 reducer
- `src/app/pages/theme-workbench/model/` — 数据模型和默认配置
- `src/components/ui/` — 所有 shadcn-style UI 组件
- `cursor-dance-api/src/` — 整个 AI 服务端逻辑

---

## 阶段三：存储与通信

### 3.1 存储替换

**现状**：`src/app/pages/theme-workbench/lib/storage/chrome-api.ts` 通过 `getChromeApi()` 抽象，`config-io.ts` 实现 chrome.storage.local/session 读写。

**改造**：
- 创建 `src/main/electron-store.ts`，封装 `electron-store`（本地 JSON 文件）
- 通过 preload bridge 暴露给渲染进程：
  ```typescript
  contextBridge.exposeInMainWorld('cursorDanceStorage', {
    readConfig: () => ipcRenderer.invoke('storage:read-config'),
    writeConfig: (c) => ipcRenderer.invoke('storage:write-config', c),
    onChanged: (cb) => { /* IPC listener */ },
  });
  ```
- 修改 `config-io.ts`：`getChromeApi()` 调用 → `window.cursorDanceStorage` 调用，保留 `normalizeStoredConfig` 等数据转换逻辑
- 替换 `subscriptions.ts`：`chrome.storage.onChanged` → `window.cursorDanceStorage.onChanged`
- 移除 `ensurePreviewStorageAccess()`（Chrome 特有）

### 3.2 通信替换

| Chrome Extension | Electron 桌面版 |
|---|---|
| `chrome.tabs.sendMessage` | `overlayWindow.webContents.send` |
| `chrome.runtime.onMessage` | `ipcRenderer.on` |
| `chrome.storage.onChanged` | `electron-store.onDidChange` + IPC 广播 |
| `BroadcastChannel` | Electron IPC（主进程作为消息总线） |
| `chrome.tabs.query` | `get-windows`（sindresorhus，`active-win` 继任者，Node 18+ ESM）获取活跃窗口进程名/标题/Bundle ID |

### 3.3 现有优雅降级模式的处理

项目中每个 `chrome.*` 调用都有 `localStorage` + `BroadcastChannel` 降级。在 Electron 中这个模式可以简化：
- 主进程保证 storage 和 IPC 始终可用
- 不需要 localStorage 降级检查
- 可以删除相关的 fallback 代码

---

## 阶段四：UI 迁移

### 组件策略：不引入第三套组件库

项目已有**11 个自定义 UI 组件**（`src/components/ui/`）：Button, Select, Slider, Switch, Tabs, Toast, Dialog, Popover, Accordion, AlertDialog, Input。基于 Radix UI + Tailwind CSS + `cn()` 组合模式，配合 **14 个共享工作台组件**（`WorkbenchControls.tsx`：Panel, FieldRow, ControlSlider, ColorOptions, TextTagEditor 等）。

**决策**：不引入 shadcn/ui CLI、MUI、Ant Design 等任何第三套组件库。理由：
- 项目组件已经成熟且与 DESIGN.md 对齐，引入新库会造成双重风格并存
- 桌面版特有 UI（托盘菜单、应用选择器、窗口标题栏）的量很小，基于现有基元手写即可
- 所有 UI 通过 Chromium 渲染，视觉风格统一（无 native widget 混搭）

### UI 一致性保证

1. **DESIGN.md 即真理**：所有新组件通过 `baseline-ui` skill 校验——动画时长、排版层级、圆角/阴影/border/颜色 token、13 项禁止模式
2. **`cn()` 是唯一入口**：所有样式组合经过 `cn()` (clsx + tailwind-merge)，不写任意值
3. **WorkbenchControls 基元复用**：Panel, FieldRow, ControlSlider, ColorOptions 等 14 个组件是所有面板卡的积木，新 UI 必须复用
4. **类型安全**：`className` prop 模式 + `React.forwardRef` 在所有组件上保持一致

### 4.1 Workbench（主题编辑器）

`ThemeWorkbenchPage` 及所有子组件 **零改动复用**。唯一的适配是入口文件：
- 现有：`main.tsx` 挂载到 `index.html` 的 `#root`
- 桌面版：electron-vite 渲染进程入口挂载到 workbench 窗口

`BrowserWindow` 配置：1280×860 可缩放，标准窗口。窗口标题栏使用 Electron 原生 + CSS `-webkit-app-region: drag` 自定义。

### 4.2 Popup → 系统托盘

**重构**：`src/main/tray.ts`
- 系统托盘图标 + 右键菜单（开启/关闭、打开工作台、退出）
- 可选的托盘弹出面板：复用 `PopupPage` 组件，渲染到一个 320×520 的无边框浮动窗口（类似 1Password / Dropbox 的托盘面板）

### 4.3 站点规则 → 应用规则

`SiteRulesPanel` 组件需要改造：
- URL hostname 匹配 → 三级匹配（进程名 / Bundle ID / 窗口标题）
- "站点" → "应用" 的概念转换
- UI 上用应用选择器（运行中进程列表 + 手动输入 glob 模式）替代 URL 输入框

数据模型 `siteRules` 可保留，扩展匹配字段：新增 `matchType: 'process' | 'bundleId' | 'title'`，原有 `pattern.value` 和 `pattern.type` 保留。

---

## 阶段五：AI API 服务集成

### 方案
将 `cursor-dance-api/` 作为 Electron 主进程内的模块直接运行（因为它是纯 I/O 绑定的 HTTP 代理，不会阻塞事件循环）：

```typescript
// src/main/api-server.ts
import { createServer } from '../../cursor-dance-api/src/server.mjs';
const server = createServer();
server.listen(port);
```

更简单的替代方案：`child_process.fork()` 启动 API 服务子进程，通过 stdout 解析监听端口。

API 端点从构建时 `VITE_CURSORDANCE_AI_API_ENDPOINT` 改为运行时 `electron-store` 配置项，在工作台的设置面板可修改。

---

## 阶段六：构建与打包

### 6.1 electron-vite.config.mjs

三渲染进程入口配置：
```javascript
renderer: {
  build: {
    rollupOptions: {
      input: {
        workbench: 'src/renderer/workbench/index.html',
        overlay: 'src/renderer/overlay/index.html',
        popupTray: 'src/renderer/popup/index.html',
      },
    },
  },
  resolve: { alias: { '@': 'src/renderer' } },
}
```

### 6.2 electron-builder.yml

目标平台：macOS (dmg + zip), Windows (nsis + portable), Linux (AppImage + deb)

macOS 需要：
- `com.apple.security.cs.disable-library-validation` entitlement（uiohook-napi 需要）
- 辅助功能权限（全局鼠标事件捕获）
- Apple Developer 证书用于公证

### 6.3 自动更新

使用 `electron-updater`，每 4 小时检查一次更新，通过 GitHub Releases 分发。

### 6.4 保持 Chrome 扩展构建

现有的 `vite.config.js` 和 `public/` 目录**完全不动**。`package.json` 中保留 `dev` / `build` 脚本用于扩展构建，新增 `dev:electron` / `build:electron` / `package:mac` / `package:win` 脚本。

---

## 执行顺序与依赖

```
阶段零（代码梳理）──→ 阶段一（脚手架）──→ 阶段三（存储通信）
                          │                    │
                          ├──→ 阶段四（UI）    │
                          │                    │
                          └──→ 阶段二（引擎）←─┘
                          │
                          └──→ 阶段五（AI 服务）
                                   │
                                   └──→ 阶段六（打包）
```

- 阶段零必须先做——不梳理干净就开始写代码，两套逻辑必然分叉
- 阶段一在阶段零基础上走
- 阶段三和阶段四可与阶段二并行
- 阶段五是独立的，随时可做
- 阶段六是最后阶段

## 风险与缓解

| 风险 | 级别 | 缓解措施 |
|------|------|----------|
| `uiohook-napi` 在目标平台不兼容 | 高 | 抽象 IInputSource 接口；备选 iohook / nut.js；早期在 macOS + Windows 验证 |
| 透明穿透窗口在不同平台行为不一致 | 中 | 早期在 macOS (native window level) 和 Windows (不同 compositor) 测试 |
| 多显示器 DPI 混合导致浮层错位 | 中 | 用 `screen.getAllDisplays()` + `scaleFactor`；混合 DPI 设置下测试 |
| macOS 代码签名/公证 | 中 | Apple Developer 账号；electron-notarize；CI 集成 |

## 落地过程中可能遇到的难题（逐阶段推演）

以下是在实际写代码过程中可能碰到的具体问题。

### 阶段零可能遇到的

**`compute-specs.js` 对 `window` 全局的隐式依赖。** 这个文件看起来是纯函数，但实际上它引用了 `globalThis.CursorDanceConfigHelpers` 上的其他函数。迁 `.ts` 时这些跨模块引用需要改成显式 import，可能爆出原来被 IIFE 包装掩盖的循环引用问题。
→ **缓解**：迁一个模块跑一次 `npm run test`，不批量迁。vitest 能直接 import TypeScript，测试不会漏。

**TypeScript 严格模式差异。** 插件版 `strict: false` 允许大量 `any` 和隐式 `undefined` 通过编译。迁成 `.ts` 放到 `src/renderer/engine/` 下时，如果该目录启用了 `strict: true`，会出现很多类型错误。
→ **缓解**：阶段零不提高任何文件的严格度。迁 `.ts` 时保留 `strict: false` 配置，类型收紧放在后续迭代单独做。

### 阶段一可能遇到的

**`electron-vite` 和 Tailwind CSS 的 PostCSS 集成。** electron-vite 使用 `@vitejs/plugin-react`，但它的 renderer 构建路径和普通 Vite 项目不同。PostCSS 配置可能需要显式指定给 renderer，否则 Tailwind 生成的 CSS 可能不会被注入到 HTML 入口。
→ **缓解**：创建 electron-vite 项目后第一件事就是跑通一个带 Tailwind utility 的 `<div className="bg-slate-100">`，确认样式生效。

**npm 依赖冲突。** `uiohook-napi` 在 macOS ARM 上需要编译原生模块。Electron 的 Node 版本和系统 Node 版本可能不同，导致编译的二进制不兼容。
→ **缓解**：用 `electron-rebuild` 重建原生模块；`package.json` 里加 `rebuild` 脚本。

### 阶段二可能遇到的

**IPC 事件延迟。** 全局鼠标事件通过主进程 → IPC → 渲染进程，路径比 DOM 事件（同步的 `addEventListener`）长。如果进程间有序列化瓶颈，可能出现光标拖尾/延迟。
→ **缓解**：在 `native-events.ts` 中只转发结构化的最小数据 `{ type, x, y, buttons, timestamp }`，不做复杂计算。效果引擎直接消费坐标，不需要等待主进程响应。

**多个 overlay 窗口同时渲染的性能。** 两个显示器 = 两个 overlay 窗口 = 两个独立的 Chromium 渲染进程。粒子效果同时触发时，两个进程都在跑 `Element.animate()`。如果不做 max effects cap，CPU 可能吃满。
→ **缓解**：现有的 `state.activeEffects >= getMaxActiveEffects()` 限流机制在 engine 层复用。每个 overlay 窗口独立维护 `state.activeEffects` 计数，不需要跨进程同步。

**`mousewheel` 事件的 delta 差异。** macOS 的触控板滚动会发送连续的 `mousewheel` 事件，每次都有极小的 delta 值。Windows 的鼠标滚轮发送离散的 120 倍数 delta。如果直接用增量触发效果，macOS 会效果爆炸。
→ **缓解**：在 `native-events.ts` 中对 macOS 做「滚动开始」检测——累积 delta 达到阈值才第一次触发，之后每 N ms 触发一次连续效果。现有 wheel handler 已经有 burst suppression，逻辑直接复用。

### 阶段三可能遇到的

**`electron-store` 文件竞争。** 主进程和 overlay 窗口同时读取 `cursordance-config.json` 是安全的（读不冲突），但如果 workbench 在写的时候 overlay 在读，`electron-store` 不保证事务一致性。小概率出现 overlay 读到半截 JSON。
→ **缓解**：所有 `electron-store` 写操作集中在一个地方（`ipc-handlers.ts` 的 `storage:write-config` handler），Node.js 的 `fs.writeFile` 是原子的（写临时文件 + rename）。读操作哪怕读到旧版本也不影响效果——config 是声明式的，不需要强一致。

**`get-windows` 在 macOS 上需要辅助功能权限。** 读取活跃窗口标题的 API 在 macOS 上属于辅助功能范围。如果用户不授权，`activeWindow()` 可能返回空值。
→ **缓解**：应用规则在权限未授权时降级——全局配置生效（无应用差异），应用规则面板显示「需要辅助功能权限」提示和授权引导按钮。

### 阶段四可能遇到的

**自绘标题栏的跨平台行为差异。** `-webkit-app-region: drag` 在 macOS 和 Windows 上表现一致，但「双击最大化」「窗口投影」「边缘 resize」的行为在两个平台上由系统控制。如果自绘标题栏区域侵占到系统控制区（比如 macOS 红绿灯区域），会冲突。
→ **缓解**：标题栏左侧预留 80px 空白给 macOS 红绿灯（`padding-left: 80px` on `darwin`）。Windows 平台的红绿灯在右侧，行为不同——用 `process.platform` 判断布局。

**`PopupPage` 移植到浮动窗口时尺寸感知。** 插件版 `PopupPage` 被 Chrome 强制 360×540。桌面版如果浮动窗口尺寸不同，`PopupPage` 的布局可能崩——Tailwind 响应式断点是 `md`/`lg` 而不是固定 px。
→ **缓解**：桌面版浮动窗口设为相近尺寸（320×520），用 `min-width`/`min-height` 约束。如果 `PopupPage` 用了 `h-dvh` 之类的响应式单位，改为具体 px。

### 阶段五可能遇到的

**AI API 服务端口冲突。** 主进程内嵌 `cursor-dance-api` 监听固定端口（默认 8787）。如果用户机器上已经有其他服务占用这个端口，启动失败。
→ **缓解**：端口探测 + 回退——先试 8787，占用则随机选择空闲端口。端口信息写入 `electron-store`，渲染进程读配置后拼出 API URL。

**API key 存储。** 插件版 API key 存在 Chrome storage 里（`chrome.storage.local`，本地加密）。桌面版存 `electron-store`（明文 JSON）安全性不够。
→ **缓解**：用 `safeStorage.encryptString()` / `decryptString()` 加密 API key。Electron 在主进程提供这个 API，密钥由 OS keychain 管理。

### 阶段六可能遇到的

**macOS 公证（notarization）失败。** 如果 `uiohook-napi` 的原生库没有用 `hardenedRuntime` 签名，公证会拒绝。
→ **缓解**：`electron-builder.yml` 配置 `hardenedRuntime: true` + entitlements 文件列明需要加载未签名的原生模块（`com.apple.security.cs.disable-library-validation`）。CI 用 `xcrun notarytool` 提交公证。

**Windows SmartScreen 警告。** 新应用在 Windows 上没有足够的安装基数，SmartScreen 会弹出「Windows 已保护你的电脑」。用户流失率很高。
→ **缓解**：做代码签名证书（EV Code Signing Certificate），提交给 Microsoft Defender 做信誉积累。免费应用尤其需要——因为没有付费转化的信任背书。

## 验证策略

1. **脚手架验证**：`npm run dev:electron` 启动空白 Electron 窗口
2. **引擎验证**：在 overlay 窗口中渲染单个粒子/波纹效果，确认 IPC 事件 → 效果渲染通路
3. **存储验证**：Workbench 修改配置 → electron-store 文件变化 → overlay 效果实时生效
4. **完整流程验证**：Workbench 编辑主题 → 保存 → 桌面任意位置点击/移动鼠标 → 效果正确渲染
5. **多显示器验证**：两个显示器各有一个 overlay，效果在对应显示器上正确定位
6. **打包验证**：`npm run package:mac` 生成可安装的 .dmg，安装后功能完整

## 分支策略

```
main ────────────────────────────────────────────→ (扩展日常迭代，bug fix 正常发布)
  │
  └── desktop/main ────────→ (桌面版开发主分支)
       │
       ├── desktop/phase-0  → 代码梳理
       ├── desktop/phase-1  → 脚手架
       ├── desktop/phase-2  → 引擎迁移
       ├── desktop/phase-3  → 存储通信
       ├── desktop/phase-4  → UI 迁移
       ├── desktop/phase-5  → AI 服务
       └── desktop/phase-6  → 打包
```

**规则**：
- 每个阶段从 `desktop/main` 切出，完成后合回 `desktop/main`
- 合入前必须 `npm run build`（扩展构建）+ `npm run test` 全绿
- `desktop/main` 定期从 `main` pull 保持同步
- 桌面版整体完成并稳定后，从 `desktop/main` 合回 `main`

## 阶段性开发计划与验收标准

每个阶段都有明确的前置条件、交付物、和可验收的门槛。

### 阶段零：代码梳理（预计 3-5 天）

**前置**：`main` 分支 `npm run build` + `npm run test` 全绿

**交付物**：
- [ ] `src/shared/storage/StorageAdapter.ts` — 接口定义
- [ ] `ChromeStorageAdapter` — 封装 chrome.storage 实现（保持现有降级逻辑）
- [ ] Panel, FieldRow, ControlSlider, SectionTitle, SmallSelect, ColorOptions, ThemeCard 移入 `src/components/ui/`
- [ ] `compute-specs.ts`, `action-config.ts`, `text-semantics.ts` 在 `src/renderer/engine/` 重建为 ES module
- [ ] storage 中 chrome.* 降级代码清理（仅桌面版路径，保留扩展版降级）

**验收**：
- [ ] `npm run build` 扩展构建成功
- [ ] `npm run test` 98 tests 全绿
- [ ] `npm run test:smoke` 通过
- [ ] IDE 中 `src/renderer/engine/compute-specs.ts` 可以 import 并调用纯函数

**不交付**：不写任何 Electron 代码，不改任何业务逻辑

### 阶段一：项目脚手架（预计 3-5 天）

**前置**：阶段零全部验收通过

**交付物**：
- [ ] `electron`, `electron-vite`, `electron-builder` 安装
- [ ] `electron-vite.config.mjs` 配置（main + preload + 3 renderer entry）
- [ ] `src/main/index.ts` — 启动后创建空白 1280×860 窗口
- [ ] `src/preload/index.ts` — contextBridge 占位
- [ ] `src/renderer/workbench/index.html` + entry — 渲染 ThemeWorkbenchPage
- [ ] `npm run dev:electron` 可启动并展示 Workbench 页面
- [ ] Tailwind CSS + PostCSS 在 renderer 进程中正常生效

**验收**：
- [ ] `npm run dev:electron` 成功启动 Electron 窗口
- [ ] Workbench 界面完整渲染（从 electron-store 读取默认配置）
- [ ] Tailwind utility class（如 `bg-slate-100`）在桌面窗口内生效
- [ ] `npm run build` 扩展构建仍然成功
- [ ] `npm run test` 仍然全绿

### 阶段二：效果引擎迁移（预计 8-12 天）

**前置**：阶段一全部验收通过

**交付物**：
- [ ] `src/renderer/engine/visual-effects.ts` — Element.animate() 渲染，DI 注入 window/document
- [ ] `src/renderer/engine/cursor-overlay.ts` — 软件光标 DOM 跟随
- [ ] `src/renderer/engine/audio.ts` — Web Audio API（移除音频闪避）
- [ ] `src/renderer/engine/trigger-handlers.ts` — 5 种动作 pipeline（移除 hover）
- [ ] `src/renderer/engine/config-store.ts` — 不吃 chrome.*，吃静态注入
- [ ] `src/renderer/engine/atmosphere.ts` — 仅 normal follow 模式
- [ ] `src/renderer/engine/app-matcher.ts` — 进程名/标题匹配（替换 site-matcher）
- [ ] `src/main/native-events.ts` — uiohook-napi 封装 + IInputSource 接口
- [ ] `src/renderer/overlay/index.html` + entry — overlay 窗口绑定 IPC 事件
- [ ] 单 overlay 窗口（当前主显示器）可渲染效果
- [ ] Workbench 预览面板 import engine 模块，替换 CSS @keyframes 预览

**验收**：
- [ ] 启动桌面版，鼠标左键点击 → overlay 窗口渲染粒子/波纹效果
- [ ] 右键、双击、滚轮、长按 4 种动作分别触发正确效果
- [ ] 软件光标（自定义光标图片）在 overlay 中跟随鼠标（`cursor: none` 隐藏系统光标）
- [ ] Workbench 预览面板调用 engine 渲染效果（非 CSS 模拟）
- [ ] 调整 Workbench 中的颜色/大小/动画参数，预览和桌面实时同步（同一套 config）
- [ ] `configStore.getMaxActiveEffects()` 限流生效（不会因连续点击爆 CPU）
- [ ] `npm run build` + `npm run test` 仍然全绿

### 阶段三：存储与通信（预计 4-6 天）

**前置**：阶段一全部验收通过（可与阶段二并行）

**交付物**：
- [ ] `ElectronStoreAdapter` — 实现 StorageAdapter 接口
- [ ] IPC handler `storage:read-config` / `storage:write-config` / `storage:config-changed`
- [ ] `src/shared/ipc-channels.ts` — 所有 IPC channel 名称集中维护
- [ ] `preload/index.ts` 暴露 `cursorDanceStorage` API
- [ ] Workbench 读写配置通过 IPC → electron-store（替换 chrome.storage）
- [ ] config change 通知机制（electron-store.onDidChange → IPC → renderer）
- [ ] 主题导入/导出改为 `dialog.showSaveDialog` / `dialog.showOpenDialog`
- [ ] `get-windows` 集成，获取活跃窗口元数据
- [ ] 删除扩展版的 `localStorage` / `BroadcastChannel` 降级代码（仅桌面路径）

**验收**：
- [ ] Workbench 修改配置 → 保存 → electron-store JSON 文件更新
- [ ] 关闭重开应用 → 配置完整恢复
- [ ] 修改主题 → overlay 窗口实时收到配置变更 → 效果参数变化
- [ ] 导入 .cursordance-theme.json 文件 → 主题库新增主题
- [ ] 导出主题 → 保存对话框弹出 → 文件正确生成
- [ ] `get-windows` 在 macOS 上返回活跃窗口的 owner.name / bundleId / title
- [ ] `npm run build` + `npm run test` 仍然全绿

### 阶段四：UI 迁移（预计 5-8 天）

**前置**：阶段一 + 阶段三完成（可与阶段二并行）

**交付物**：
- [ ] Workbench 窗口自绘标题栏（合并 workspace tab 栏）
- [ ] macOS 红绿灯预留 80px 左侧空白
- [ ] 系统托盘图标 + 右键菜单（开启/关闭、打开工作台、退出）
- [ ] 托盘弹出面板（可选）：复用 PopupPage，320×520 无边框浮动窗口
- [ ] SiteRulesPanel 改造：URL 输入 → 应用选择器（运行中进程列表 + glob 输入）
- [ ] 数据模型 siteRules 扩展 `matchType: 'process' | 'bundleId' | 'title'`
- [ ] 首次启动引导：打开 Workbench + "尝试点击桌面"提示
- [ ] macOS 辅助功能权限请求提示（直接 deep link 到系统设置面板）
- [ ] DiagnosticsPanel 对接 IPC 诊断事件
- [ ] 空状态设计：主题库为空、诊断无事件、应用规则为空

**验收**：
- [ ] Workbench 标题栏可拖拽移动窗口
- [ ] 双击标题栏最大化/还原（macOS + Windows 行为正确）
- [ ] 托盘图标右键菜单三项可用
- [ ] 点击托盘「打开工作台」→ Workbench 窗口聚焦
- [ ] 应用规则面板可列出运行中进程，选择后保存规则
- [ ] 首次启动 → 出现引导提示 → 关闭后不再出现
- [ ] `npm run build` + `npm run test` 仍然全绿

### 阶段五：AI API 服务（预计 1-2 天）

**前置**：阶段一完成（完全独立）

**交付物**：
- [ ] `src/main/api-server.ts` — cursor-dance-api 内嵌或 fork
- [ ] 端口探测 + 回退（默认 8787，占用则随机）
- [ ] API key 安全存储（`safeStorage.encryptString`）
- [ ] API 端点从 electron-store 读取（Workbench 设置面板可配置）
- [ ] AI 面板（快速模式 + Agent 模式）在桌面版 Workbench 功能完整

**验收**：
- [ ] 打开 AI 面板 → 输入需求 → 快速模式返回方案
- [ ] Agent 模式 ReAct 循环正常（工具调用 + 最终方案）
- [ ] API key 存储在 OS keychain（非明文 JSON）
- [ ] `npm run build` + `npm run test` 仍然全绿

### 阶段六：构建与打包（预计 3-5 天）

**前置**：阶段一至五全部完成

**交付物**：
- [ ] `electron-builder.yml` — macOS dmg/zip + Windows nsis/portable 配置
- [ ] macOS entitlements（辅助功能 + disable-library-validation）
- [ ] `electron-updater` 集成 + GitHub Releases 自动更新
- [ ] 应用图标（.icns, .ico, .png 多尺寸）
- [ ] CI 脚本：`build:electron` + `package:mac` / `package:win`
- [ ] `npm run build`（扩展）+ `npm run build:electron` 双构建可在 CI 并行

**验收**：
- [ ] `npm run package:mac` 生成 .dmg 文件
- [ ] 安装 .dmg → 拖入 Applications → 启动 → 功能完整
- [ ] macOS 公证通过（`spctl --assess --verbose /Applications/CursorDance.app`）
- [ ] 自动更新通道工作（新版本发布 → 应用提示更新）
- [ ] `npm run build` + `npm run build:electron` 均可在 CI 成功
- [ ] `npm run test` 仍然全绿

---

# AI 开发 Prompt 模板

以下是每个阶段的完整 AI prompt，直接复制使用。每个 prompt 自包含约束、任务、验收标准，不需要 AI 记忆上一阶段的上下文。完成后的人工确认口令：「验收通过，继续下一任务」。

## 使用方法

1. 在 Claude Code 中打开本项目
2. 复制对应阶段的 prompt
3. 每次只执行一个任务（一个任务 = 一个文件或一组紧密关联的文件）
4. 一个任务完成后跑 `npm run test`，确认全绿再继续
5. 如果 AI 产出不符合预期，直接贴错误信息让它修

---

（此处省略 prompt 模板正文，已通过后续消息提供）

