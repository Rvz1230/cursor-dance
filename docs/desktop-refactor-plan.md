# CursorDance 桌面端重构与代码精简计划

> 状态：In Progress  
> 创建日期：2026-07-28  
> 最近更新：2026-07-29
>
> 适用范围：`src/desktop/`、桌面端使用的 `src/app/` 共享 UI、配置模型、效果引擎、桌面构建与发布链路  
> 关联文档：[`ARCHITECTURE.md`](../ARCHITECTURE.md)、[`PROGRESS.md`](../PROGRESS.md)、[`docs/bug-fix-plan.md`](./bug-fix-plan.md)

## 0. 执行状态

| 工作项 | 状态 | 当前结果 |
|---|---|---|
| R0-1 类型与版本基线 | 已完成 | TypeScript 5.9.3、Vite 7.3.6 已统一；类型检查与基础 lint 已接入 CI，桌面端显式 `any` 和 IPC 字符串通道作为阻断规则 |
| R1-1 Workbench 生命周期 | 已完成 | Dock 激活、托盘点击、二次启动统一复用窗口控制器，并有单元测试覆盖 |
| R1-2 桌面应用规则 | 已完成 | v4 `contextRules` 桌面规则、前台应用缓存与变更广播、overlay 即时匹配和未授权降级均已接通 |
| R1-3 多屏事件路由 | 已完成 | 全局输入按目标显示器投递，mousemove 按帧合并，跨屏/拔屏清理残留，并在 Windows 统一转换为 DIP 坐标 |
| R1-4 自定义光标平台能力 | 进行中 | macOS helper 与 watchdog 已完成；Windows Win32 helper、构建和 CI 验证已接线，等待 Windows 真机验收后正式启用 |
| R1-5 氛围运行时 | 已完成 | 桌面端明确暂不支持，Workbench 隐藏配置和预览，桌面导出不再写入该字段，并删除无调用方 runtime |
| R1-6 桌面 Popup | 已完成 | 采用取消方案，删除孤立 renderer 与构建入口，托盘继续承担快速开关和打开 Workbench |
| R2-1 拆分 preload | 已完成 | Workbench 与 Overlay 使用独立 preload；Overlay 仅保留输入、配置只读订阅、前台应用只读订阅和光标显隐 |
| R2-2 IPC contract | 已完成 | 共享 invoke 类型契约、窗口身份白名单、默认拒绝 sender policy，以及配置/主题/AI/外链运行时校验已接入 |
| R0-2 Electron smoke | 已完成 | Playwright Electron 已覆盖启动、首次引导、窗口数量、二次启动重开和配置驱动 overlay 显隐，并已在 macOS 实跑通过 |
| R0-3 性能与代码量基线 | 已完成 | 已记录代码量、bundle、配置载荷、启动、CPU、内存和 1,000 Hz IPC 压力基线 |
| R3-1 配置 schema v4 | 已完成 | 共享只读 domain contract、严格验证器、Web/desktop 判别规则和素材引用边界已冻结 |
| R3-2 生产链路 v4-only | 已完成 | Electron、Chrome、静态预览、Workbench、Popup、IPC 与主题文件均只读写 v4；非 v4 整份恢复默认 |
| R3-3 配置与素材拆分 | 已完成 | Electron 图片按 SHA-256 写入 userData 素材仓库，配置和预览只传 asset id，renderer 通过受限协议按需加载，导出恢复可移植 data URL |
| R3-4 Workbench persistence | 已完成 | 统一 repository contract；Electron、Chrome 与静态预览使用独立 adapter，业务 facade 不再判断运行平台 |
| R4-1 共享效果核心边界 | 已完成 | `text-semantics`、action config 与 compute specs 迁入共享 core；桌面仅保留素材 URL adapter，Workbench 删除重复算法 |
| R4-2 EffectRuntime adapters | 已完成 | 桌面四类 adapter 已接入；共享 state machine 统一 timing、throttle、run/combo 状态推进与 output plan |
| R4-3 扩展正式构建 | 进行中 | manifest 已收敛到单一 Vite content bundle；共享 core/runtime 已接入，剩余 legacy IIFE 由 bundle 暂时封装 |

当前验证基线：

- `npm run typecheck` 通过。
- `npm run lint` 通过（0 error；共享旧代码的 24 条显式 `any` 暂作为 warning 逐步收紧）。
- Vitest 65 个测试文件、334 个测试通过；删除的数量来自 legacy/parity 镜像用例收敛为共享实现的直接行为测试，不再重复比较两份实现。
- API 177 个测试通过。
- 根 Web、landing、Electron main/preload/renderer 构建通过。
- 根项目、landing、Electron Vite、Vitest 均复用 Vite 7.3.6。
- Electron smoke 已在 macOS 实跑通过并接入 Linux CI；除生命周期外，已覆盖应用规则禁用与清空后即时恢复，以及点击只进入目标显示器 overlay 的真实消费路径。测试使用隔离 userData，并禁用全局输入、托盘、AI 服务和更新器等真机副作用。
- 静态重构基线已记录在 [`docs/desktop-refactor-baseline.md`](./desktop-refactor-baseline.md)：生产代码 25,237 有效行，renderer 输出约 2.01 MiB，默认配置 JSON 约 43.9 KiB。
- 动态基线已在双显示器 Mac 上实测：Workbench ready 1,127.2 ms，空闲主进程 CPU 0.198%，总工作集约 832.9 MiB，1,000 Hz 目标实际达到 998.997 Hz。
- R1-5/R1-6 清理后 renderer 输出由 2,106,709 bytes 降至 2,041,583 bytes，减少 65,126 bytes（约 3.1%），且不再生成 popup HTML/JS 产物。
- npm audit 当前报告 27 个依赖漏洞，需单独分类生产依赖与开发/打包依赖；不得直接运行 `npm audit fix --force`。

## 1. 背景与结论

CursorDance 当前已经具备 Electron 主进程、preload、Workbench、透明 overlay、全局输入监听、托盘、配置存储和自动更新等基础设施。扩展端功能相对成熟，桌面端则存在以下结构性问题：

1. 一些功能已经出现在 UI 或进度文档中，但没有接入桌面运行时。
2. 扩展端和桌面端维护两套高度相似的效果引擎，依靠人工同步和少量 parity 测试维持一致性。
3. 配置模型同时保留新旧字段，并把 `siteRules` 复用于桌面应用规则，语义边界不清晰。
4. preload 和 IPC 能力过宽，缺少统一的运行时校验和 sender 限制。
5. 当前 CI 只能证明源码可转译，不能证明桌面安装包能启动、能授权、能更新、能在多屏与不同缩放比例下工作。
6. 多个大文件混合状态、视图、网络和业务逻辑，增加修改成本；同时存在已经失去调用方的模块和只为兼容旧架构存在的桥接代码。

本计划不以“移动文件”或“降低单个文件行数”为目标，而以以下结果为目标：

- 先修复用户可见的断链，再调整架构。
- 建立单一配置真值和可测试的平台适配层。
- 在有替代实现和回归测试后删除旧实现。
- 减少重复代码、无调用代码、兼容性别名和跨层依赖。
- 让桌面端的构建、打包、启动和核心交互可以在 CI 与真机检查中被验证。

## 2. 重构目标

### 2.1 功能目标

- 应用规则能够按进程名或窗口标题真实影响 overlay。
- 自定义光标、氛围效果、键盘动效和点击效果在支持的平台上行为明确。
- Workbench 关闭后可通过 Dock、托盘和二次启动可靠恢复。
- 桌面 AI 不依赖 `file:// -> localhost` 的跨源 HTTP 请求。
- 诊断面板能收到桌面 overlay 的真实事件和错误。
- Popup 要么成为完整桌面功能，要么从桌面构建中删除，不保留半成品入口。

### 2.2 架构目标

- 核心配置、迁移、动作语义和效果算法只有一份实现。
- `src/app/` 不再反向依赖 `src/desktop/`。
- renderer 不直接拥有不需要的系统能力。
- 主进程成为桌面状态和能力的唯一宿主，renderer 只消费窄接口。
- 平台差异通过明确的 capability/adapter 表达，不再通过空实现、字段复用和注释约定表达。

### 2.3 代码精简目标

以下指标以重构开始时的基线统计为准，不要求一次性完成：

- 扩展与桌面重复效果引擎代码减少至少 60%。
- 平台适配代码保留在 500–800 行以内，通用算法进入共享核心。
- 删除所有无入口 renderer、无调用模块和重复配置别名的写入路径。
- `AiSchemePanel.tsx`、`WorkbenchPreviewRail.tsx` 不再同时承担网络、状态机、持久化和展示职责。
- 新增业务模块原则上不超过 400 行；超过时必须说明为何拆分会损害内聚性。
- 不以创建大量一两行文件来“达成行数指标”。

### 2.4 质量目标

- 根项目存在 `typecheck`、`lint`、`test:desktop`、`package:verify` 命令。
- TypeScript 新增和重构目录启用严格模式；旧目录允许分阶段收紧。
- macOS 和 Windows 至少各有一条安装包 smoke 路径。
- 所有 IPC 请求具有类型定义、运行时校验、调用方限制和错误契约。
- 核心配置迁移和平台行为有自动化测试，不再依赖文档承诺。

## 3. 非目标

本轮重构明确不包含：

- 全量视觉重设计。
- 同时重写全部 React UI。
- 为了共享而强行统一扩展和桌面无法等价的系统能力。
- 在没有测试保护时一次性替换全部配置格式。
- 在重构期间新增大量特效类型。
- 为追求行数下降删除仍然承担迁移、隐私或安全职责的代码。

## 4. 执行原则

### 4.1 先锁定行为，再迁移实现

每个模块按以下顺序处理：

1. 写出当前预期行为和平台差异。
2. 添加回归测试或最小 smoke。
3. 引入新实现并让新旧实现短期并存。
4. 切换唯一调用方。
5. 删除旧实现、旧类型、旧测试夹具和旧文档。

禁止在同一个提交中同时进行大范围格式化、字段重命名和行为修改。

### 4.2 删除代码必须满足证据条件

删除前至少满足一项：

- `rg` 和依赖分析确认无静态或动态入口。
- 已有替代实现且调用方全部切换。
- 产品明确决定取消该能力。
- 兼容窗口已经结束，并存在迁移测试证明旧数据已被转换。

### 4.3 每个 PR 可独立回滚

- 单个 PR 只解决一个架构边界或一组强相关问题。
- 配置迁移必须保留向前恢复策略。
- 原生输入、光标和自动更新等高风险模块优先使用 feature flag 切换。

### 4.4 平台能力显式化

建议建立统一能力表：

| 能力 | Chrome 扩展 | macOS | Windows | Linux |
|---|---:|---:|---:|---:|
| 点击/滚轮效果 | 支持 | 支持 | 支持 | 待验证 |
| Hover DOM 语义 | 支持 | 不支持 | 不支持 | 不支持 |
| 页面音频 duck | 支持 | 不支持 | 不支持 | 不支持 |
| 自定义系统光标 | 页面内支持 | 需原生实现 | 需原生实现 | 待定 |
| 应用规则 | 不适用 | 支持 | 支持 | 待验证 |
| 键盘动效 | 不提供 | 支持 | 支持 | 待验证 |

Workbench 应根据能力表隐藏、禁用或解释不可用选项，不能让用户保存永远不会执行的配置。

## 5. 目标架构

建议逐步收敛为以下结构：

```text
src/
  core/
    config/                 # schema、迁移、normalize、默认配置
    actions/                # 动作语义、字段分组、触发状态机
    effects/                # 平台无关效果规格与算法
    rules/                  # web/desktop context rule
    diagnostics/            # 统一事件结构
  app/
    pages/                  # 共享 UI，只依赖 core 与 platform contract
    platform/               # Workbench 使用的平台 facade
  platforms/
    extension/
      runtime/              # Chrome storage、DOM input、site context adapter
    desktop/
      main/
        app-controller.ts
        services/
        windows/
        ipc/
      preload/
        workbench.ts
        overlay.ts
      renderer/
        overlay/
        workbench/
        adapters/
```

不要求第一步就移动现有目录。先建立依赖方向，再在最后做机械迁移。

依赖规则：

```text
UI -> platform contract -> preload/extension adapter
UI -> core
desktop renderer -> core
extension runtime -> core
desktop main -> desktop services -> OS/native dependencies

禁止：
core -> app
core -> desktop
app -> desktop implementation
desktop main -> React UI
```

## 6. 分阶段实施计划

## Phase 0：建立基线与防回归护栏

目标：在改变运行时之前，让失败能够被及时发现。

### R0-1：补齐类型检查与版本基线

工作内容：

- 在根项目显式安装 TypeScript。
- 新增 `typecheck` 脚本，覆盖 `src/**/*.ts(x)`、Electron main/preload/renderer。
- 将 Vitest 与 Vite 收敛到兼容版本，消除测试时 Vite 5/Vite 8 双实例。
- 新增基础 lint；优先检查未使用导入、浮动 Promise、危险 any 和 Electron IPC。
- CI 中增加 `npm run typecheck` 和 `npm run lint`。

验收标准：

- 本地和 CI 使用同一 TypeScript 版本。
- `npm ls vite` 不再出现根应用与测试运行器不兼容的主版本组合。
- 新增代码不得扩大 `strict: false` 范围。

### R0-2：建立 Electron smoke 测试

至少覆盖：

1. 应用启动后 Workbench 可见。
2. overlay 数量等于显示器数量。
3. 写入配置后 overlay 收到更新。
4. 关闭 Workbench 后通过托盘或二次启动重新打开。
5. 禁用效果后 overlay 不渲染并恢复原生光标。
6. 应用退出后全局 hook、helper 和本地服务释放。

测试分层：

- Node/Vitest：service、IPC handler、window manager 单测。
- Playwright Electron：窗口和 renderer 集成测试。
- 真机 checklist：权限、多屏、DPI、自定义光标和安装更新。

### R0-3：保存性能与代码量基线

记录以下指标：

- `src/desktop`、`extension/*-runtime`、共享 UI 的有效代码行数。
- Electron 冷启动到 Workbench ready 的时间。
- 空闲 CPU、内存和 overlay renderer 数量。
- 1000Hz mousemove 输入下的主进程 CPU 与 IPC 数量。
- Workbench、overlay、popup bundle 大小。
- 默认配置 JSON 和包含图片主题后的 IPC payload 大小。

输出到 `docs/desktop-refactor-baseline.md`，后续每个阶段更新对比数据。

### Phase 0 完成条件

- [x] 类型、lint、单测、桌面 smoke、构建检查均可在 CI 运行。
- [x] 当前没有被口头忽略或以 skipped test 隐藏的已知基线失败。
- [x] 性能、代码量、bundle 与配置载荷已有可复测基线。

Phase 0 已于 2026-07-28 完成；后续工作进入 Phase 1，优先完成 R1-2 应用规则运行时闭环。

## Phase 1：修复桌面端用户可见断链

目标：先让已有 UI 和文档承诺的能力真实可用。

### R1-1：修复 Workbench 生命周期

涉及文件：

- `src/desktop/main/index.ts`
- `src/desktop/main/workbench-window.ts`

改动：

- `activate`、`second-instance`、托盘点击统一调用 `openWorkbench()`。
- Workbench 关闭时将引用置空，不使用“所有 BrowserWindow 数量”判断 Workbench 是否存在。
- 将 Workbench 生命周期从 `index.ts` 抽成 `WorkbenchWindowManager`。
- 明确 Windows/Linux 点击关闭按钮后是隐藏到托盘还是销毁窗口。

验收：

- Workbench 关闭后 Dock、托盘和二次启动均可恢复。
- 重复操作不会创建两个 Workbench。

### R1-2：接通桌面应用规则

状态：已完成（2026-07-29）。

改动：

- 不再用 web `SiteRule` 类型描述桌面规则。
- 保留 `pattern.target: process | title`，normalize 不得丢字段。
- 主进程维护 `ActiveAppSnapshot` 缓存，只在前台应用变化时广播。
- overlay 订阅 active-app change，将规则和快照注入配置解析器。
- 规则顺序、禁用、指定主题和未授权状态均添加测试。
- Workbench 自身成为前台应用时，保留最近一个非 CursorDance 应用快照，方便“取当前应用”。

实现结果：

- 新增共享 `appRules` schema 与匹配器，Workbench、配置归一化和 overlay 复用同一实现。
- 主进程以 250 ms 周期更新前台窗口缓存，仅在进程、标题或授权状态变化时广播。
- 旧版本误存在 `siteRules` 且带 `process/title` target 的桌面规则会迁移到 `appRules`，不再污染扩展站点规则。
- overlay 在前台应用、持久配置或 live preview 任一变化时即时重算启用状态与主题，并记录 `app-rule.context` 诊断事件。
- Electron smoke 已验证进程规则禁用效果、清空规则后无需重启即可恢复。

验收：

- 按进程名禁用效果立即生效。
- 按窗口标题切换主题立即生效。
- 关闭或重排规则后无需重启 overlay。
- 无辅助功能权限时退化为全局配置并显示可行动提示。

### R1-3：修复多屏事件路由与坐标转换

改动：

- 主进程根据全局坐标确定目标 display，只向目标 overlay 发送高频事件。
- mousemove 使用每帧合并；mousedown/up/wheel 不合并。
- 为 Windows 混合 DPI 建立物理像素到 DIP 的转换层。
- 鼠标离开 display 时向旧 overlay 发送 leave/clear，清理软件光标和拖拽状态。
- 显示器拔插时取消该 overlay 的延迟任务和光标隐藏请求。

验收：

- 双屏边界不会双触发。
- 从 A 屏移动到 B 屏后 A 屏不残留软件光标。
- 125%/150% 缩放显示器上的点击效果与实际光标重合。
- 高频移动时 IPC 数量不超过显示刷新率的合理倍数。

实现结果：

- 新增主进程 cursor event router，以半开区间命中目标 display，移动事件只保留每帧最后一个，点击、抬起和滚轮先刷新待处理移动再即时投递。
- 跨屏时向旧 overlay 发送 `leave`，统一清理长按、拖拽、软件光标和原生光标隐藏请求；显示器移除和应用退出时取消待处理任务。
- Windows 将原生监听器给出的物理坐标通过 Electron `screenToDipPoint` 转为 DIP，再执行 display 命中与 renderer 投递。
- 双显示器 1,000 个源 mousemove 的动态测量从原基线 2,000 条 IPC 降至 62 条，减少约 96.9%；实际输入频率约 999.13 Hz。
- 路由器 6 项单元测试、Electron build 与桌面 smoke 均通过；桌面 smoke 断言非目标 overlay 不产生点击效果。
- Windows 坐标转换已有单元测试覆盖，125%/150% 混合 DPI 的最终像素对齐仍需在 Windows 真机发布验收中确认。

### R1-4：重新定义自定义光标支持范围

先做产品决策：

- 方案 A：正式支持 macOS 与 Windows，自定义光标是桌面核心功能。
- 方案 B：桌面只提供跟随特效，不替换系统光标，删除相关桌面 UI 承诺。

决策：采用方案 A。光标皮肤已是 Workbench 一级能力，保留 macOS 与 Windows 的正式支持目标；未完成的平台必须明确显示能力状态，不再以空实现伪装成功。

若选择方案 A：

- macOS 用随应用打包的签名原生 helper，移除运行时 `python3` 依赖。
- Windows 使用可审计的原生 cursor API/helper。
- helper 使用请求引用计数、异常退出恢复和 watchdog。
- Linux 在实现前标为不支持，不用空函数伪装成功。

验收：

- helper 缺失或崩溃时系统光标自动恢复。
- 应用强制退出后不会留下隐藏光标。
- 每个平台的支持状态在 UI 中与实现一致。

当前进度：

- macOS 已用可审计的 C/CoreGraphics helper 替换运行时 `python3` 脚本，arm64 与 x86_64 均可在构建阶段产出 Mach-O；helper 在 stdin EOF、`quit` 和常规终止信号下恢复系统光标。
- 开发、构建与 macOS 打包脚本会先编译 helper；安装包已实测包含正确架构的 `Contents/Resources/native/cursordance-cursor-helper`，并已加入正式签名时的额外二进制签名清单。
- 保留多 renderer 请求引用计数，并补充最后一个 requester 释放、renderer 销毁和 helper 启动失败测试；修复了 helper 已进入退出流程时仍可能被新请求复用的问题。
- 新增桌面能力契约：macOS 标记为 `supported`，Windows 标记为 `planned`，Linux 标记为 `unsupported`；Workbench 会对未完成平台展示明确提示。
- 删除 overlay 中无条件 `cursor: none` 的重复 CSS；桌面系统光标显隐统一由受控原生后端负责，helper 失败时保留系统光标作为安全降级。
- helper 协议增加 `ready/hidden/shown/pong` 确认；主进程不再把 stdin 写入成功误判为系统光标已隐藏。2 秒心跳超时会终止并重启 helper，硬崩溃后先执行 `recover` 平衡可能残留的 hide count，再按当前引用请求恢复隐藏。
- 30 秒内连续重启 3 次后停止隐藏并清空请求，避免 helper 缺失时形成无限重启；控制器测试覆盖确认协议、崩溃恢复、watchdog 超时与连续失败降级。
- Windows 新增可审计的 Win32 C helper：用透明 cursor 临时替换常用系统 cursor ID，退出或恢复时通过 `SPI_SETCURSORS` 重新加载用户当前方案；复用同一确认协议与 watchdog。
- Windows x64 helper 已接入 MSVC 构建、安装包 `extraResources` 和独立 CI 协议验证；正式验收前受 `CURSORDANCE_ENABLE_WINDOWS_CURSOR_HELPER=1` 实验开关保护，UI 仍标记为 `planned`。
- 待完成：Windows 真机验证隐藏、恢复、helper 强杀和应用强杀；通过后移除实验开关并将能力改为 `supported`。macOS 正式签名/公证随发布链路验收。

### R1-5：接通或删除氛围运行时

决策：桌面端暂不支持，扩展端继续保留该能力。

若保留氛围功能：

- overlay 创建并销毁 atmosphere runtime。
- 鼠标坐标由统一 IPC input stream 注入，不依赖 `forward:true` 的 DOM mousemove。
- 配置变化时调用 `syncConfig`。
- 禁用、切换主题、切屏和退出时停止 rAF 并删除节点。

若桌面暂不支持：

- 在桌面 Workbench 隐藏该模块。
- 不把未支持配置写进桌面导出主题。
- 删除桌面 `atmosphere.ts`，保留扩展实现。

禁止继续保留“UI 可配置、运行时无调用方”的中间状态。

实现结果：

- 桌面 Workbench 不再展示氛围配置和预览，Chrome 扩展行为保持不变。
- 桌面主题保存和导出会省略 `workbenchDraft.atmosphere`。
- 删除无调用方的桌面 `atmosphere.ts` 及 config store 中对应的死接口。

### R1-6：决定桌面 Popup 去留

决策：采用方案 B，桌面快速操作继续由托盘菜单承担。

方案 A：实现桌面 Popup：

- 新增托盘锚定的 frameless BrowserWindow。
- Popup 使用 desktop context，而不是 `readActiveSiteContext()`。
- 主题切换、启用开关和打开 Workbench 全部走桌面 bridge。
- 失焦隐藏、屏幕边界、任务栏位置和多显示器有测试。

方案 B：取消桌面 Popup：

- 从 `electron.vite.config.mjs` 删除 popup renderer input。
- 删除 `src/desktop/renderer/popup/`。
- 托盘菜单保留快速开关和打开工作台。
- README 不再宣称桌面 Popup 已提供。

建议在 Phase 1 开始时完成产品决策；如果没有明确需求，优先选择 B，减少维护面。

实现结果：

- 删除 desktop popup renderer、HTML 与 Electron Vite 构建入口。
- 性能基线脚本不再要求不存在的 popup bundle。
- README 和架构说明明确 Popup 仅属于 Chrome 扩展。

### Phase 1 完成条件

- 文档中标记完成的桌面能力均有真实入口和集成测试。
- 不存在构建产物中的孤立 renderer。
- 多屏、生命周期和应用规则成为稳定基线。

## Phase 2：收紧 Electron 安全与进程边界

目标：让 renderer 被视为不可信输入源。

### R2-1：拆分 preload

建议能力：

```text
workbench preload:
  config.read/write
  preview.write/clear
  dialog.import/export
  activeApp.read
  ai.run/settings
  windowControls

overlay preload:
  input.subscribe
  config.subscribe
  activeApp.subscribe
  diagnostics.publish
  cursor.requestVisibility
```

删除 overlay 不需要的文件对话框、AI 设置、外链和窗口控制能力。

实现结果：

- preload 源码和 bridge factory 按 Workbench/Overlay 拆分，两个窗口不再暴露同一套全量能力；R2-3 启用 sandbox 后改由自包含 CommonJS dispatcher 按主进程注入的窗口类型选择对应能力面。
- Workbench 不再暴露全局输入事件；Overlay 不再暴露配置写入、live preview 写入、文件对话框、首次启动、外链、窗口控制、AI 或平台能力桥。
- 按存储、前台应用、输入、对话框、窗口、AI 和平台信息拆分 bridge factory，共享统一的 IPC 订阅生命周期实现。
- Electron smoke 对两个窗口的实际 `window` 能力面做白名单断言，避免后续误把高权限 bridge 加回 Overlay。

### R2-2：建立 typed IPC contract

为每个通道定义：

- request schema
- response schema
- allowed sender/window kind
- maximum payload size
- expected errors
- timeout/cancellation semantics

可以使用轻量 schema 库，也可以先用项目内类型守卫；关键是运行时验证不能只依赖 TypeScript。

配置写入必须先 normalize/validate，再进入 store。主题导入需要限制文件大小、格式和 schemaVersion。

实现结果：

- 新增共享 `DesktopIpcInvokeContract`，preload 的所有 `invoke` 统一通过泛型 helper，编译期约束 request/response。
- Workbench 与 Overlay 创建时登记不可伪造的 `webContents.id -> window kind`；主进程中央策略表对未登记 sender 和未知通道默认拒绝。
- 配置读允许 Workbench/Overlay，配置写、主题文件、首次启动、外链、窗口控制和 AI 仅允许 Workbench；系统光标显隐仅允许 Overlay。
- 配置写入要求完整 schema v4、有效主题/规则引用，并保留 8 MiB IPC payload 上限。
- 主题导入导出限制为 8 MiB，校验 JSON 和主题结构，导出文件名禁止路径；AI 设置限制字段、长度、URL protocol 和 apiMode；外链先限制长度再走协议白名单。
- invoke 非业务错误统一通过 rejected Promise 返回；文件对话框和外链继续使用显式 result envelope，用户取消不视为异常。
- 新增 sender policy、payload contract、store handler 和光标越权回归测试。

### R2-3：阻断任意导航和新窗口

- 所有 BrowserWindow 注册 `will-navigate` 和 `setWindowOpenHandler`。
- 内部页面只允许应用自身 URL。
- `https:` 链接统一交给主进程白名单 `shell.openExternal`。
- 禁止 AI Markdown 直接创建 Electron 子窗口。
- renderer HTML 增加适合开发和生产的 CSP。
- 在验证 preload 可运行后启用 `sandbox: true`。

实现结果：

- 新增统一窗口安全绑定，Workbench 和 Overlay 同时拦截非入口 URL 的 `will-navigate` / `will-redirect`，拒绝所有 Electron 子窗口与 `webview` 附加。
- 导航白名单只允许窗口自身入口的协议、host 和 pathname，保留应用内部 query/hash；开发服务器和生产 `file://` 均使用创建窗口时算出的准确入口 URL。
- AI Markdown 链接在桌面端改走 `cursorDanceApp.openExternal`，继续复用主进程协议、长度和 sender 白名单；浏览器扩展仍保留普通链接行为。
- Workbench 和 Overlay 分别加入最小 CSP；R2-4 删除本机 AI HTTP 后，Workbench 只额外放行 Vite HMR，Overlay 完全禁止网络连接。
- 两个 renderer 已启用 `sandbox: true`。为兼容 Electron sandbox 不支持 ESM preload 本地共享 chunk 的限制，构建改为单个自包含 CommonJS preload；主进程通过 `additionalArguments` 注入窗口类型，dispatcher 只注册对应 bridge，主进程 IPC sender policy 仍作为第二层权限校验。
- 单元测试覆盖入口 URL 判定、导航/重定向阻断、子窗口/webview 拒绝、销毁清理和 preload 窗口类型解析；Electron smoke 覆盖 CSP、监听器、新窗口拒绝、sandbox 下 bridge 能力面与原有生命周期。

### R2-4：桌面 AI 改为 IPC transport

目标结构：

```text
Workbench renderer
  -> typed IPC / MessagePort
  -> main AiService
  -> model provider
```

改动：

- 桌面端不启动本地 HTTP server。
- 快速提案、流式提案和 agent run 使用 IPC 流式事件。
- renderer 永远不接触 API key。
- standalone `cursor-dance-api` 继续服务扩展和远程部署。
- 删除桌面 `api-server.ts`、端口探测、runtime endpoint 注入和桌面 CORS 特殊处理。

收益：

- 消除 packaged `file://` CORS 风险。
- 消除本机端口暴露、随机端口和访问 token 问题。
- 减少桌面启动服务和 HTTP 序列化开销。

实现结果：

- 新增普通提案、流式提案、Agent run 和取消请求的 typed IPC contract；主进程继续按 `webContents.id` 限制为 Workbench，并对 payload 施加 50 KiB 上限和 request id 格式校验。
- `proposal-service.mjs` 提取可直接调用的流式提案与 Agent 服务，桌面主进程和 standalone HTTP server 共用同一套校验、provider、sanitize 和 serialize 流程，扩展及远程部署接口保持不变。
- 流式进度按 request id 单播给发起窗口；renderer 取消或超时会调用主进程 `AbortController`，中止对应模型 `fetch` 并停止后续事件。
- preload 不再暴露 endpoint/access token，而是只暴露提案、流式、Agent、取消、设置和事件订阅；API key 仍由 `safeStorage` 保存且只在主进程注入 provider 环境。
- 删除桌面 `api-server.ts`、端口探测、启动/退出 HTTP 生命周期、`install-ai-endpoints.ts`、runtime endpoint 全局和桌面 access token；Workbench CSP 同步移除 localhost HTTP 权限。
- Electron main bundle 从 R2-3 的 148.85 KiB 降至 137.98 KiB；桌面 smoke 在空 AI 配置下通过 IPC 得到结构化 503，确认 bridge 契约可用且不依赖本地服务。

### Phase 2 完成条件

- overlay 无法写配置、打开文件或修改 AI 设置。
- 外部网页无法继承 CursorDance bridge。
- 所有 IPC 非法 payload 有确定错误并被测试覆盖。
- 桌面 AI 不再依赖 localhost 服务。

## Phase 3：配置模型收敛与存储优化

目标：建立一份规范配置，不在生产代码中保留旧版本兼容逻辑。

### R3-1：设计 schema v4

建议原则：

- 规范字段只保留 `themes` 和 `activeThemeId`。
- 删除运行时同时写入 `themePacks/schemes`、`activeThemePackId/activeSchemeId` 的做法。
- 规则改为判别联合类型，不复用 `siteRules`。
- 编辑器导航状态不进入运行时配置。
- 派生字段不持久化。
- `cursorSkin` 只保留一个位置，不在 theme 和 workbenchDraft 双写。
- key feedback 只保留主题级规范位置，旧全局字段只在迁移时读取。

示例：

```ts
interface CursorDanceConfigV4 {
  schemaVersion: 4;
  enabled: boolean;
  activeThemeId: string;
  themes: Theme[];
  contextRules: Array<WebContextRule | DesktopContextRule>;
  performance: PerformancePolicy;
}
```

实现结果：

- 已在 `src/shared/config-schema-v4.ts` 冻结共享只读 domain contract，并由 `docs/config-schema-v4.md` 记录字段归属、v3 映射和迁移边界。
- 根配置严格收敛为 `schemaVersion/enabled/activeThemeId/themes/contextRules/performance`；验证器明确拒绝旧主题别名、`siteRules/appRules`、全局键盘配置和 editor 状态。
- 主题规范位置只保留 `actionConfigs/cursorBindings/cursorSkin/keyFeedbackConfig`；拒绝 `workbenchDraft`、旧 cursor 多份表示与 reset 派生快照。
- Web/desktop 规则通过 `context` 判别；主题与规则 ID、主题引用、JSON 数据、光标素材两种引用形态均有运行时契约校验。
- R3-1 不切换生产持久化版本；R3-2 直接切换到 v4-only，既有非 v4 数据恢复为最新默认配置。

### R3-2：生产链路切换为 v4-only

```text
unknown input
  -> validate v4
  -> valid: immutable v4 domain object
  -> invalid: latest default v4 config
```

要求：

- 新建默认配置必须直接符合 v4，并通过严格验证器。
- Chrome、Electron 和静态预览只读取 v4；缺失、损坏或非 v4 数据直接恢复默认配置。
- 删除 v3 类型、旧字段双写、版本识别、legacy fixture 和兼容迁移分支。
- normalize 不得隐式补写旧别名。
- 运行时消费链路只接收 v4 domain model。
- 主题导入导出只保证当前 v4 格式，不承担旧主题升级。

实现结果：

- 桌面和扩展默认配置直接生成 v4；共享 TypeScript 默认配置启动时使用严格验证器断言。
- Workbench 草稿、reset 快照和导航状态只存在编辑器内存或独立 editor storage，保存边界只输出六个规范根字段。
- Electron IPC 复用共享 v4 验证器；主题文件改为 `cursordance-theme` + `schemaVersion: 4`，拒绝旧主题 envelope。
- Overlay、Popup 与 Chrome content runtime 直接消费 `themes/contextRules/cursorBindings/cursorSkin`，不再读取或写入兼容别名。
- Chrome 大图片使用 v4 `asset` 引用拆分存储；Electron 由 R3-3 使用内容寻址素材仓库，不再持久化内联图片。
- 本轮变更合计净删除 1,716 行（1,203 行新增、2,919 行删除，含测试与文档）。
- Web smoke 5/5 与 Electron desktop smoke 1/1 已按 v4 真实存储和消费链路通过。

### R3-3：拆分配置与素材存储

当前图片 data URL 会跟随完整配置在 IPC 和 Live Preview 中反复传输。建议：

- electron-store 只保存小型 JSON 配置和素材索引。
- 图片按 hash 写入 userData 下的 assets 目录。
- 配置保存 `asset://<hash>` 或 asset id。
- IPC 只发送变化 patch 或版本号；overlay 按需加载素材。
- 删除素材时执行引用计数或 mark-and-sweep 清理。

验收：

- 调节一个 slider 不再传输全部图片 data URL。
- 同一素材跨主题只存一份。
- 主题导出仍能生成可移植文件，导入时重新落盘素材。

实现结果：

- 主进程建立 `userData/assets` 内容寻址仓库，光标和动作贴纸按原始字节 SHA-256 去重；同一图片跨状态、动作和主题只保存一份。
- Electron Store、持久化广播和 Live Preview 只携带 `assetId`。renderer 首次上传后缓存 data URL 与 asset id 的映射，后续滑块变化不会再次跨 IPC 发送图片正文。
- Workbench 与 Overlay 通过只读 `cursordance-asset://asset/<id>` 协议加载素材；协议限制为合法 SHA-256 id，并配合 CSP、不可变缓存与 MIME sniffing。
- 主题保存由主进程重新内联素材，导出文件保持可移植；导入的 data URL 在第一次持久化时重新落盘。
- 清理采用引用扫描与 24 小时宽限期，避免保存、预览、撤销和导出过程中的短暂失联误删。
- 本阶段仍广播不含二进制的完整 v4 JSON；revision/patch 属于 R6-1 的进一步性能优化，不作为素材拆分的阻塞条件。
- Vitest 53 个文件共 316 项、Web smoke 5/5、desktop smoke 1/1、typecheck、lint 和 Web/Electron build 均通过；desktop smoke 在真实 sandbox renderer 中验证协议加载与去重存储。

### R3-4：统一 Workbench persistence

- 建立 `WorkbenchRepository` 接口。
- 扩展 adapter 使用 Chrome Storage。
- 桌面 adapter 使用 typed IPC。
- 静态预览 adapter 使用 localStorage。
- 删除业务层中反复出现的 `if chrome / if electron / fallback localStorage` 分支。
- Recent assets、editor state、diagnostics 分别定义明确存储策略。

实现结果：

- 建立 `WorkbenchRepository` contract，统一配置、Live Preview、editor state、recent assets、运行时错误和 diagnostics 的读写与订阅。
- Electron adapter 使用 typed preload bridge，并保留 R3-3 的素材引用缓存；Chrome adapter 使用 local/session storage 和独立光标素材记录；静态预览 adapter 使用 localStorage 与 BroadcastChannel。
- editor state 在 Chrome 使用 local storage，在桌面和静态预览使用页面 localStorage；recent assets 在 Chrome/静态预览持久化，桌面采用 renderer 会话缓存，避免把大 data URL 再复制进磁盘存储。
- diagnostics 在 Chrome 使用 storage 事件，在桌面/静态预览使用 BroadcastChannel；异步 listener 由 repository 统一捕获错误。
- `config-io.ts` 从约 400 行降到 30 行，`subscriptions.ts` 从约 185 行降到 17 行，业务 hook、Popup 和面板不再出现 Electron/Chrome/localStorage 分支。
- 新增三 adapter contract 测试；Vitest 54 个文件共 320 项、Web smoke 5/5、desktop smoke 1/1、typecheck、lint 和 Web/Electron build 均通过，lint warning 从 29 降至 24。

### Phase 3 完成条件

- 业务代码只读取 v4 domain model。
- 旧字段只存在于严格拒绝用例中，不存在生产迁移器。
- 平台存储选择不再散落于 UI 和业务模块。
- 大图片不会随每次 Live Preview 全量广播。

## Phase 4：合并效果引擎，删除双实现

目标：扩展与桌面共享算法，平台代码只处理输入和环境能力。

### R4-1：划分共享与平台专属部分

适合共享：

- action config 解析
- text semantics
- timing、double click、long press、combo
- particle/ripple/text/image animation spec
- effect budget
- theme/config selection
- diagnostics event schema

平台专属：

- DOM target/hover 解析
- active site/active app context
- 页面音频 duck
- 系统光标替换
- 全局输入监听
- overlay 坐标和多显示器路由

已完成：

- 新建 `src/shared/effect-core/`，集中承载 `text-semantics`、action config 与 compute specs；共享层不依赖 DOM、Chrome、Electron 或平台存储。
- 桌面 action config 收敛为素材引用 adapter，仅把 SHA-256 asset id 转换为 renderer 可加载 URL；overlay 和 Workbench 直接复用共享算法。
- Workbench `computeSpecs.ts` 由 528 行收敛为 1 行兼容 facade，桌面重复的 text/compute 模块删除，本轮净减少约 503 行。
- 扩展已经通过 Vite 单入口直接打包共享 core/runtime；`text-semantics`、action config 与 compute specs 三份 IIFE 镜像及 parity 测试已删除，剩余 legacy IIFE 仅作为 bundle 内的待迁移模块保留。

### R4-2：建立 EffectRuntime adapters

```ts
interface InputSource {
  subscribe(listener: (event: InputEvent) => void): Unsubscribe;
}

interface ContextResolver {
  getSnapshot(): RuntimeContext;
  subscribe(listener: (context: RuntimeContext) => void): Unsubscribe;
}

interface EffectSurface {
  createNode(spec: EffectSpec): EffectHandle;
  clear(): void;
}

interface AudioOutput {
  play(spec: AudioSpec): Promise<void>;
}
```

先冻结平台无关 contract 与 action/state machine，并由桌面生产链路验证；扩展端在 R4-3 通过正式构建入口接入，避免继续扩展手工 IIFE 加载链。

当前进度：

- 已建立平台无关的 `InputSource`、`ContextResolver`、`EffectSurface` 与 `AudioOutput` contract，以及统一输入、效果和音频 spec。
- 桌面 `InputSource` 负责 IPC 鼠标/键盘订阅、全局 DIP 到 overlay 本地坐标转换和订阅释放；overlay 不再直接绑定 preload 事件。
- 桌面 `ContextResolver` 统一前台应用初始读取、变更订阅和生命周期，并通过 revision 防止较慢的初始读取覆盖较新的 push 更新。
- 桌面 visual effects 和 Web Audio runtime 已分别包装为 `EffectSurface` / `AudioOutput`；trigger pipeline 只发出平台无关的 effect/audio spec，不再直接调用六个 renderer 方法。
- `EffectHandle.dispose()` 具有真实取消语义；surface 清理会停止活动动画、删除轨道粒子并恢复临时 pointer 样式。
- timing、throttle、run/combo 状态推进与 output plan 已进入共享 action state machine；桌面 trigger handler 只保留能力过滤、配置寻址、诊断与输出执行。
- output plan 只生成已启用的 effect/audio spec，避免为关闭的效果重复进入 adapter 和 renderer 空路径。
- R4-2 已完成；下一段进入 R4-3，让扩展运行时通过正式构建直接消费共享 core/runtime。

### R4-3：让扩展运行时进入正式构建

- 用 Vite/Rollup 把共享 TypeScript core 打包为 MV3 content script。
- manifest 引用构建输出，不再手工维护 IIFE 模块加载顺序。
- 保持 content script 无 Node/Electron 依赖。
- 为 CSP、启动性能和 sourcemap 做扩展商店验证。

当前进度：

- 新增独立扩展 Vite 配置，产出稳定路径 `dist/content-runtime/content.js`；根构建会自动生成并校验 manifest 中全部 content script 产物。
- manifest 的 content scripts 已由 12 个有序脚本收敛为一个构建产物，dist 不再复制未打包的 content-runtime 文件。
- 扩展、Web 本地预览和桌面共用同一份 action timing、throttle、run/combo 与 output plan；扩展 trigger handler 删除对应重复决策代码。
- double-click 与 long-press 已收敛为共享 gesture state machine，两端只负责事件坐标适配；同时修复桌面端长按提前松开时可能吞掉单击回退的问题。
- 删除三份 config-runtime IIFE、镜像测试和失去意义的 parity 测试，改为共享模块直接行为测试；本段净减少约 1,209 行。
- 最终 content bundle 已在系统 Chrome 中直接注入验证：共享 core/runtime 全局可用、效果根节点正常创建，真实点击可生成效果节点。
- 待完成：迁移 visual effects 等剩余 IIFE，并补真实 Chrome 扩展加载、CSP 与启动性能验收。

### R4-4：按模块删除旧引擎

建议迁移顺序：

1. `text-semantics`
2. `action-config`
3. `compute-specs`
4. double click/long press
5. visual effects
6. config store
7. diagnostics/audio/cursor adapters

每完成一个模块：

- 两端切换到共享实现。
- parity 测试变为共享实现的单元测试和两个 adapter 测试。
- 删除 extension 或 desktop 中对应的重复文件。

当前进度：

- `text-semantics`、action config、compute specs 的扩展镜像已删除。
- double-click 与 long-press 已由两端共同使用 `src/shared/effect-runtime/gesture-state.ts`，桌面重复模块已删除。
- animation handle、并发计数、幂等清理、pointer override、轨道粒子分组和整体 clear 已由两端共同使用共享 effect lifecycle。
- visual effects DOM surface 已下沉为共享 TypeScript 实现，扩展端 638 行 IIFE 镜像已删除，桌面端只保留兼容导出。
- cursor overlay 的 DOM renderer 与状态归一化已共享，扩展仅保留站点/DOM target 解析 adapter，原 IIFE 镜像已删除。
- 下一段继续收敛 audio runtime 与剩余扩展装配入口。

### Phase 4 完成条件

- 同一动作语义不再存在 JS/TS 两份实现。
- `ARCHITECTURE.md` 删除“修改一端必须人工同步另一端”的规则。
- 新增动作字段只需要修改一份 schema 和一组测试。

## Phase 5：Workbench 拆分与无用代码清理

目标：降低 UI 修改成本，并兑现代码量下降。

### R5-1：拆分 `AiSchemePanel`

建议职责：

```text
AiSchemePanel              # 组合层
  useAiConversation        # 会话状态
  useAiProposalRun         # 请求、取消、流式事件
  useAiProposalReview      # diff、应用、放弃
  AiMessageList            # 纯展示
  AiComposer               # 输入区
  AiProposalCard           # 提案展示
```

删除目标：

- 组件内重复的状态派生。
- 多处相同错误格式化和 loading 分支。
- renderer 端 endpoint 注入逻辑。
- 与旧非流式接口重复的请求代码；保留一个 transport contract。

### R5-2：拆分 `WorkbenchPreviewRail`

拆为：

- preview engine host
- timeline model/controller
- pointer interaction
- playback controller
- presentational rail components

共享引擎完成后，预览必须直接使用 core runtime，删除为预览复制的最简 configStore 假实现。

### R5-3：收敛 Workbench state

- domain state：主题、动作、规则。
- editor state：当前面板、选中项、展开状态。
- transient state：拖拽、toast、对话框、AI pending。
- persistence effects：集中在 repository/hook，不混入 reducer。

不强制引入大型状态库；优先使用拆分后的 reducer + context/selectors。

### R5-4：执行无用代码清单

#### 可在确认无调用方后优先删除

- 未被引用的 `ElementMagnetCard.tsx`。
- [x] 桌面 popup entry、HTML 和 build input。
- 只服务 localhost 预览、但被误当成桌面正式通道的 fallback 分支。
- 已由实际实现替代的任务编号注释、过时阶段说明和重复架构注释。
- 未被使用的导出、测试 hook 和兼容 wrapper。

#### 必须在替代实现上线后删除

- `install-runtime-globals.ts`：共享 core 被 UI 直接 import 后删除。
- [x] 桌面 `api-server.ts` 和 `install-ai-endpoints.ts`：AI IPC transport 上线后删除。
- `themePacks/schemes` 双写：schema v4 迁移完成后删除。
- `siteRules` 桌面复用：contextRules 上线后删除。
- extension/desktop 重复 engine 文件：共享 runtime 切换后逐个删除。
- cursor Python helper：签名原生 helper 上线或取消系统光标替换后删除。

#### 不应为了减行数删除

- schema migration fixtures。
- 安全校验和错误恢复。
- 平台能力说明。
- 原生资源清理和异常退出恢复。
- 能证明平台差异的 adapter 测试。

### R5-5：引入死代码检查

- 配置 Knip 或等价工具，显式声明 Electron/extension 多入口。
- CI 检查无用文件、依赖和导出。
- 对动态 manifest、preload 和 build entry 设置明确白名单。
- 删除依赖后同步检查 package.json、lockfile、builder 配置和许可证清单。

### Phase 5 完成条件

- `src/app/` 不再 import `src/desktop/`。
- 核心大组件职责单一且有 hook/纯函数测试。
- 无调用模块和孤立构建入口清零。
- 重复代码减少指标达到本计划目标。

## Phase 6：性能、打包与发布闭环

目标：让优化可测，让发布产物可信。

### R6-1：运行时性能优化

- mousemove 在主进程按帧合并，只发给目标 overlay。
- inactive/disabled overlay 暂停 rAF、音频上下文和非必要订阅。
- 配置变化使用 revision/patch，避免每次 normalize 全量主题和素材。
- visual effect node 使用受控池仅在测量证明有收益时引入。
- 限制同时活动效果、延迟任务和音频节点，并在切换主题时清理。
- active-window 检测从 renderer 主动查询改为主进程变化广播。

验收指标需要与 Phase 0 基线比较；没有测量收益的复杂缓存不合入。

### R6-2：前端 bundle 优化

- AI 面板、诊断面板和主题管理对话框按需加载。
- 大型默认主题数据与 UI 组件分离。
- 检查 Lucide、ReactMarkdown、Framer Motion 的实际引入范围。
- Popup 若保留，避免打入完整 Workbench 引擎。
- 设置 bundle budget，超过阈值 CI 告警。

### R6-3：真实打包 CI

矩阵至少包含：

- macOS arm64：build、package、启动 smoke、签名检查。
- Windows x64：build、package、启动 smoke。
- macOS x64 可在正式通用发布前通过 CI 或专用机器验证。

检查项：

- `uiohook-napi`、`get-windows` 和自定义 helper 的目标架构。
- asar unpack 路径。
- tray/icon/entitlements。
- app-update.yml 和更新元数据。
- 安装、升级、卸载后的 userData 策略。

### R6-4：签名、公证与更新策略

- macOS Developer ID 签名和 notarization。
- Windows code signing。
- 自动更新默认不静默下载，先提供用户可见状态和重试入口。
- 发布 workflow 从 tag 生成签名产物和 checksums。
- updater 只消费同一 workflow 生成的元数据。
- 更新失败不能影响主应用启动。

### Phase 6 完成条件

- CI 产出的安装包可以启动并完成核心 smoke。
- macOS/Windows 发布产物已签名。
- 自动更新具有用户可见状态和回滚说明。
- 性能指标相比 Phase 0 有记录可验证的改善。

## 7. 建议 PR 顺序

为了降低冲突和回滚成本，建议按以下 PR 拆分：

1. `chore: add typecheck and align vite toolchain`
2. `test: add electron lifecycle smoke harness`
3. `fix: restore workbench from activate and second instance`
4. `fix: preserve and apply desktop application rules`
5. `refactor: route input events to active display overlay`
6. `fix: finalize desktop cursor support policy and implementation`
7. `refactor: remove unsupported desktop atmosphere and popup entries`
8. `refactor: split workbench and overlay preload capabilities`
9. `refactor: validate ipc payloads and restrict senders`
10. `refactor: move desktop ai transport from http to ipc`
11. `feat: introduce config schema v4 and migrations`
12. `refactor: separate binary assets from config storage`
13. `refactor: extract shared action and effect runtime`
14. `refactor: bundle extension runtime from shared core`
15. `refactor: split ai and preview workbench hotspots`
16. `chore: remove legacy engines, shims and dead entries`
17. `ci: package and smoke test desktop artifacts`
18. `release: enable signing notarization and verified updates`

其中 3–7 可以根据产品优先级调整，但 schema v4 和共享引擎不应早于行为基线与桌面断链修复。

## 8. 每个任务的完成定义

每个重构任务只有同时满足以下条件才算完成：

- 行为测试通过。
- 类型检查和 lint 通过。
- 没有新增平台反向依赖。
- 新实现成为唯一生产调用路径。
- 被替代代码、测试夹具、依赖和文档已经删除或明确标记删除条件。
- 错误路径和资源释放经过验证。
- 用户可见行为变化已更新 README/PROGRESS/隐私说明。
- 对性能敏感的修改附带前后数据。

## 9. 风险与回滚策略

### 配置格式风险

- 按产品决策不兼容 v3 及更早格式；非 v4 数据整份恢复最新默认配置。
- 不保留 migration、legacy fixture 或旧字段识别分支，避免兼容代码重新进入生产链路。
- 默认配置、持久化写入和 IPC 均通过同一 v4 验证器，防止产生无法再次读取的数据。

### 原生输入与光标风险

- 新旧实现使用 feature flag。
- helper 崩溃或 IPC 超时立即恢复系统光标。
- 权限不足时禁用相关能力，不循环弹系统提示。

### 双引擎迁移风险

- 按模块切换，不做一次性替换。
- 视觉差异通过固定随机种子、effect spec snapshot 和人工录像检查确认。
- 扩展商店版本和桌面版本可以短期使用不同 adapter，但不能继续复制核心算法。

### UI 拆分风险

- 先抽纯函数和 hooks，再移动 JSX。
- 不在拆分 PR 中改变文案、样式和交互。
- 保留 smoke 中的角色、label 和关键选择器。

## 10. 进度跟踪模板

每个任务在对应 PR 或进度文档中使用：

```md
### R?-? 任务名

- 状态：Todo / In Progress / Blocked / Done
- Owner：
- 依赖：
- 行为基线：
- 修改范围：
- 删除范围：
- 新增测试：
- 性能前后数据：
- 风险与回滚：
- 验收记录：
```

阶段完成后更新本文件的完成状态，但不要把实现细节持续堆进本计划；详细实现记录应进入 PR、ADR 或单独的故障文档。

## 11. 最终验收清单

### 功能

- [ ] 点击、右键、双击、长按、滚轮效果在桌面可用。
- [ ] 应用规则按进程和标题生效。
- [ ] 多屏和混合 DPI 坐标准确。
- [ ] 自定义光标支持范围与 UI 一致。
- [ ] 氛围、Popup、诊断均不存在半成品状态。
- [ ] Workbench 可从 Dock、托盘和二次启动恢复。
- [ ] 桌面 AI 在打包应用中可用且不暴露本地 HTTP 服务。

### 架构

- [ ] `src/app` 不依赖 desktop implementation。
- [x] 配置只有一个规范 schema。
- [ ] 扩展和桌面共享核心动作/效果实现。
- [ ] preload 按窗口最小授权。
- [ ] IPC 有运行时校验和 sender 限制。
- [ ] renderer 导航和新窗口受到限制。

### 代码精简

- [ ] 无孤立 renderer entry。
- [ ] 无未引用组件和运行时模块。
- [x] 生产代码不再读写旧配置别名，且不保留迁移器。
- [ ] 旧双引擎文件已删除。
- [ ] package.json 无无用依赖。
- [ ] 架构文档不再要求人工同步两套实现。

### 工程与发布

- [x] typecheck、lint、unit、desktop smoke 全部进入 CI。
- [ ] macOS 与 Windows 安装包通过启动 smoke。
- [ ] 原生依赖架构和 asar unpack 已验证。
- [ ] macOS 完成签名和公证。
- [ ] Windows 完成签名。
- [ ] 自动更新有可见状态、错误恢复和发布校验。

## 12. 推荐的第一批工作

第一轮不要立即开始 schema v4 或双引擎合并。推荐先完成：

1. R0-1 类型与工具链基线。
2. R0-2 Electron 生命周期 smoke。
3. R1-1 Workbench 重开问题。
4. R1-2 应用规则运行时闭环。
5. R1-3 多屏事件路由。
6. 对自定义光标、氛围和桌面 Popup 做明确产品决策。

完成这批工作后，桌面端会从“代码存在但行为不可证”进入“行为可验证、架构可以安全演进”的状态，再开始配置和共享引擎重构。
