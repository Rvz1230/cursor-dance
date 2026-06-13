# CursorDance 桌面版开发进度

> 每个任务完成后更新对应的 checkbox。当前状态随时反映最新进度。

## 阶段零：代码梳理
- [x] 任务 0.0：创建 StorageAdapter 接口 → 新建 `src/shared/storage/StorageAdapter.ts`
- [x] 任务 0.1：提取 WorkbenchControls 通用组件 → 7 个组件移到 `src/components/ui/`
- [x] 任务 0.2：迁移纯函数文件 → compute-specs, action-config, text-semantics → `.ts`

## 阶段一：项目脚手架
- [x] 任务 1.0：安装 Electron 依赖
- [x] 任务 1.1：配置 electron-vite + 创建最小入口
- [x] 任务 1.2：创建目录结构和占位文件

## 阶段二：效果引擎迁移
- [x] 任务 2.0：创建引擎 DI 类型和入口
- [x] 任务 2.1：迁移 visual-effects.ts
- [x] 任务 2.2：迁移 cursor-overlay.ts
- [x] 任务 2.3：迁移 audio.ts
- [x] 任务 2.4：迁移 trigger-handlers.ts
- [x] 任务 2.5：迁移其余引擎模块
- [x] 任务 2.6：主进程鼠标事件捕获
- [x] 任务 2.7：overlay 窗口和引擎连线
- [ ] 任务 2.8：Workbench 预览对接引擎

## 阶段三：存储与通信
- [ ] 任务 3.0：实现 ElectronStoreAdapter
- [ ] 任务 3.1：主题导入导出适配
- [ ] 任务 3.2：get-windows 集成

## 阶段四：UI 迁移
- [ ] 任务 4.0：Workbench 自绘标题栏
- [ ] 任务 4.1：系统托盘
- [ ] 任务 4.2：应用规则面板改造
- [ ] 任务 4.3：首次启动引导 + 空状态

## 阶段五：AI API 服务
- [ ] 任务 5.0：嵌入 AI 服务

## 阶段六：构建与打包
- [ ] 任务 6.0：electron-builder 配置
- [ ] 任务 6.1：自动更新 + CI

---

## 当前状态

- **分支**：desktop/phase-0
- **上次提交**：阶段二 2.7
- **阻塞项**：无
- **扩展状态**：`npm run test` 146 tests 全绿，`npm run build` 与 `npx electron-vite build` 双绿
- **备注**：任务 2.7 完成——透明 overlay 窗口逐 display 创建并装配效果引擎。新增 `src/main/windows.ts`：`createOverlayWindow(display)` 配置 transparent / frame:false / hasShadow:false / focusable:false / closable:false / fullscreenable:false / type:'normal'（macOS 用 toolbar/panel 会被 Mission Control 吞）；`setIgnoreMouseEvents(true, {forward:true})` + `setAlwaysOnTop("screen-saver")` + `setVisibleOnAllWorkspaces({visibleOnFullScreen:true})`；webPreferences `backgroundThrottling:false`；did-finish-load 后 insertCSS `* { cursor: none }` 并 showInactive 不抢焦点；macOS 调 `setHiddenInMissionControl`（老版本 Electron 吞掉异常）；窗口字典 `Map<displayId, BrowserWindow>` 维护，closed 时自清。同文件保留 `createWorkbenchWindow`（任务 4.0 才改自绘标题栏）。新增 `src/main/screen-utils.ts`：`getAllDisplays / onDisplayChanges`（聚合 added/removed/metrics-changed 三事件、返回退订函数）；纯函数 `screenPointToDisplayLocal(display, sx, sy)` 把 device-px 屏幕坐标折成 DIP local 坐标（`sx / scaleFactor - bounds.x`）；`findDisplayAtScreenPoint` 多 display 路由。`src/main/index.ts` 重写：app.whenReady 创建 workbenchWindow + 遍历 displays 创建 overlay；`onDisplayChanges` 派发 added → createOverlayWindow / removed → destroyOverlayWindow / changed → syncOverlayBounds；before-quit 钩子调用 stopMouseCapture + stopDisplayWatcher + destroyAllOverlays；window-all-closed 在 darwin 不退（保留 dock 行为）。`src/renderer/overlay/index.ts` 实装：装配 `createDiagnostics({window})` + `createConfigStore`（in-memory adapter 返回 defaultConfig + LEGACY_ENABLED=true，任务 3.0 之后接 electron-store）+ `createEffectEngine`，初始化时 `configStore.setConfig(defaultConfig)` / `state.ready=true` / `engine.visualEffects.ensureRoot()`；`cursorDanceAPI.onCursorEvent` 注入 dispatch：`toEngineCursorEvent` 用 `payload.x / dpr - window.screenX` 折坐标，`isInsideThisOverlay` 防多 display 重复触发；mousemove → `cursorOverlay.syncStateCursorOverlay`，mousedown 按 buttons 位掩码分发 left/right（right 同步触发 contextMenu），mouseup → `handlePointerUp`，wheel → `handleWheel`；beforeunload 退订并清理软光标。新增 `src/main/screen-utils.test.ts` 3 条测试覆盖 @1x / @2x / 副屏坐标转换。下一步任务 2.8 Workbench 预览面板对接引擎。
