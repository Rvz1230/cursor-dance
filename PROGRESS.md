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
- **上次提交**：阶段三 3.2
- **阻塞项**：无
- **扩展状态**：`npm run test` 158 tests 全绿，`npm run build` 与 `npx electron-vite build` 双绿
- **备注**：任务 3.2 完成 —— `get-windows@9.3.0` 集成（`--ignore-scripts` 装包后手动从本地缓存解出 electron 42.4.0 dist + 写 path.txt 让 vitest 重新跑通）。新增 `src/main/active-window.ts`：`getActiveWindowSnapshot()` 用 `activeWindowSync({ accessibilityPermission: true, screenRecordingPermission: false })` 取前台窗口；macOS 权限缺失（同步抛 `accessibility permission` 错）归一化为 `{ authorized: false, message: "需要辅助功能权限：请在系统设置 → 隐私与安全 → 辅助功能 中允许 CursorDance。" }`，正常路径输出 `{ authorized: true, owner: { name, bundleId? }, title, processName }`，`processName = owner.name` 与 `app-matcher.ActiveAppInfo` 形状对齐。`shared/ipc-channels.ts` 增 `APP_GET_ACTIVE_WINDOW` 通道；preload 暴露 `cursorDanceApp.getActiveWindow()` 桥；main/index.ts 在 store/dialog 之后注册 `registerActiveWindowIpc`。新增单测 `src/main/active-window.test.ts`（5 用例：mac 权限错归一化、undefined → unauthorized、macOS Result 抽 bundleId、Linux 无 bundleId、title 缺省补空串）。下一步任务 4.0 Workbench 自绘标题栏。
