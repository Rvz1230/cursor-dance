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
- [x] 任务 2.8：Workbench 预览对接引擎
- [x] 任务 2.9：补全 4 套内置主题 5 个 action 默认配置

## 阶段三：存储与通信
- [x] 任务 3.0：实现 ElectronStoreAdapter
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
- **上次提交**：阶段三 3.0
- **阻塞项**：无
- **扩展状态**：`npm run test` 153 tests 全绿，`npm run build` 与 `npx electron-vite build` 双绿
- **备注**：任务 3.0 完成 —— 桌面端 workbench↔overlay config 同步链路打通。新增 `src/main/electron-store.ts`（封装 electron-store 单例 + 内存 live preview + onConfigChange/onLivePreviewChange 事件分发）、`src/main/ipc-handlers.ts`（registerStoreIpc 注册 5 个 ipcMain.handle，写后向所有 BrowserWindow 广播 STORE_CHANGED / LIVE_PREVIEW_CHANGED）。preload 追加第二桥 `cursorDanceStorage`（getConfig/setConfig/getLivePreview/setLivePreview/clearLivePreview/onChange/onLivePreviewChange，沿用 cursorDanceAPI 的 WeakMap-listener pattern）。`storage/chrome-api.ts` 加 helper `getElectronStorageBridge()`；`config-io.ts` 5 个导出函数（read/writeExtensionConfig、read/write/clearLivePreviewConfig）前置 bridge 优先分支，cursor 资产在 bridge 路径下不拆分（electron-store 无 5MB 单 key 限制）；`subscriptions.ts` 同样前置 bridge 分支（subscribeRuntimeDiagnostics 不动，留给 3.1+）。`overlay/index.ts` 用 electronBridgeAdapter 替换 inMemoryAdapter，启动拉初始 config + 订阅 STORE_CHANGED/LIVE_PREVIEW_CHANGED 实时 setConfig。新增 `src/main/electron-store.test.ts`（4 条断言：read 默认空 / writeConfig + onChange 调度 + 退订 / live preview 与持久化隔离 + clear 还原）。扩展端零改动 —— bridge 永远是 null，扩展走原有 chrome.storage 路径。下一步任务 3.1 主题导入导出适配。
