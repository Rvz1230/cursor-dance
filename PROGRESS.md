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
- [ ] 任务 2.7：overlay 窗口和引擎连线
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
- **上次提交**：阶段二 2.6
- **阻塞项**：无
- **扩展状态**：`npm run test` 143 tests 全绿，`npm run build` 与 `npx electron-vite build` 双绿
- **备注**：任务 2.6 完成——主进程通过 uiohook-napi 全局捕获鼠标事件并 IPC 广播到所有 BrowserWindow。新增 `src/main/native-events.ts`：抽象 `IInputSource` 接口（start/stop）以便测试注入 FakeSource、未来切换原生绑定；`UiohookInputSource` 实现 mousemove/mousedown/mouseup/wheel 四类事件包装，`buttonsState` 在 down/up 时按位维护，与 PointerEvent.buttons 同口径（1=left/2=right/4=middle）；`uiohookButtonToBitmask` 把 uiohook 风格 1/2/3 → 1/2/4。`WheelAccumulator` 用 threshold=1 + multiplier=100 对齐 DOM WheelEvent.deltaY 量级（每咔哒 100 像素），缓解 macOS 触控板高频 wheel 压力，符号先按透传，留待真机验证。`startGlobalMouseCapture(onEvent, inputSource?)` 单例化 source，重复调用先 stop 旧的；返回 stop 函数并在被替换后变成 no-op。新增 `src/shared/ipc-channels.ts` 三方共享：`CURSOR_EVENT / DEBUG_TOGGLE / STORE_GET / STORE_SET / PREVIEW_AT_VIEWPORT_CENTER`。`src/main/index.ts` 在 app.whenReady 启动捕获并 try/catch 降级，`broadcastCursorEvent` 遍历 `BrowserWindow.getAllWindows()` 用 webContents.send 广播；before-quit 钩子调用 stop。`src/preload/index.ts` 新增 `cursorDanceAPI.onCursorEvent / offCursorEvent`，用 WeakMap 维护 callback → ipcRenderer handler 映射，订阅返回退订函数。新增 9 条单测（按钮位掩码 4 + WheelAccumulator 3 + 总线 2），下一步任务 2.7 overlay 窗口创建并 wire engine。
