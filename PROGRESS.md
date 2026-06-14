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
- [x] 任务 4.1：系统托盘
- [x] 任务 4.2：应用规则面板改造
- [x] 任务 4.3：首次启动引导 + 空状态

## 阶段五：AI API 服务
- [ ] 任务 5.0：嵌入 AI 服务

## 阶段六：构建与打包
- [ ] 任务 6.0：electron-builder 配置
- [ ] 任务 6.1：自动更新 + CI

---

## 当前状态

- **分支**：desktop/phase-0
- **上次提交**：阶段四 4.2
- **阻塞项**：无
- **扩展状态**：`npm run test` 182 tests 全绿，`npm run build` 与 `npx electron-vite build` 双绿
- **备注**：任务 4.3 完成 —— 桌面端首次启动引导 + 空状态。新增 `src/main/first-run.ts`：用独立 electron-store（name: cursordance-app, key: firstRun）存「是否首次启动」flag，避免污染 cursordance.config；同文件挂 `shell.openExternal` IPC，白名单 `https / http / x-apple.systempreferences / ms-settings`，拒绝 file:// 等危险 scheme（`first-run.test.ts` 6 tests 覆盖）。preload 在 `cursorDanceApp` bridge 上扩展 `getFirstRun / markFirstRunComplete / openExternal` 三个方法（`vite-env.d.ts` 类型同步）。新组件 `components/WelcomeDialog.tsx`：基于 Radix Dialog，三条 tip（点击体验 / 工作台调参 / 应用规则按需启停）+ macOS 未授权时插入「打开系统设置」CTA。`ThemeWorkbenchPage` 挂载时 `Promise.allSettled([getFirstRun, getActiveWindow])`，桌面 + firstRun=true 才打开 dialog；关闭后 `markFirstRunComplete()`，下次启动跳过。空状态升级三处：(1) `ThemeLibrarySidebar` 在 `themes.length===0` 兜底「还没有主题 → 创建新主题」CTA（与「搜索无结果」分开）；(2) `DiagnosticsPanel` 重写空态卡片，桌面端文案改为「桌面任意位置点击 / 长按 / 滚轮」；(3) `AppRulesPanel` 空态加 `AppWindow` icon + 「添加规则」+「为 X 创建禁用规则」双 CTA。`AppRulesPanel` 新增 `openAccessibilitySettings` prop，未授权 amber 提示卡里加链接按钮直跳 `x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility`。下一步任务 5.0 嵌入 AI 服务。
