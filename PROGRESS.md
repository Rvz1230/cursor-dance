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
- [x] 任务 3.0.5：桌面 workbench 注入 runtime config 全局
- [x] 任务 3.1：主题导入导出适配
- [x] 任务 3.2：get-windows 集成

## 阶段四：UI 迁移
- [x] 任务 4.0：Workbench 自绘标题栏
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
- **上次提交**：阶段四 4.0
- **阻塞项**：无
- **扩展状态**：`npm run test` 165 tests 全绿，`npm run build` 与 `npx electron-vite build` 双绿
- **备注**：任务 4.0 完成 —— Workbench 改用自绘标题栏。`createWorkbenchWindow` 在 macOS 走 `titleBarStyle: 'hiddenInset'` + `trafficLightPosition {x:14,y:14}`（系统仍渲染红绿灯），其它平台 `frame: false`；窗口绑定 `bindWindowStateBroadcast` 监听 maximize/unmaximize/enter|leave-full-screen 把 `{isMaximized,isFullScreen}` 通过 `WINDOW_STATE_CHANGED` 推给 renderer。新增 `src/main/window-controls.ts`：`registerWindowControlsIpc()` 注册 `WINDOW_MINIMIZE/TOGGLE_MAXIMIZE/CLOSE/GET_STATE`，主进程用 `BrowserWindow.fromWebContents(event.sender)` 自动定位调用窗口（renderer 不带 windowId）。`shared/ipc-channels.ts` 新增 5 个 channel。preload 暴露 `cursorDanceWindow` 桥（platform/minimize/toggleMaximize/close/getState/onStateChanged），`vite-env.d.ts` 同步类型定义。新建 `src/renderer/workbench/TitleBar.tsx`：macOS 高度 40px + 80px 左侧避让红绿灯；Windows/Linux 高度 32px + 右侧自绘三按钮（X 按钮 hover 变 rose-500 红）。整条 `-webkit-app-region: drag` 可拖，所有交互元素显式 `no-drag`。`ThemeWorkbenchPage` 新增 `renderHeader` prop（默认走 `WorkbenchHeader`，桌面 entry 注入 `TitleBar`），扩展端零改动。新增 `window-controls.test.ts` 6 用例（snapshot 透传 / senderWindow 找不到 / 已销毁 / 正常 / bind 注册 4 事件 + unbind 解绑 / 销毁后不 send）。下一步任务 4.1 系统托盘。
