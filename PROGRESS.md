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
- [x] R5-2：拆分 `WorkbenchPreviewRail`——播放、引擎 host、timeline、`PreviewStage` 与 pointer interaction 均已提取，主文件由 933 行降至 83 行；预览直接组合 shared effect runtime，`src/app → src/desktop` 依赖归零。
- **R5-2 收敛结果**：删除 Workbench 临时 draft ConfigStore、桌面端无消费者的 preview simulation/公开 API，以及 desktop 重复效果/音频 adapter；素材 URL 通过 resolver 注入 shared preview engine。
- **R5-2 当前验证**：76 个根测试文件共 362 项通过；typecheck、lint（0 error，保留既有 22 warning）、Electron build、Web smoke 6/6 与 desktop smoke 1/1 通过。
- **后续工作量**：剩余 4 个主要工作包——R6-1～R6-4；Windows 自定义光标真机验收并行，签名/公证需要外部证书环境。
- [x] R5-3：收敛 Workbench state——editor navigation 与 config dirty/live-preview 边界已分离；AI 预览/撤销、列宽拖拽和桌面欢迎/辅助功能 runtime 均已提取为场景 hook。
- **R5-3 收敛结果**：`ThemeWorkbenchPage.tsx` 由 695 行降至 585 行；拖拽监听会在结束、取消、重入和卸载时清理，活动窗口实时事件不会再被较早发起的启动查询覆盖。
- **R5-3 当前验证**：79 个根测试文件共 372 项通过；typecheck、lint（0 error，保留既有 22 warning）、Web smoke 6/6 与 desktop smoke 1/1 通过。
- [x] R5-4：无用代码清理——删除未挂载的素材中心、状态测试区、元素磁吸与 4 个旧氛围配置卡片，以及专用聚合逻辑/测试、3 个无调用导出和废弃选项常量；净删除 729 行。
- **R5-4 收敛结果**：`WorkbenchControls` 的 8 个通用 UI re-export 已清零，各组件直接依赖 shared UI；桌面与 Workbench 源码中的失效任务编号/迁移说明已清理。
- **R5-4 当前验证**：78 个根测试文件共 370 项通过；typecheck、lint 0 error，既有 warning 从 22 降至 15；Web smoke 6/6 与 desktop smoke 1/1 通过。
- [x] R5-5：多入口死代码检查——Knip 覆盖根 Web、扩展、Electron main/preload/renderer、维护脚本、测试、API 与 landing workspace，并进入 CI。
- **R5-5 收敛结果**：删除 2 个孤立文件及 10 组仅由虚假导出维持的预设/预览/模型代码，收窄无消费者导出；补齐 Radix 直接依赖，`pm2` 按服务器全局工具精确白名单，源码净删除约 600 行。
- **R5-5 当前验证**：Knip 零报告；78 个根测试文件共 370 项通过；typecheck、lint 0 error（保留既有 15 warning）、Web smoke 6/6 与 desktop smoke 1/1 通过。
- [x] R6-1：运行时性能优化——完成输入合并、目标 overlay 路由、禁用上下文休眠与运行时资源清理；其余候选优化均按测量结果取舍。
- **R6-1 首轮结果**：桌面规则解析由 main/renderer 共享；前台应用命中禁用规则时主进程直接隐藏 overlay、恢复 Chromium 后台节流并停止输入 IPC，规则清空或命中启用规则后即时恢复。
- **R6-1 收敛结果**：禁用时同步取消长按及延迟 action、重置点击/滚轮/键盘/音频节流状态、清除已存在效果和软件光标，并暂停已创建的 AudioContext；恢复后由下一次输入干净重启。延迟任务现有统一 registry，不会跨配置禁用边界补触发。
- **R6-1 最终测量**：双屏 1,000 Hz、1,000 个源 mousemove 在启用态合并为 60 条目标 IPC；禁用上下文下 overlay 可见数 0、两个 renderer 全部节流、IPC 为 0；冷启动约 0.81 秒。配置仅 6,358 bytes，未引入缺乏收益证据的 revision/patch 或效果对象池。
- **R6-1 当前验证**：78 个根测试文件共 375 项、typecheck、Knip、lint（0 error，保留既有 15 warning）、Electron build、Web smoke 6/6、desktop smoke 1/1 与完整动态测量通过。
- [x] R6-2：前端 bundle 优化——完成桌面 Workbench、扩展 Options/Popup 的按需拆分、无效动画依赖清理和双端预算门禁。
- **R6-2 首轮结果**：AI 助手、AI 设置和诊断面板改为动态加载，父页面无效的 AI 栏 Framer 动画同步删除；Workbench 初始引用由 1,994,491 bytes / gzip 418,432 bytes 降至 1,256,699 / 262,579 bytes，分别减少 37.0% / 37.2%。AI + Framer 主链路独立为约 714 kB chunk，未打开时不再下载和解析。
- **R6-2 预算门禁**：新增 `check:desktop-bundle`，约束 Workbench/overlay 初始 raw+gzip、最大 JS chunk 和 renderer 总产物，并接入 `build-desktop` CI。欢迎弹窗启动同时解除对活动窗口查询的等待，慢查询不再阻塞首次启动引导。
- **R6-2 最终验证**：78 个根测试文件共 375 项、typecheck、Knip、lint（0 error，保留既有 15 warning）、扩展与 Electron build、双端 bundle budget、Web smoke 6/6、生产扩展侧载 smoke 1/1、desktop smoke 1/1 和完整动态测量通过；桌面 smoke 已覆盖所有工作区异步 chunk。
- **R6-2 第二轮结果**：光标皮肤、应用/站点规则、键盘动效改为工作区级按需加载；删除没有任何可达入口、仅靠条件分支维持引用的 `BindingsPanel`。Workbench 初始引用进一步降至 1,167,090 bytes / gzip 246,972 bytes，较 R6-2 前累计减少 41.5% / 41.0%，主 JS 降至约 988 kB。
- **R6-2 第三轮结果**：Popup 的气泡、轮播、开关、提示和预览装饰动画改用 CSS transition/keyframes，Framer Motion 只随 AI 异步 chunk 加载；Popup 初始引用由约 441.5 kB / gzip 135.4 kB 降至 340,382 / 101,181 bytes，分别减少约 22.9% / 25.3%。
- **R6-2 扩展预算**：新增 `check:extension-bundle`，约束 Popup、Options、最大 JS chunk 和 content runtime，并接入扩展构建 CI。默认配置仅 6,358 bytes，Lucide 已按 ESM 图标摇树，剩余首屏 React/Radix/编辑器核心均有直接消费者，不再为拆分而拆分。
- [ ] R6-3：真实打包 CI——实现已完成，本机 macOS arm64 已验证；等待 GitHub Actions 首次确认 Windows x64 路径后收口。
- **R6-3 打包矩阵**：macOS arm64 生成 ZIP，Windows x64 生成 NSIS；两端均保留 unpacked 应用用于结构检查和启动 smoke，并将安装包、blockmap、更新元数据作为 7 天 CI artifact 上传。旧的 Windows helper-only job 已由完整打包链路取代。
- **R6-3 产物门禁**：检查 app.asar 主入口、preload/renderer、外置 extension/tray 图标、`app-update.yml`、latest 元数据、blockmap、`uiohook-napi`/`get-windows`/cursor helper 架构与 asar unpack；直接执行打包内 helper 协议，并以隔离 userData 启动最终可执行文件，确认 v4 配置桥和每屏 overlay。
- **R6-3 本机验证**：macOS arm64 ZIP、更新元数据和 unpacked `.app` 生成成功；产物结构/架构/helper 协议检查通过，最终 `.app` 启动 smoke 通过（双屏 2 个 overlay、1 个 Workbench、`app.isPackaged=true`）。NSIS 明确保留 userData；签名状态当前按预期为 unsigned。
- **下一步**：确认 Windows x64 CI 首跑结果并收口 R6-3，然后进入 R6-4；Developer ID、公证与 Windows code signing 仍需要外部证书环境。

### 分支状态

- **分支**：desktop/phase-0
- **整理前基线**：`9dcfada refactor(workbench): StatesPanel 迁移至 cursorSkin 数据模型`
- **阻塞项**：R6-4 的 macOS Developer ID/公证与 Windows code signing 需要外部证书环境；R6-3 Windows x64 路径等待 CI 首跑确认
- **验证基线**：以 CI 的 `npm run test`、`npm run test:smoke`、`npm run build`、`npm run build:electron` 为准，不再硬编码容易过期的测试数量
- **运行环境**：Node.js `>=22.12.0`（与 Electron 42 及 CI 对齐，见 `.nvmrc`）
- **历史说明**：任务 6.1 已完成自动更新基础设施、GitHub publish 配置和开发态/打包态测试；当前仍保持 `mac.identity: null`，发布签名、公证、用户可见更新状态与 release workflow 统一归入 R6-4。
