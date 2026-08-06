# CursorDance 桌面版 — AI 开发 Prompt 模板

> 归档于 2026-08-06。任务已经完成，路径、测试数量和兼容策略均可能过期；仅用于追溯，不作为当前执行指令。现行状态见仓库根目录 `PROGRESS.md` 与 `CLAUDE.md`。

每个 prompt 自包含约束、任务、验收标准。使用方法：
1. 复制对应任务的 prompt
2. 粘贴到 Claude Code 对话中
3. 一个任务完成后跑 `npm run test`，全绿再继续
4. 确认口令：「验收通过，继续下一任务」

---

## 阶段零：代码梳理

### 任务 0.0：创建 StorageAdapter 接口

```
你是 CursorDance 桌面版开发者。项目是 Chrome 扩展（TypeScript + React 18 + Vite），要在不破坏扩展的前提下为 Electron 桌面版打地基。

## 必须遵守
- 新文件用 TypeScript
- 只定义接口，不写实现
- 不改现有文件，只新增文件

## 任务
新建 `src/shared/storage/StorageAdapter.ts`，定义存储抽象接口。

1. 先读取 `src/app/pages/theme-workbench/lib/storage/config-io.ts` 了解现有配置读写函数的签名
2. 新建文件，导出 StorageAdapter 接口，包含以下方法：
   - readConfig(): Promise<CursorDanceConfig>
   - writeConfig(config: CursorDanceConfig): Promise<void>
   - readLivePreview(): Promise<CursorDanceConfig | null>
   - writeLivePreview(config: CursorDanceConfig): Promise<void>
   - clearLivePreview(): Promise<void>
   - onChanged(callback: (config: CursorDanceConfig) => void): () => void
3. Config 类型从现有代码 import，不重新定义

## 验证
完成后跑 `npm run test`，必须 98 tests 全绿。
```

### 任务 0.1：提取 WorkbenchControls 通用组件

```
你是 CursorDance 桌面版开发者。

## 必须遵守
- TypeScript 优先
- 不改任何组件内部逻辑，只改文件位置和 import 路径
- 保持所有 props 接口和 className 模式不变
- 完成后 `npm run test` 全绿，`npm run build` 成功

## 任务
将 `src/app/pages/theme-workbench/components/WorkbenchControls.tsx` 中的通用组件提取到 `src/components/ui/`，每个组件一个文件。

1. 先完整读取 WorkbenchControls.tsx
2. 识别以下组件：Panel, FieldRow, ControlSlider, SectionTitle, SmallSelect, ColorOptions, ThemeCard
3. 每个组件提取到独立文件：
   - Panel → src/components/ui/panel.tsx
   - FieldRow → src/components/ui/field-row.tsx
   - ControlSlider → src/components/ui/control-slider.tsx
   - SectionTitle → src/components/ui/section-title.tsx
   - SmallSelect → src/components/ui/small-select.tsx
   - ColorOptions → src/components/ui/color-options.tsx
   - ThemeCard → src/components/ui/theme-card.tsx
4. grep 搜索所有 import 这些组件的文件，更新 import 路径为新文件
5. WorkbenchControls.tsx 中从新路径 re-export，保持向后兼容
6. WorkbenchControls.tsx 中的其他组件（ActionTab, ColumnResizeHandle 等）留在原地

## 验证
- `npm run test` 全绿
- `npm run build` 成功
- grep 搜索旧 import 路径确认无遗漏
```

### 任务 0.2：迁移纯函数文件

```
你是 CursorDance 桌面版开发者。

## 必须遵守
- 新文件用 TypeScript，不改任何函数内部逻辑
- 去掉 IIFE 包装，改成 ES module export
- 不改 `extension/` 目录下的原始文件
- 完成后 `npm run test` 全绿

## 任务
将 3 个纯函数文件从 IIFE 格式迁移为 TypeScript ES module。

1. 读取 `extension/config-runtime/compute-specs.js`
   - 去掉 (function() { ... })() 和 window.CursorDanceConfigHelpers = { ... }
   - 每个函数改成 export function
   - 输出到 `src/desktop/renderer/engine/compute-specs.ts`

2. 读取 `extension/config-runtime/action-config.js`，同样处理
   - 输出到 `src/desktop/renderer/engine/action-config.ts`

3. 读取 `extension/config-runtime/text-semantics.js`，同样处理
   - 输出到 `src/desktop/renderer/engine/text-semantics.ts`

4. 如果文件内引用了其他 CursorDanceConfigHelpers 的函数，改成从对应 .ts 文件 import

## 验证
- `npm run test` 全绿
- 新文件可被 IDE import 且无类型错误
```

---

## 阶段一：项目脚手架

### 任务 1.0：安装依赖

```
你是 CursorDance 桌面版开发者。

## 必须遵守
- 不做破坏扩展构建的改动
- 完成后 `npm run build` 成功

## 任务
为项目添加 Electron 桌面开发依赖。

1. 安装为 devDependencies：electron, electron-vite, electron-builder
2. 安装为 dependency：electron-store, uiohook-napi
3. 保留所有现有依赖不变

## 验证
- `npm run build` 成功
- package.json 中依赖版本正确
```

### 任务 1.1：配置 electron-vite 并创建最小入口

```
你是 CursorDance 桌面版开发者。

## 必须遵守
- 新文件用 TypeScript
- 不做破坏扩展构建的改动
- 完成后 `npm run build` 成功

## 任务
创建 electron-vite 构建配置和最小 Electron 入口文件。

1. 新建 `electron-vite.config.mjs`：
   - main entry: src/desktop/main/index.ts
   - preload entry: src/desktop/preload/index.ts  
   - renderer 三入口：
     workbench: src/desktop/renderer/workbench/index.html
     overlay: src/desktop/renderer/overlay/index.html
     popupTray: src/desktop/renderer/popup/index.html
   - resolve alias: @ → src/renderer
   - Tailwind CSS v3 + PostCSS 配置
   - 参考现有 vite.config.js 的 define (VITE_* 变量)

2. 新建 `src/desktop/main/index.ts`：
   - app.whenReady() → 创建 1280×860 窗口，加载 workbench 入口
   - app.on('window-all-closed') → app.quit()
   - app.requestSingleInstanceLock() 单实例锁

3. 新建 `src/desktop/preload/index.ts`：
   - contextBridge.exposeInMainWorld('electronAPI', { platform: process.platform })

4. 新建 `src/desktop/renderer/workbench/index.html` + `entry.tsx`：
   - 渲染 ThemeWorkbenchPage，从现有 main.tsx 复制逻辑

5. package.json 加脚本：
   - "dev:electron": "electron-vite dev"
   - "build:electron": "electron-vite build"

## 验证
- `npm run dev:electron` 启动 Electron 窗口
- Workbench 页面完整渲染
- Tailwind CSS 样式生效（检查一个 bg-slate-100）
- `npm run build` 仍然成功
```

### 任务 1.2：创建目录结构和占位文件

```
你是 CursorDance 桌面版开发者。

## 任务
创建桌面版所需的剩余目录和占位入口文件。

1. 创建目录：src/desktop/renderer/overlay/, src/desktop/renderer/popup/
2. 创建 `src/desktop/renderer/overlay/index.html` + `index.ts`：
   - 最小入口 console.log('overlay ready')
   - 全屏 100vw×100vh，背景透明
3. 创建 `src/desktop/renderer/popup/index.html` + `entry.tsx`：
   - 渲染现有 PopupPage，固定 320×520
4. 更新 tailwind.config.js content 路径包含 src/desktop/renderer/

## 验证
- `npm run build` 成功
- `npm run test` 全绿
```

---

## 阶段二：效果引擎迁移

### 任务 2.0：创建引擎 DI 类型和入口

```
你是 CursorDance 桌面版开发者。

## 必须遵守
- 引擎模块通过 DI 注入 window/document，不直接访问全局
- TypeScript 使用与项目一致的配置（strict: false）
- 完成后 `npm run test` 全绿

## 任务
创建引擎 DI 容器类型定义和入口。

1. 新建 `src/desktop/renderer/engine/types.ts`：
   - CursorEvent: { type: string, x: number, y: number, buttons?: number, deltaY?: number, timestamp: number }
   - EngineDeps: { window, document, configStore }
   - 其他引擎内需要共享的类型

2. 新建 `src/desktop/renderer/engine/entry.ts`：
   - 导出 createEffectEngine(deps: EngineDeps)
   - 返回 { visualEffects, audioRuntime, cursorOverlay, triggerHandlers }
   - 目前各模块返回空对象占位（后续任务逐个实现）

## 验证
- TypeScript 编译无错误
- `npm run test` 全绿
```

### 任务 2.1：迁移 visual-effects.ts

```
你是 CursorDance 桌面版开发者。

## 必须遵守
- 不改渲染逻辑（Element.animate 调用完全保留），只改模块结构和运行环境适配
- 用 DI 注入的 window/document 替代全局访问
- 完成后 `npm run test` 全绿

## 任务
将 `extension/content-runtime/visual-effects.js` 迁移为 `src/desktop/renderer/engine/visual-effects.ts`。

1. 完整读取 visual-effects.js
2. 去掉 IIFE 包装，改为 export function createVisualEffects(deps)
3. deps 包含 { window, document, configStore, state, constants }
4. 所有 Element.animate() 调用保持不变
5. 移除 chrome.* 调用（如果有）
6. 移除 audio-duck-profile 引用
7. 导出所有 render* 函数和 ensureRoot, clearOrbitalParticles

## 验证
- TypeScript 编译无错误
- 与原 JS 函数签名一致
- `npm run test` 全绿
```

### 任务 2.2：迁移 cursor-overlay.ts

```
你是 CursorDance 桌面版开发者。

## 任务
将 `extension/content-runtime/cursor-overlay.js` 迁移为 `src/desktop/renderer/engine/cursor-overlay.ts`。

1. 完整读取 cursor-overlay.js
2. 改为 export function createCursorOverlay(deps)
3. deps 包含 { document, constants, state, configStore, visualEffects }
4. 软件光标 DOM 元素创建逻辑完全保留
5. DOM 事件绑定改为接收结构化坐标：
   export syncStateCursorOverlay(x, y, imageDataUrl?)
6. 其他模式同 visual-effects

## 验证
- TypeScript 编译无错误
- `npm run test` 全绿
```

### 任务 2.3：迁移 audio.ts

```
你是 CursorDance 桌面版开发者。

## 任务
将 `extension/content-runtime/audio.js` 迁移为 `src/desktop/renderer/engine/audio.ts`。

1. 完整读取 audio.js
2. 改为 export function createAudioRuntime(deps)
3. deps 包含 { window, state, configStore, diagnostics }
4. Web Audio API (OscillatorNode, GainNode) 逻辑完全保留
5. 移除 audio ducking 逻辑（duckPageMedia 函数及 audio-duck-profile 引用）
6. 预设音效（woodfish-deep, tick-light, chime-bright, pop-soft, swipe-whoosh）全部保留

## 验证
- TypeScript 编译无错误
- 音效预设参数不变
- `npm run test` 全绿
```

### 任务 2.4：迁移 trigger-handlers.ts

```
你是 CursorDance 桌面版开发者。

## 任务
将 `extension/content-runtime/trigger-handlers.js` 迁移为 `src/desktop/renderer/engine/trigger-handlers.ts`。

1. 完整读取 trigger-handlers.js
2. 改为 export function createTriggerHandlers(deps)
3. deps 包含 { window, document, state, diagnostics, configStore, visualEffects, audioRuntime, cursorOverlay }
4. 事件源从 DOM pointer events 改为结构化 CursorEvent 对象：
   - handleCursorEvent(event: CursorEvent) 替代所有 DOM 事件监听
   - 根据 event.type 分发到对应处理逻辑
5. 保留：long press 状态机、double click 检测（Date.now）、combo 计数、wheel burst suppression
6. 移除：hover 相关全部逻辑（handlePointerOver/Out, hover delay 状态机）
7. previewAtViewportCenter() 保留，改为接收 window.innerWidth/innerHeight 参数
8. matchesTriggerZone 暂返回 true（桌面不区接触发区域）

## 验证
- TypeScript 编译无错误
- `npm run test` 全绿
```

### 任务 2.5：迁移其余引擎模块

```
你是 CursorDance 桌面版开发者。

## 任务
迁移 config-store、atmosphere、diagnostics、default-config、app-matcher 到引擎目录。

1. config-store.js → src/desktop/renderer/engine/config-store.ts
   - 去掉 IIFE，chrome.storage 调用替换为 deps 注入的静态 config
   - getBaseActionConfigs() 保留
   - resolveCursorStateId 保留
   - site rule 匹配改为 app rule 匹配

2. atmosphere.js → src/desktop/renderer/engine/atmosphere.ts
   - 只保留 normal follow 模式（updateFollow + rAF animate 循环，约 60 行）
   - 移除：元素磁铁、文本选择、blend layer、querySelector（约 300 行）

3. config.js → src/desktop/renderer/engine/default-config.ts
   - 去掉 IIFE，ES module export

4. diagnostics.js → src/desktop/renderer/engine/diagnostics.ts
   - 去掉 IIFE，保留事件日志逻辑

5. site-matcher.js → src/desktop/renderer/engine/app-matcher.ts
   - URL hostname 匹配改为进程名/标题匹配
   - 保留 exact / glob 两种模式

## 验证
- TypeScript 编译无错误
- `npm run test` 全绿
```

### 任务 2.6：主进程鼠标事件捕获

```
你是 CursorDance 桌面版开发者。

## 必须遵守
- 抽象 IInputSource 接口，方便替换 uiohook-napi
- IPC 消息只传最小数据 { type, x, y, buttons?, deltaY?, timestamp }

## 任务
实现全局鼠标事件捕获和 IPC 广播。

1. 新建 `src/desktop/main/native-events.ts`：
   - 定义 IInputSource 接口：start(callback), stop()
   - 实现 UiohookInputSource 封装 uiohook-napi
   - mousemove/mousedown/mouseup/wheel 事件映射
   - macOS 滚轮处理：累积 delta 达阈值再触发（防触控板事件爆炸）
   - 导出 startGlobalMouseCapture(onEvent): () => void

2. src/desktop/main/index.ts 中：
   - 启动鼠标捕获
   - 事件广播到所有 overlay 窗口：webContents.send('cursor-event', event)

3. src/desktop/preload/index.ts 中：
   - 暴露 onCursorEvent(callback) 和 offCursorEvent()

## 验证
- macOS 点击/移动鼠标，console.log 输出坐标
- `npm run test` 全绿
```

### 任务 2.7：overlay 窗口和效果引擎连线

```
你是 CursorDance 桌面版开发者。

## 任务
将透明浮层窗口和效果引擎接通——鼠标事件 → IPC → overlay → 引擎 → DOM 渲染。

1. 在 src/desktop/main/windows.ts 中实现 createOverlayWindow(display)：
   - BrowserWindow: transparent, frame: false, alwaysOnTop ('screen-saver'), focusable: false
   - setIgnoreMouseEvents(true, { forward: true })
   - setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
   - backgroundThrottling: false, 相关 Chromium flags
   - type: 'normal'（不是 'toolbar'/'panel'，避免 Spaces 管理 bug）
   - 注入 CSS * { cursor: none !important }
   - 每个 display 一个窗口，存储在 Map<displayId, BrowserWindow>

2. 实现 src/desktop/main/screen-utils.ts：
   - screen.getAllDisplays() 遍历创建
   - 监听 display-added/removed/metrics-changed
   - DPI scaleFactor 处理

3. 实现 src/desktop/renderer/overlay/index.ts：
   - import createEffectEngine from engine/entry
   - 监听 cursor-event IPC → handleCursorEvent
   - 软件光标由 cursorOverlay 模块渲染

## 验证
- 启动桌面版 → 鼠标点击 → overlay 渲染粒子效果
- 5 种动作分别触发正确效果
- 效果位置 = 鼠标实际位置
- 多显示器各有一个 overlay
```

### 任务 2.8：Workbench 预览对接引擎

```
你是 CursorDance 桌面版开发者。

## 任务
将 Workbench 预览面板从 CSS @keyframes 模拟改为调用真实引擎。

1. 读取 WorkbenchPreviewRail.tsx 中 SimplePreviewStage 的实现
2. 改造预览面板：
   - import createEffectEngine from engine/entry
   - 在预览 div 内用 engine 渲染效果（调用 renderParticles 等）
   - previewAtViewportCenter() 在预览面板中心触发

## 验证
- 预览面板点播放 → 粒子/波纹效果正确
- 调整配置 → 预览和桌面 overlay 效果一致
- `npm run test` 全绿
```

---

## 阶段三：存储与通信

### 任务 3.0：实现 ElectronStoreAdapter

```
你是 CursorDance 桌面版开发者。

## 任务
实现 StorageAdapter 接口的桌面版适配器。

1. 新建 `src/desktop/main/electron-store.ts`：
   - 初始化 electron-store（schema 定义存储 key）
   - 导出 readConfig(), writeConfig(), onDidChange()

2. 新建 `src/desktop/renderer/adapters/ElectronStoreAdapter.ts`：
   - 实现 src/shared/storage/StorageAdapter 接口
   - 所有方法通过 ipcRenderer.invoke 调用主进程
   - onChanged 通过 ipcRenderer.on 监听

3. src/desktop/main/ipc-handlers.ts 中注册：
   - ipcMain.handle('storage:read-config', ...)
   - ipcMain.handle('storage:write-config', ...)
   - 写操作后 webContents.send 广播 'storage:config-changed'

4. 新建 `src/shared/ipc-channels.ts`，集中维护所有 IPC channel 名

5. preload 中暴露 cursorDanceStorage API

## 验证
- Workbench 写配置 → electron-store JSON 文件更新
- 关闭重开 → 配置恢复
- 修改主题 → overlay 实时收到 config-changed
- `npm run test` 全绿
```

### 任务 3.1：主题导入导出适配

```
你是 CursorDance 桌面版开发者。

## 任务
将导入导出改为 Electron 原生对话框。

1. 导出：ipc-handlers 注册 'dialog:save-file'
   - dialog.showSaveDialog（默认 .cursordance-theme.json）
   - 替换 Blob + <a download> 逻辑

2. 导入：ipc-handlers 注册 'dialog:open-file'
   - dialog.showOpenDialog（filter: .json）
   - 替换 <input type="file"> 逻辑

3. preload 暴露对应 API

## 验证
- 导出 → 保存对话框 → 文件正确
- 导入 .cursordance-theme.json → 主题库新增
- `npm run test` 全绿
```

### 任务 3.2：get-windows 集成

```
你是 CursorDance 桌面版开发者。

## 任务
集成 get-windows 获取活跃窗口元数据用于应用规则匹配。

1. 安装 get-windows
2. ipc-handlers 注册 'app:get-active-window'
   - 调用 activeWindowSync()
   - 返回 { owner: { name, bundleId }, title }
3. macOS 无权限时返回 { authorized: false, message: "需要辅助功能权限" }
4. preload 暴露 cursorDanceApp.getActiveWindow()

## 验证
- macOS 调用 getActiveWindow → 返回当前 app 名称
- `npm run test` 全绿
```

---

## 阶段四：UI 迁移

### 任务 4.0：Workbench 自绘标题栏

```
你是 CursorDance 桌面版开发者。

## 必须遵守
- 所有样式用 Tailwind CSS + cn()
- 遵循 DESIGN.md token（颜色/圆角/阴影/排版）
- macOS 红绿灯预留 80px 左侧空白

## 任务
为 Workbench 窗口创建自绘标题栏，与 workspace tab 栏合并。

1. 修改 createWorkbenchWindow：frame: false, titleBarStyle: 'hidden'
2. 新建 `src/desktop/renderer/workbench/TitleBar.tsx`：
   - 高度 40px(macOS)/32px(Windows)
   - -webkit-app-region: drag 可拖拽
   - tabs 按钮设 no-drag
   - 左侧 80px 留给红绿灯
   - 中间渲染 workspace tabs
3. ThemeWorkbenchPage 替换 WorkbenchHeader
4. 平台判断：process.platform

## 验证
- 标题栏可拖拽移动
- 双击最大化/还原
- macOS 红绿灯正常
- `npm run test` 全绿
```

### 任务 4.1：系统托盘

```
你是 CursorDance 桌面版开发者。

## 任务
创建系统托盘。

1. 新建 `src/desktop/main/tray.ts`：
   - 图标使用 public/icons/icon_16.png
   - 右键菜单：[开启/关闭, 分隔线, 打开工作台, 分隔线, 退出]
   - 点击托盘 → 弹出 PopupPage 浮动面板（可选）
2. 弹出面板：320×520 无边框，失焦关闭
3. 全局开关 → overlay 窗口 show/hide + 持久化

## 验证
- 托盘图标显示、右键菜单可用
- 开关切换 → overlay 效果启/停
- `npm run test` 全绿
```

### 任务 4.2：应用规则面板改造

```
你是 CursorDance 桌面版开发者。

## 任务
将 SiteRulesPanel 从 URL 匹配改为应用匹配。

1. 新建 AppRuleEditor.tsx：
   - 应用选择器下拉 + glob 手动输入
   - 匹配维度：进程名 / Bundle ID(macOS) / 窗口标题
   - exact / glob 两种模式

2. SiteRulesPanel 改造：
   - URL 输入 → 应用选择器
   - 标签 "站点规则" → "应用规则"
   - 列表项 hostname → 进程名

3. 数据模型扩展：siteRules 新增 matchType 字段

## 验证
- 应用规则面板列出进程
- 选择保存 → 规则生效
- `npm run test` 全绿
```

### 任务 4.3：首次启动引导 + 空状态

```
你是 CursorDance 桌面版开发者。

## 任务
创建首次启动引导和空状态设计。

1. 首次启动 WelcomeDialog：
   - 检测 firstRun flag
   - "CursorDance 已就绪" + "点击桌面任意位置试试效果" + "打开工作台"
   - 关闭后 firstRun = false

2. 空状态设计：
   - 主题库为空 → "还没有主题" + "创建新主题"
   - 诊断无事件 → "暂无诊断事件"
   - 应用规则为空 → "还没有应用规则" + "添加规则"

3. macOS 辅助功能权限提示

## 验证
- 首次启动 → WelcomeDialog → 关闭后不再出现
- 删除所有主题 → 空状态显示
- `npm run test` 全绿
```

---

## 阶段五：AI API 服务

### 任务 5.0：嵌入 AI 服务

```
你是 CursorDance 桌面版开发者。

## 任务
将 cursor-dance-api 嵌入 Electron 主进程。

1. 新建 `src/desktop/main/api-server.ts`：
   - import createServer from cursor-dance-api
   - 端口探测：默认 8787，占用则随机
   - 端口写入 electron-store
   - 退出时关闭

2. API key 安全存储：
   - safeStorage.encryptString() 加密
   - 存储在 electron-store（密文）
   - 在 preload 暴露

3. Workbench 设置面板新增 API 配置区

## 验证
- AI 面板功能完整（快速模式 + Agent 模式）
- API key 存储为密文
- 端口冲突自动切换
- `npm run test` 全绿
```

---

## 阶段六：构建与打包

### 任务 6.0：electron-builder 配置

```
你是 CursorDance 桌面版开发者。

## 任务
配置 electron-builder 用于打包。

1. 创建 electron-builder.yml：
   - appId: com.cursordance.app
   - productName: CursorDance
   - macOS: dmg + zip, hardenedRuntime
   - Windows: nsis + portable

2. 创建 build/entitlements.mac.plist：
   - com.apple.security.cs.disable-library-validation

3. 应用图标基于 public/icons/icon_512.png 生成 .icns/.ico

4. 加脚本：package:mac, package:win

## 验证
- `npm run package:mac` 生成 .dmg
- 安装运行功能完整
- `npm run test` 全绿
```

### 任务 6.1：自动更新 + CI

```
你是 CursorDance 桌面版开发者。

## 任务
集成 electron-updater 和更新 CI。

1. 安装 electron-updater
2. src/desktop/main/index.ts：启动后 checkForUpdatesAndNotify，每 4h 检查
3. electron-builder.yml 配置 publish: github
4. CI 新增 build-desktop job，与现有 job 并行
5. 条件触发：src/desktop/renderer/engine/** 改动触发双构建

## 验证
- CI 双构建通过
- GitHub Release 发布 → 应用收到更新提示
```
