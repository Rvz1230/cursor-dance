# CursorDance 协作说明

## 当前阶段：正式落地新 UI（2026-08-06 起）

工程基线、领域模型、Workbench 状态边界、持久化、命令层、组件入口和命名约束已经完成收敛。当前任务不再是继续制作孤立原型，而是以真实产品代码为基础，分批实现 `docs/ui-spec/` 中已经裁决的界面、交互和动效。

原型是体验规格，不是可以整段复制进项目的第二套应用。实现时必须：

1. 保留 `src/shared/domain/`、Workbench state、repository、commands 和 shared effect runtime 作为真实功能来源。
2. 将原型中的视觉与交互绑定到现有状态和命令，不复制原型的演示状态、假数据存储或页内脚本架构。
3. 原型与真实能力冲突时，先核对 `docs/ui-spec/DECISIONS.md`；没有裁决的冲突必须登记后再实现，不能静默选择一边。
4. 每批 UI 替换都要保留 Web、扩展和桌面端的真实消费链路，并通过相应测试。

## 开始任务前阅读顺序

1. `PROGRESS.md`：当前阶段、已完成批次、验证基线和阻塞项。
2. `docs/ui-spec/DECISIONS.md`：产品与交互冲突的最终裁决。
3. `docs/ui-spec/README.md`：原型页面映射、实现教训和 UI 落地顺序。
4. `ARCHITECTURE.md`：领域、UI、平台适配和运行时边界。
5. 只读取当前界面对应的原型与真实代码，不把历史计划当成现行指令。

已完成的迁移方案、旧 Prompt 和稳定化待办位于 `docs/archive/`，只用于追溯，不作为当前实现依据。

## 技术与目录边界

- 新代码使用 TypeScript（`.ts` / `.tsx`）。
- `src/shared/domain/` 是配置和主题领域模型的唯一真值。
- `src/shared/effect-core/` 保存平台无关的动作语义和效果计算。
- `src/shared/effect-runtime/` 保存共享状态机、效果 surface 和音频运行时。
- `src/app/` 保存两端复用的产品 UI、Workbench 状态与业务命令。
- `src/components/ui/` 保存共享 UI 组件，文件使用 kebab-case 并直接导入真实文件。
- `src/extension/` 和 `src/desktop/` 只处理平台输入、存储、窗口、IPC 和能力差异。
- `extension/` 只保存 MV3 manifest 与静态资源，不放可执行源码。

Workbench 内部保持以下边界：

- `hooks/state/`：纯 reducer 与状态变换。
- `hooks/persistence/`：水合、持久化、Live Preview 和 editor state。
- `hooks/editing/`：草稿编辑操作。
- `workbench*Commands.ts`：用户命令与跨模块流程。
- `components/`：展示和交互组合，不直接拥有平台存储协议。
- `lib/theme-draft/`：规范领域模型与编辑草稿之间的转换。

禁止重新引入 `WorkbenchControls` 混合出口、工作台组件 barrel、`ThemeLibraryItem`、运行时 `scheme` 命名或 `getActiveScheme`。AI 后端既有 `scheme` DTO 只允许存在于 API 适配边界，产品组件统一使用 assistant / proposal / theme 命名。

## UI 实施规则

- `docs/ui-spec/` 决定信息架构、布局、交互反馈和动效意图。
- `DESIGN.md` 决定颜色、排版、间距、圆角、阴影、动效层级和无障碍约束。
- 优先复用 `src/components/ui/`，不要引入第二套组件库。
- 原型中的原生控件或一次性实现必须映射到项目的共享组件族。
- 视觉替换不得绕开现有保存、撤销、主题切换、Live Preview、规则和诊断链路。
- 鼠标和键盘动效必须通过 shared effect runtime 验证，不能只让预览看起来正确。
- 新增交互必须支持键盘可达、明确状态和 `prefers-reduced-motion`。

修改原型后运行：

```bash
npx tailwindcss -c docs/ui-spec/tailwind.config.cjs -i docs/ui-spec/_src.css -o docs/ui-spec/mockup.css --minify
npm run check:ui-spec
npm run check:design-tokens
```

修改真实 UI 后至少运行与改动相称的检查；完整基线为：

```bash
npm run typecheck
npm run typecheck:strict
npm run lint
npm run check:conventions
npm run check:dead-code
npm run check:design-tokens
npm test -- --run
npm run build
npm run build:electron
npm run check:extension-bundle
npm run check:desktop-bundle
npm run test:smoke
npm run test:desktop
```

## 常用命令

```bash
npm run dev
npm run dev:electron
npm run build
npm run build:electron
npm run test
npm run test:smoke
npm run test:desktop
npm run package:mac
npm run package:win
```

Node.js 基线为 22.12 或更高版本，见 `.nvmrc`。

## 平台约束

### Chrome 扩展

- Content runtime 由 `src/extension/content-entry.ts` 经 Vite 构建为单一 MV3 bundle。
- 不重新引入经典脚本加载顺序、源码字符串执行或 `window.CursorDanceContentModules` 注册表。
- Popup、Workbench 与 content runtime 共享 schema v4 配置语义。

### Electron 桌面端

- Workbench 与 Overlay 使用各自受限 preload；renderer 不直接获得 Node 或 Electron 权限。
- IPC channel 使用 `src/shared/ipc-channels.ts` 常量，并遵守 sender/window kind 校验。
- 桌面只支持有真实系统语义的动作；不要添加 DOM hover 或页面音频 ducking。
- 平台差异通过 capability / adapter 表达，不复制 shared runtime。
- 自定义光标、全局输入、自动更新和窗口生命周期改动必须有桌面测试或真机证据。

## 数据与兼容策略

- 持久化配置只支持 schema v4，不新增 v3/legacy 迁移器、双写字段或旧别名。
- 主题使用 `theme` / `themeId` / `getActiveTheme` 命名。
- Electron 图片素材保存 asset id，通过受限 `cursordance-asset://` 协议加载；不要把 data URL 重新塞回高频配置广播。
- 不删除仍承担隐私、安全、发布或平台能力职责的代码；删除前使用入口搜索、Knip、测试或产品裁决提供证据。

## Git 与文档

- 提交信息使用英文类型前缀和中文描述，例如 `refactor: 统一组件命名与工程约束`。
- `PROGRESS.md` 只保存当前状态和近期里程碑，不复制逐提交流水账。
- 已完成且不再指导执行的计划移动到 `docs/archive/`，不要继续从活跃文档引用它们。
- 历史文档中的旧名称可以保留用于追溯，但活跃 README、架构说明、路径映射和启动指令必须与代码一致。
