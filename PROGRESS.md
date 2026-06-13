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
- **上次提交**：阶段二 2.5
- **阻塞项**：无
- **扩展状态**：`npm run test` 134 tests 全绿，`npm run build` 与 `npx electron-vite build` 双绿
- **备注**：任务 2.5 完成——其余 5 个引擎模块全部从 IIFE 迁到 ES module，5 个新文件落在 `src/renderer/engine/` 下。**diagnostics.ts**：去 chrome.storage.onChanged，改为 `onExternalToggle?` 回调让上层（扩展端 chrome、桌面端 IPC）自行注入；query/localStorage/`__CURSORDANCE_DEBUG__` 三个本地源 + BroadcastChannel 桥保留，事件入栈 / `cursordance:diagnostic` CustomEvent / console.info / 200 条上限字节级保留。**app-matcher.ts**：替代 site-matcher，pattern 加 `target?: "process"|"title"`（默认 process），glob 改为统一 `.*`（process/title 无段结构，与扩展端 host 段语义不同），`resolveAppRule` 形态对照 resolveSiteRule。`app-matcher.test.ts` 覆盖 19 个用例（exact / glob / title-target / edge-cases / resolveAppRule），全绿。**default-config.ts**：4 套主题包定义（mono-geo/drift/molten/sunset）leftClick 字节级保留；`createDefaultThemePacks / mergeThemePackWithFallback / mergeCursorStates / normalizeSiteRules / normalizeConfig / needsMigration / defaultConfig` 全部走 ESM 导出，schemaVersion=3。**atmosphere.ts**：从 439 行缩到 ~180 行——磁吸（scanMagnetTargets / cleanupMagnetTargets / onMagnetOver/Out / MAGNET_SELECTOR）和文本选择态（updateTextSelection / revertTextSelection / findTextElement / isElementTextSelectable / calculateTextMetrics）全部移除（CLAUDE.md no-go：桌面无 DOM 可吸附 / 选择），仅保留 updateFollow + rAF 主循环 + creative-mouse 启停语义；workbenchDraft.atmosphere.mode 字段对齐扩展端，一份配置驱动两端。**config-store.ts**：去 IIFE 改 `createConfigStore(deps)`，BASE_ACTION_CONFIGS **删除 hover** 条目剩 5 条（leftClick/rightClick/doubleClick/longPress/wheel）；chrome.storage 抽象成 `ConfigStoreAdapter`（get/set + 选填 getSessionConfig / getLocalPreviewConfig）；resolveSiteRule 替换为 resolveAppRule，`getActiveScheme / isCurrentSiteEnabled` 走 `deps.getActiveAppInfo()` + `deps.getAppRules()`；`getWorkbenchDraft / mergeActionConfig / getCursorStateBinding / getEffectiveCursorStateConfig / resolveCursorStateId / matchesTriggerZone / getAtmosphereConfig` 字节级保留；`syncConfigFromStorage` 走 storeAdapter 读 CONFIG_STORAGE_KEY + LEGACY_ENABLED_STORAGE_KEY 并按 themePack/cursorStates 拼装资源键。types.ts 微调 `DiagnosticsModule.describeTarget` 返回 unknown 以同时兼容扩展端结构化对象和桌面占位字符串。**未连线 entry.ts**：diagnostics / config-store / atmosphere 是「上层装配」而非「引擎核心管线」（管线 = visualEffects + cursorOverlay + audioRuntime + triggerHandlers），按计划留给任务 2.7（overlay 窗口装配）/ 2.8（Workbench 预览装配）按场景注入。下一步任务 2.6 主进程 uiohook-napi 全局鼠标事件捕获。
