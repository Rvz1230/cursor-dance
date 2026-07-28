# CursorDance 桌面端重构与代码精简计划

> 状态：In Progress  
> 创建日期：2026-07-28  
> 最近更新：2026-07-28  
> 适用范围：`src/desktop/`、桌面端使用的 `src/app/` 共享 UI、配置模型、效果引擎、桌面构建与发布链路  
> 关联文档：[`ARCHITECTURE.md`](../ARCHITECTURE.md)、[`PROGRESS.md`](../PROGRESS.md)、[`docs/bug-fix-plan.md`](./bug-fix-plan.md)

## 0. 执行状态

| 工作项 | 状态 | 当前结果 |
|---|---|---|
| R0-1 类型与版本基线 | 部分完成 | TypeScript 5.9.3、Vite 7.3.6 已统一；`typecheck` 已进入 CI；基础 lint 尚待接入 |
| R1-1 Workbench 生命周期 | 已完成 | Dock 激活、托盘点击、二次启动统一复用窗口控制器，并有单元测试覆盖 |
| R0-2 Electron smoke | 已完成 | Playwright Electron 已覆盖启动、首次引导、窗口数量、二次启动重开和配置驱动 overlay 显隐，并已在 macOS 实跑通过 |

当前验证基线：

- `npm run typecheck` 通过。
- Vitest 37 个测试文件、283 个测试通过。
- 根 Web、landing、Electron main/preload/renderer 构建通过。
- 根项目、landing、Electron Vite、Vitest 均复用 Vite 7.3.6。
- Electron smoke 已在 macOS 实跑通过并接入 Linux CI；测试使用隔离 userData，并禁用全局输入、托盘、AI 服务和更新器等真机副作用。
- npm audit 当前报告 25 个依赖漏洞，需单独分类生产依赖与开发/打包依赖；不得直接运行 `npm audit fix --force`。

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
        popup.ts
      renderer/
        overlay/
        workbench/
        popup/
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

- 类型、单测、桌面 smoke、构建四条 CI 检查可运行。
- 当前已知失败被记录为显式 skipped test，而不是口头待办。
- 后续阶段可以用指标判断优化是否有效。

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

改动：

- 不再用 web `SiteRule` 类型描述桌面规则。
- 保留 `pattern.target: process | title`，normalize 不得丢字段。
- 主进程维护 `ActiveAppSnapshot` 缓存，只在前台应用变化时广播。
- overlay 订阅 active-app change，将规则和快照注入配置解析器。
- 规则顺序、禁用、指定主题和未授权状态均添加测试。
- Workbench 自身成为前台应用时，保留最近一个非 CursorDance 应用快照，方便“取当前应用”。

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

### R1-4：重新定义自定义光标支持范围

先做产品决策：

- 方案 A：正式支持 macOS 与 Windows，自定义光标是桌面核心功能。
- 方案 B：桌面只提供跟随特效，不替换系统光标，删除相关桌面 UI 承诺。

若选择方案 A：

- macOS 用随应用打包的签名原生 helper，移除运行时 `python3` 依赖。
- Windows 使用可审计的原生 cursor API/helper。
- helper 使用请求引用计数、异常退出恢复和 watchdog。
- Linux 在实现前标为不支持，不用空函数伪装成功。

验收：

- helper 缺失或崩溃时系统光标自动恢复。
- 应用强制退出后不会留下隐藏光标。
- 每个平台的支持状态在 UI 中与实现一致。

### R1-5：接通或删除氛围运行时

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

### R1-6：决定桌面 Popup 去留

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

popup preload:
  config.read/write
  activeApp.read
  workbench.open
```

删除 overlay 不需要的文件对话框、AI 设置、外链和窗口控制能力。

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

### R2-3：阻断任意导航和新窗口

- 所有 BrowserWindow 注册 `will-navigate` 和 `setWindowOpenHandler`。
- 内部页面只允许应用自身 URL。
- `https:` 链接统一交给主进程白名单 `shell.openExternal`。
- 禁止 AI Markdown 直接创建 Electron 子窗口。
- renderer HTML 增加适合开发和生产的 CSP。
- 在验证 preload 可运行后启用 `sandbox: true`。

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

### Phase 2 完成条件

- overlay 无法写配置、打开文件或修改 AI 设置。
- 外部网页无法继承 CursorDance bridge。
- 所有 IPC 非法 payload 有确定错误并被测试覆盖。
- 桌面 AI 不再依赖 localhost 服务。

## Phase 3：配置模型收敛与存储优化

目标：建立一份规范配置，兼容逻辑集中在迁移层。

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

### R3-2：建立单向迁移器

```text
unknown input
  -> validate envelope
  -> migrate v1/v2/v3 to v4
  -> normalize v4
  -> immutable domain object
```

要求：

- normalize 不再隐式补写旧别名。
- migration 和 runtime normalize 分开。
- 导入旧主题有 fixture 测试。
- 配置损坏时保留原始备份并恢复到安全默认值。
- 至少保留一个正式版本的 v3 读取能力，再决定何时删除。

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

### R3-4：统一 Workbench persistence

- 建立 `WorkbenchRepository` 接口。
- 扩展 adapter 使用 Chrome Storage。
- 桌面 adapter 使用 typed IPC。
- 静态预览 adapter 使用 localStorage。
- 删除业务层中反复出现的 `if chrome / if electron / fallback localStorage` 分支。
- Recent assets、editor state、diagnostics 分别定义明确存储策略。

### Phase 3 完成条件

- 业务代码只读取 v4 domain model。
- 旧字段只存在于 migration fixture 和迁移器中。
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

先让扩展和桌面都调用共享 action/state machine，再逐步合并渲染实现。

### R4-3：让扩展运行时进入正式构建

- 用 Vite/Rollup 把共享 TypeScript core 打包为 MV3 content script。
- manifest 引用构建输出，不再手工维护 IIFE 模块加载顺序。
- 保持 content script 无 Node/Electron 依赖。
- 为 CSP、启动性能和 sourcemap 做扩展商店验证。

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
- 如果取消桌面 Popup：桌面 popup entry、HTML 和 build input。
- 只服务 localhost 预览、但被误当成桌面正式通道的 fallback 分支。
- 已由实际实现替代的任务编号注释、过时阶段说明和重复架构注释。
- 未被使用的导出、测试 hook 和兼容 wrapper。

#### 必须在替代实现上线后删除

- `install-runtime-globals.ts`：共享 core 被 UI 直接 import 后删除。
- 桌面 `api-server.ts` 和 `install-ai-endpoints.ts`：AI IPC transport 上线后删除。
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
7. `fix/refactor: wire atmosphere runtime or remove desktop entry`
8. `refactor: split preload capabilities and validate ipc payloads`
9. `refactor: move desktop ai transport from http to ipc`
10. `feat: introduce config schema v4 and migrations`
11. `refactor: separate binary assets from config storage`
12. `refactor: extract shared action and effect runtime`
13. `refactor: bundle extension runtime from shared core`
14. `refactor: split ai and preview workbench hotspots`
15. `chore: remove legacy engines, shims and dead entries`
16. `ci: package and smoke test desktop artifacts`
17. `release: enable signing notarization and verified updates`

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

### 配置迁移风险

- 写 v4 前备份最后一份可解析 v3 配置。
- migration 必须纯函数化并用真实 fixture 测试。
- 首个 v4 版本保留 v3 读取，不再继续写 v3。

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
- [ ] 配置只有一个规范 schema。
- [ ] 扩展和桌面共享核心动作/效果实现。
- [ ] preload 按窗口最小授权。
- [ ] IPC 有运行时校验和 sender 限制。
- [ ] renderer 导航和新窗口受到限制。

### 代码精简

- [ ] 无孤立 renderer entry。
- [ ] 无未引用组件和运行时模块。
- [ ] 旧配置别名只存在于迁移器。
- [ ] 旧双引擎文件已删除。
- [ ] package.json 无无用依赖。
- [ ] 架构文档不再要求人工同步两套实现。

### 工程与发布

- [ ] typecheck、lint、unit、desktop smoke 全部进入 CI。
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
