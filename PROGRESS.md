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
- **上次提交**：阶段二 2.8
- **阻塞项**：无
- **扩展状态**：`npm run test` 146 tests 全绿，`npm run build` 与 `npx electron-vite build` 双绿
- **备注**：任务 2.8 完成——Workbench 预览面板接入真实引擎。`engine/types.ts` 给 `TriggerHandlersModule` 加 `previewAt(x, y, schemeId?, previewScheme?, actionId?)`；`engine/trigger-handlers.ts` 把 `previewAtViewportCenter` 重构为 `previewAt(round(window.innerWidth/2), round(window.innerHeight/2), ...)` 的转调，原 viewport-center 调用方零改动。`WorkbenchPreviewRail.tsx` 删除 `PreviewEffects`（旧 CSS @keyframes 模拟）+ `getCursorOverrideProps`，改为在 `SimplePreviewStage` mount 时 `createEffectEngine`：自带最简内存版 ConfigStore（`getActionConfig` 始终回传 `configRef.current`，`isCurrentSiteEnabled`/`matchesTriggerZone` 恒 true，`resolveCursorStateId` 返回 ""，`getMaxActiveEffects`=200），用唯一 `cursordance-preview-root-${uid}` / `cursordance-preview-style-${uid}` 隔离多实例；`engine.visualEffects.ensureRoot()` 后把根节点挂到 stage 内 `effectsHostRef`（`pointer-events:none; absolute inset-x-8 bottom-9 top-20; transform:translateZ(0)`），覆盖 `position:absolute; inset:0` 让 `.cd-effect` 的 fixed 后代以 host 为 containing block 局部定位；`runId` 变化时调 `engine.triggerHandlers.previewAt(host.w/2, host.h/2, undefined, undefined, actionIdRef.current)`；预览端遮蔽 `cursorOverride === "切换到 pointer"`（避免改写 `document.body.style.cursor` 污染整个 Workbench）；unmount 清 cursorOverlay/orbital/audioContext 节点 + STYLE_ID。保留 `PREVIEW_KEYFRAMES <style>` 喂音效装饰条 `cursorDancePreviewBars`。`engine/entry.test.ts` 补 `previewAt` 类型断言。下一步任务 3.0 ElectronStoreAdapter。
