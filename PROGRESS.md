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

- [x] 增加显式的 TypeScript `typecheck` 脚本并接入 CI
- [x] 收敛 Vite/Vitest 版本：根项目、landing、Electron Vite 与 Vitest 统一复用 Vite 7.3.6
- [x] 接入基础 lint 并进入 CI；阻断未使用代码、浮动 Promise、Hooks 顺序问题、桌面端显式 `any` 和 Electron IPC 字符串通道
- [x] 扩展与桌面效果核心收敛为共享实现，并由 adapter 单测、桌面 smoke 和真实 Chromium 扩展 smoke 覆盖平台差异
- [ ] macOS 正式发布前完成签名与公证；当前 `mac.identity: null` 仅适合 dogfood
- [ ] 按职责拆分 `AiSchemePanel.tsx`、`WorkbenchPreviewRail.tsx` 和两端 `config-store` 热点文件

### 桌面重构 Phase 0（已完成）

- [x] R0-1：TypeScript、Vite、`typecheck` 与 ESLint 基线；类型检查和 lint 均已进入 CI
- [x] R0-2：Electron 生命周期 smoke，覆盖首次引导、窗口数量、二次启动和 overlay 显隐
- [x] R0-3：性能与代码量基线——已记录代码量、bundle、配置载荷、启动、CPU、内存和 1,000 Hz IPC 压力数据
- **基线文档**：[`docs/desktop-refactor-baseline.md`](./docs/desktop-refactor-baseline.md)
- **当前重点结论**：Workbench 直接引用约 1.97 MiB 资源；默认配置约 43.9 KiB，加入 256 KiB 图片 data 后因 `themePacks` / `schemes` 双字段序列化放大到约 556.2 KiB。
- [x] R1-2：桌面应用规则运行时闭环——独立 `appRules`、前台应用缓存/广播、overlay 即时决策、旧规则迁移和未授权降级已完成
- **R1-2 验证**：38 个测试文件共 295 项通过；Electron smoke 覆盖规则禁用和清空规则后即时恢复
- [x] R1-3：多屏事件路由与坐标转换——目标 display 单播、mousemove 按帧合并、Windows DIP 转换和跨屏/拔屏清理已完成
- **R1-3 验证**：39 个测试文件共 301 项通过；Electron build、Web smoke 5/5、桌面 smoke 1/1 通过；双屏 1,000 个源 mousemove 的 IPC 从 2,000 条降至 62 条（约 96.9%）
- **R1-3 后续修复**：macOS overlay 改为 NSPanel 并集中 Space policy，双屏原生全屏时主屏窗口已从仅绑定普通 Space 修复为加入全部主屏 Space；隐藏 overlay 不再接收鼠标/键盘 IPC，延迟加载和热插拔会遵守当前显隐状态
- [ ] R1-4：自定义光标平台能力——macOS helper/watchdog 已完成；Windows Win32 helper、MSVC 构建、安装包资源和 CI 协议验证已接线，并由实验开关保护
- **R1-4 当前验证**：41 个测试文件共 310 项通过；macOS helper 协议已真机实跑，Windows helper 等待新增 CI 与 Windows 真机验证，能力状态仍为 `planned`
- [x] R1-5：桌面氛围运行时取舍——桌面 Workbench 隐藏配置与预览，桌面导出省略氛围字段，删除无调用方 runtime；Chrome 扩展能力不变
- [x] R1-6：取消桌面 Popup——删除孤立 renderer、HTML 和构建入口，托盘继续提供快速开关和打开工作台
- **R1-5/R1-6 验证**：41 个测试文件共 311 项、Web smoke 5/5、桌面 smoke 1/1、typecheck、lint 和 Electron build 均通过；renderer 输出减少 65,126 bytes（约 3.1%）
- [x] R2-1：按窗口拆分 preload——Workbench 保留编辑能力，Overlay 只暴露输入、配置/前台应用只读订阅和光标显隐
- **R2-1 验证**：typecheck、lint、Electron build 和桌面 smoke 通过；smoke 已对白名单能力面做真实窗口断言
- [x] R2-2：typed IPC contract——共享 request/response 类型、主进程 sender/window kind 白名单，以及配置/主题/AI/外链 payload 校验已接入
- **R2-2 验证**：44 个测试文件共 328 项通过；覆盖未知 sender、Overlay 越权写配置、Workbench 越权控制光标、schema/大小/字段校验
- [x] R2-3：窗口安全边界——阻断任意导航、重定向、Electron 子窗口和 webview，补齐 CSP，并在自包含 CommonJS preload 下启用 renderer sandbox
- **R2-3 验证**：46 个测试文件共 338 项通过；typecheck、lint（0 error，保留原有 29 warning）、Electron build 和桌面 smoke 通过，smoke 同时验证 sandbox 下窗口能力白名单
- [x] R2-4：桌面 AI IPC transport——快速提案、流式提案、Agent 与取消操作直达主进程 provider，删除 localhost HTTP server、端口与 endpoint/access token 注入
- **R2-4 验证**：47 个根测试文件共 344 项、API 包 178 项通过；typecheck、lint（0 error，保留原有 29 warning）、Electron build 和桌面 smoke 通过；main bundle 由 148.85 KiB 降至 137.98 KiB
- [x] R3-1：配置 schema v4——冻结共享只读 domain contract、严格验证器、Web/desktop 判别规则、主题单一真值与素材引用边界
- **R3-1 验证**：48 个根测试文件共 350 项通过；typecheck、lint（0 error，保留既有 29 warning）、Web/Electron build、Web smoke 5/5 和桌面 smoke 1/1 通过
- [x] R3-2：生产配置切换为 v4-only——Electron、Chrome、静态预览、Workbench、Popup、IPC 和主题文件均只读写 v4；缺失、损坏或非 v4 数据整份恢复最新默认配置
- **R3-2 验证**：49 个根测试文件共 306 项通过；typecheck、lint（0 error，保留既有 29 warning）、Web/Electron build、Web smoke 5/5 和 desktop smoke 1/1 通过；本轮变更净删除 1,716 行
- [x] R3-3：Electron 素材仓库——光标和动作贴纸按 SHA-256 去重写入 `userData/assets`，配置与 Live Preview 只保存 asset id，renderer 通过受限 `cursordance-asset://` 协议按需加载；主题导出自动内联为可移植 data URL，孤立素材按 24 小时宽限期清理
- **R3-3 验证**：53 个根测试文件共 316 项通过；typecheck、lint（0 error，保留既有 29 warning）、Web/Electron build、Web smoke 5/5 和 desktop smoke 1/1 通过；desktop smoke 真实断言配置不含 data URL、相同图片只落一个 asset id 且协议可加载
- [x] R3-4：统一 Workbench persistence——配置、Live Preview、editor state、recent assets 与 diagnostics 统一经 `WorkbenchRepository`，Electron、Chrome 与静态预览分别使用独立 adapter；业务 facade 不再包含平台判断
- **R3-4 验证**：54 个根测试文件共 320 项通过；typecheck、lint（0 error，既有 warning 从 29 降至 24）、Web/Electron build、Web smoke 5/5 和 desktop smoke 1/1 通过；`config-io.ts` 由约 400 行降至 30 行，`subscriptions.ts` 由约 185 行降至 17 行
- [x] R4-1：冻结共享效果核心边界——`text-semantics`、action config 与 compute specs 统一迁入 `src/shared/effect-core`，Workbench 和桌面 overlay 直接复用；桌面只保留 asset URL 平台 adapter
- **R4-1 验证**：54 个根测试文件共 320 项通过；typecheck、lint（0 error，保留既有 24 warning）、Web/Electron build、Web smoke 5/5 和 desktop smoke 1/1 通过；Workbench `computeSpecs.ts` 从 528 行降至 1 行，本轮净减少约 503 行
- [x] R4-2：建立 EffectRuntime adapters——桌面 InputSource、ContextResolver、EffectSurface 与 AudioOutput 均已接入生产链路；timing、throttle、run/combo 状态推进与 output plan 已收敛到共享 action state machine
- **R4-2 验证**：61 个根测试文件共 336 项通过；typecheck、lint（0 error，保留既有 24 warning）、Web/Electron build、Web smoke 5/5 和 desktop smoke 1/1 通过
- [x] R4-3：扩展正式构建——Vite 已把共享 effect core/runtime 打成单一 MV3 content bundle，manifest 不再维护脚本加载顺序；扩展 trigger 已接入共享 action 与 gesture state machine，config-runtime 镜像及 parity 测试已删除
- **R4-3 验证**：67 个根测试文件共 338 项通过；typecheck、lint（0 error，保留既有 24 warning）、Web/扩展/Electron build、扩展产物完整性校验、最终 content bundle 系统 Chrome 注入点击验证、Web smoke 5/5 和 desktop smoke 1/1 通过
- [x] R4-4：删除旧引擎——扩展 effect/runtime、config store 与 content composition root 已全部迁为 TypeScript；v4 默认配置、内置主题和键盘反馈配置收敛至 `src/shared/config`，旧 IIFE、动态脚本加载器、全局配置/模块注册表及源码执行测试均已删除
- **R4-4 验证**：70 个根测试文件共 345 项通过；typecheck、lint（0 error，既有 warning 从 24 降至 22）、Web/扩展/Electron build、扩展产物完整性校验、Web smoke 5/5、desktop smoke 1/1 与静态基线测量通过；默认配置载荷由 20,011 bytes 降至 6,358 bytes，content bundle 由 94.90 kB 降至 92.81 kB
- **R4 浏览器验收**：新增独立 `test:extension` 并接入 Linux CI；使用 Playwright 完整 Chromium 真实侧载生产 `dist`，覆盖严格 CSP 页面注入、点击效果节点、popup/options 启动、单 bundle 约束及 eval/CSP/page error 检查。R4 已完成。
- [x] R5-1：拆分 `AiSchemePanel`——展示、请求生命周期、会话持久化与提案审阅均已拆分；`AiSchemePanel.tsx` 从 1,388 行降至 458 行。
- **R5-1 稳定性修复**：请求 run id 隔离旧流式回调；会话 load revision 隔离快速切换的迟到读取，且 hydration 完成前禁止自动保存，避免空状态覆盖已有对话。
- **R5-1 收敛结果**：`useAiProposalReview` 统一预览、应用、放弃和撤销；删除 renderer、preload 与主进程中无消费者的非流式桌面提案 contract，快速模式只保留可取消的流式 transport。
- **R5-1 验证**：73 个根测试文件共 353 项通过；typecheck、lint（0 error，保留既有 22 warning）、Web/扩展/Electron build、Web smoke 6/6 与 desktop smoke 1/1 通过。
- **下一步**：进入 R5-2，拆分 `WorkbenchPreviewRail` 的 preview engine host、缩放/录制工具栏与状态展示。Windows 同步执行 R1-4 真机验收。

### 分支状态

- **分支**：desktop/phase-0
- **整理前基线**：`9dcfada refactor(workbench): StatesPanel 迁移至 cursorSkin 数据模型`
- **阻塞项**：无
- **验证基线**：以 CI 的 `npm run test`、`npm run test:smoke`、`npm run build`、`npm run build:electron` 为准，不再硬编码容易过期的测试数量
- **运行环境**：Node.js `>=22.12.0`（与 Electron 42 及 CI 对齐，见 `.nvmrc`）
- **备注**：任务 6.1 完成 —— 自动更新 + CI 双步打通。新增 `src/desktop/main/auto-updater.ts`：依赖 `electron-updater@6.8.9`，`registerAutoUpdater(opts?)` 在 `app.isPackaged === true` 时立即触发 `checkForUpdatesAndNotify()` 并以 4h 间隔轮询；dev 模式打 `[auto-updater] skipped in dev` 日志后返回 noop。`autoDownload` / `autoInstallOnAppQuit` 显式置 true（默认值，便于审计）；事件监听 `error` / `checking-for-update` / `update-available` / `update-not-available` / `download-progress` / `update-downloaded` 全部 console.log，**暂不弹 dialog UI**（dogfood 阶段排查用，留待后续迭代）。`stopAutoUpdater()` 清 interval；`__testing__.reset()` 给单测复位用。配套 `src/desktop/main/auto-updater.test.ts` 用 `vi.hoisted` 导出共享 spy（vi.mock 工厂会被 hoist，普通 const 在 mock 阶段 ReferenceError），覆盖 dev skip / packaged 调度 + interval / 事件监听集 / stop 清理 / 重复 register 警告 5 条路径。`src/desktop/main/index.ts` 顶部 import + `whenReady` 第 6 步 `stopAutoUpdater = registerAutoUpdater()`，与 `stopMouseCapture` / `stopEnableWatcher` 等并列在 `before-quit` 调一次。`electron-builder.yml` 末尾 `publish: null` 替换为 `provider: github` + `owner: Rvz1230` + `repo: cursor-dance` + `releaseType: release`，首次发布手动跑 `electron-builder build --publish always`（需 `GH_TOKEN`），上传 dmg/zip/blockmap/`latest-mac.yml`/`latest.yml` 到 GitHub Release 即可让 updater 客户端拉到。`mac.identity: null` 保持未签名 —— 公证留待后续。`.github/workflows/ci.yml` 新增 `build-desktop` job：ubuntu-latest 跑 `npm ci` + `npm run build:electron`，与现有 `test-root` / `test-api` / `build` 并行（无 needs），uiohook-napi/get-windows 在 build 阶段被 `externalizeDepsPlugin` 标记为 external 不触发 dlopen，所以 ubuntu 足以拦截 `src/desktop/main/**` 与 `src/desktop/renderer/engine/**` 的编译退化。**坑点 1**：`vi.mock("electron-updater", ...)` 工厂里引用的局部 const 会在 hoist 后未初始化报 ReferenceError —— 必须用 `vi.hoisted(() => ({ ... }))` 在同一阶段就绪。**坑点 2**：本机 npm install electron-updater 时 npm 会顺手 prune 掉 514 个 sibling 依赖再补回（lockfile 状态干扰），跑完要 `rm -rf node_modules && npm install` 才稳；CI 上不会有这个问题（cold install）。**坑点 3**：electron postinstall 在受限网络下卡死，`ELECTRON_MIRROR=https://cdn.npmmirror.com/binaries/electron/ node node_modules/electron/install.js` 走镜像才能完成。下一步：阶段六全部完成，桌面版 MVP 收尾。后续可独立追加 release.yml workflow（tag push 自动 publish）+ macOS 签名公证。
