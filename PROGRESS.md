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
- [ ] 任务 4.3：首次启动引导 + 空状态

## 阶段五：AI API 服务
- [ ] 任务 5.0：嵌入 AI 服务

## 阶段六：构建与打包
- [ ] 任务 6.0：electron-builder 配置
- [ ] 任务 6.1：自动更新 + CI

---

## 当前状态

- **分支**：desktop/phase-0
- **上次提交**：阶段四 4.1
- **阻塞项**：无
- **扩展状态**：`npm run test` 176 tests 全绿，`npm run build` 与 `npx electron-vite build` 双绿
- **备注**：任务 4.2 完成 —— 桌面端应用规则面板。新建 `src/app/pages/theme-workbench/components/AppRulesPanel.tsx`：与 SiteRulesPanel 结构对齐（拖拽排序、增删改查、启停切换），但匹配维度从 host/path 切到 process/title，pattern.type 缩到 exact / glob 两种，UI 新增「匹配维度」select 选 process/title、`Crosshair` 按钮一键填入当前前台进程名/标题。`fetchActiveApp` 走 `window.cursorDanceApp.getActiveWindow()`（任务 3.2 已落地），首次挂载时拉一次快照展示当前前台 + 「为 X 添加规则」快速操作；macOS 未授权时面板顶部出 amber 提示卡。**数据契约不动**：复用 store 上 `state.siteRules` + `addSiteRule/...` 全套 reducer actions，因为 `pattern.target` 字段已是可选 + 默认 process（由 app-matcher 兜底），向后兼容扩展端的 `{ type: "exact", value: "example.com" }` 旧数据，`themeDraftAdapter.test.ts` 不需改。`ThemeWorkbenchPage` 在 `state.workspaceId === "sites"` 分支用 `window.cursorDanceApp` 探测桌面环境二选一渲染（桌面 → AppRulesPanel，扩展 → SiteRulesPanel）。`useThemeWorkbenchState` 的 `workspaceItems` 在桌面端把 `sites` tab 的 label 改成「应用规则」（图标 Link2 沿用——后续可单独换 AppWindow，但不在本任务范围）。组件层无新单元测试（项目 vitest 跑 node 环境，无 React DOM 测试基础设施），匹配核心 `app-matcher.test.ts` 已覆盖；UI 行为靠 npm test + 双构建 + 后续手测验证。下一步任务 4.3 首次启动引导 + 空状态。
