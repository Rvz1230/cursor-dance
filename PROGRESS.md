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
- [x] 任务 5.0：嵌入 AI 服务

## 阶段六：构建与打包
- [x] 任务 6.0：electron-builder 配置
- [x] 任务 6.1：自动更新 + CI

---

## 当前状态

### MVP 收尾技术债

- [ ] 增加显式的 TypeScript `typecheck` 脚本并接入 CI；当前 electron-vite/Vite 构建只负责转译
- [ ] 收敛 Vite/Vitest 版本：Vitest 4 要求 Vite 6–8，而根项目仍固定在 Vite 5
- [ ] 持续增加 `extension/` 与 `src/desktop/renderer/engine/` 的行为一致性测试，避免双实现漂移
- [ ] macOS 正式发布前完成签名与公证；当前 `mac.identity: null` 仅适合 dogfood
- [ ] 按职责拆分 `AiSchemePanel.tsx`、`WorkbenchPreviewRail.tsx` 和两端 `config-store` 热点文件

### 分支状态

- **分支**：desktop/phase-0
- **整理前基线**：`9dcfada refactor(workbench): StatesPanel 迁移至 cursorSkin 数据模型`
- **阻塞项**：无
- **验证基线**：以 CI 的 `npm run test`、`npm run test:smoke`、`npm run build`、`npm run build:electron` 为准，不再硬编码容易过期的测试数量
- **运行环境**：Node.js `>=22.12.0`（与 Electron 42 及 CI 对齐，见 `.nvmrc`）
- **备注**：任务 6.1 完成 —— 自动更新 + CI 双步打通。新增 `src/desktop/main/auto-updater.ts`：依赖 `electron-updater@6.8.9`，`registerAutoUpdater(opts?)` 在 `app.isPackaged === true` 时立即触发 `checkForUpdatesAndNotify()` 并以 4h 间隔轮询；dev 模式打 `[auto-updater] skipped in dev` 日志后返回 noop。`autoDownload` / `autoInstallOnAppQuit` 显式置 true（默认值，便于审计）；事件监听 `error` / `checking-for-update` / `update-available` / `update-not-available` / `download-progress` / `update-downloaded` 全部 console.log，**暂不弹 dialog UI**（dogfood 阶段排查用，留待后续迭代）。`stopAutoUpdater()` 清 interval；`__testing__.reset()` 给单测复位用。配套 `src/desktop/main/auto-updater.test.ts` 用 `vi.hoisted` 导出共享 spy（vi.mock 工厂会被 hoist，普通 const 在 mock 阶段 ReferenceError），覆盖 dev skip / packaged 调度 + interval / 事件监听集 / stop 清理 / 重复 register 警告 5 条路径。`src/desktop/main/index.ts` 顶部 import + `whenReady` 第 6 步 `stopAutoUpdater = registerAutoUpdater()`，与 `stopMouseCapture` / `stopEnableWatcher` 等并列在 `before-quit` 调一次。`electron-builder.yml` 末尾 `publish: null` 替换为 `provider: github` + `owner: Rvz1230` + `repo: cursor-dance` + `releaseType: release`，首次发布手动跑 `electron-builder build --publish always`（需 `GH_TOKEN`），上传 dmg/zip/blockmap/`latest-mac.yml`/`latest.yml` 到 GitHub Release 即可让 updater 客户端拉到。`mac.identity: null` 保持未签名 —— 公证留待后续。`.github/workflows/ci.yml` 新增 `build-desktop` job：ubuntu-latest 跑 `npm ci` + `npm run build:electron`，与现有 `test-root` / `test-api` / `build` 并行（无 needs），uiohook-napi/get-windows 在 build 阶段被 `externalizeDepsPlugin` 标记为 external 不触发 dlopen，所以 ubuntu 足以拦截 `src/desktop/main/**` 与 `src/desktop/renderer/engine/**` 的编译退化。**坑点 1**：`vi.mock("electron-updater", ...)` 工厂里引用的局部 const 会在 hoist 后未初始化报 ReferenceError —— 必须用 `vi.hoisted(() => ({ ... }))` 在同一阶段就绪。**坑点 2**：本机 npm install electron-updater 时 npm 会顺手 prune 掉 514 个 sibling 依赖再补回（lockfile 状态干扰），跑完要 `rm -rf node_modules && npm install` 才稳；CI 上不会有这个问题（cold install）。**坑点 3**：electron postinstall 在受限网络下卡死，`ELECTRON_MIRROR=https://cdn.npmmirror.com/binaries/electron/ node node_modules/electron/install.js` 走镜像才能完成。下一步：阶段六全部完成，桌面版 MVP 收尾。后续可独立追加 release.yml workflow（tag push 自动 publish）+ macOS 签名公证。
