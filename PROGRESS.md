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
- [ ] 任务 2.5：迁移其余引擎模块
- [ ] 任务 2.6：主进程鼠标事件捕获
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
- **上次提交**：阶段二 2.4
- **阻塞项**：无
- **扩展状态**：`npm run test` 115 tests 全绿，`npm run build` 与 `npx electron-vite build` 双绿
- **备注**：任务 2.4 完成——trigger-handlers 已迁到 `src/renderer/engine/trigger-handlers.ts`。去 IIFE、改 `createTriggerHandlers(deps)`，handler 入参从 DOM PointerEvent / WheelEvent 切换为结构化 `CursorEvent`（type / x / y / buttons / deltaY / timestamp）。**桌面端裁剪 hover**：移除 `handlePointerOver` / `handlePointerOut`，`getActionTimingMs` 与 throttleMs 默认值里的 `"hover"` 分支同步删除，与 CLAUDE.md「桌面 5 个 trigger」一致。渲染管线（`visualEffects.* + audioRuntime.playSound`）调用顺序、节流 / 连击 / runIndex 计算逻辑全部原样保留。types.ts 把 `EngineState` 扩到含 `ready / lastTriggerAtByAction / actionRunCounts / actionComboStates / lastLeftPointerDownAt / lastLeftPointerUpAt / lastWheelEventAt / longPressState`；`ConfigStore` 补 `getActiveScheme / getConfig / isCurrentSiteEnabled / getActionConfig / getCursorStateBinding / resolveCursorStateId / matchesTriggerZone`（均可选，桌面端 app-matcher 实现层填）；`TriggerHandlersModule` 从 `unknown` 收紧为含 7 个方法的具体接口；`DiagnosticsModule` 加 `describeTarget?`。`entry.ts` 完成 4 个子模块装配，`entry.test.ts` 把所有 handler 都 assert 一次。下一步任务 2.5 迁移其余引擎模块（config-store / diagnostics / default-config / app-matcher）。
