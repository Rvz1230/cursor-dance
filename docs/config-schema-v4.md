# CursorDance 配置 Schema v4

状态：**R3-1 已冻结**

类型与运行时契约：`src/shared/config-schema-v4.ts`
生效范围：Chrome 扩展、Electron 桌面端、静态 Workbench 共用的运行时配置

## 1. 目标

v4 只描述效果运行时真正需要的数据，并建立单一真值源。编辑器导航、重置快照、兼容别名和平台存储细节不属于运行时配置。

核心约束：

- 根配置只保留 `themes` 和 `activeThemeId`，不再双写主题与当前主题别名。
- Web 和桌面规则合并为 `contextRules`，通过 `context` 判别联合类型。
- 动作配置直接位于主题的 `actionConfigs`，不再嵌套在 `workbenchDraft`。
- `cursorBindings` 只描述状态继承和动作绑定；光标图像只存在于 `cursorSkin`。
- 键盘反馈只存在于主题级 `keyFeedbackConfig`。
- 素材允许使用内联 `dataUrl` 或持久化 `assetId`，两者由 `kind` 明确区分。
- 所有动作扩展数据必须是有限、无循环的 JSON 值，不能持久化函数、`undefined`、`NaN` 或宿主对象。
- v4 domain 类型使用只读字段；迁移和 normalize 完成后，业务代码不应原地修改配置。

## 2. 根结构

```ts
interface CursorDanceConfigV4 {
  schemaVersion: 4;
  enabled: boolean;
  activeThemeId: string;
  themes: readonly CursorDanceThemeV4[];
  contextRules: readonly ContextRuleV4[];
  performance: PerformancePolicyV4;
}
```

根对象采用严格字段白名单。出现未知字段意味着调用方仍在写旧模型，验证器会拒绝，而不是静默保留。

### 不再进入运行时配置的数据

- 当前工作区、选中的 action、选中的 cursor state 等编辑器导航状态。
- `resetActionConfigs`、`resetKeyFeedbackConfig` 等可由默认主题重新生成的重置快照。
- 主题卡片的临时 UI 状态、诊断视图状态、最近素材列表和 AI 会话。
- Live Preview 标志、存储 key、文件路径和 Electron/Chrome 平台信息。

这些数据后续由 R3-4 的独立 repository 保存。

## 3. 主题结构

```ts
interface CursorDanceThemeV4 {
  id: string;
  name: string;
  description?: string;
  kind: "builtin" | "custom";
  actionConfigs: Readonly<Record<string, ConfigJsonObject>>;
  cursorBindings: Readonly<Record<string, CursorBindingV4>>;
  cursorSkin: CursorSkinV4;
  keyFeedbackConfig: KeyFeedbackConfigV4;
  atmosphere?: ConfigJsonObject;
}
```

主题 ID 必须非空且在同一配置内唯一。`activeThemeId` 和规则中的 `themeId` 必须引用真实主题。

### 动作配置

`actionConfigs` 继续使用 action ID 作为 key，使现有动作体系可以逐步迁移。字段值限制为 JSON object；更细的动作字段验证由效果模型负责，不放进配置 envelope 验证器。

### 光标状态

`cursorBindings` 和 `cursorSkin` 职责分离：

- `cursorBindings[stateId]`：该状态继承还是覆盖，以及触发哪个 action。
- `cursorSkin.states[stateId]`：图像、热点和显示尺寸。

这会替代 v3 中互相重叠的 `cursorStates`、`cursorModes`、`cursorStateActions`、`cursorStateAssets` 以及两处 `cursorSkin`。

### 素材引用

```ts
type CursorImageV4 =
  | { kind: "dataUrl"; dataUrl: string; mimeType: string; width: number; height: number }
  | { kind: "asset"; assetId: string; mimeType: string; width: number; height: number };
```

`dataUrl` 用于旧配置迁移、主题导入导出和尚未进入资产仓库的临时数据。R3-3 完成后，平台持久化层必须先将大素材转换成 `assetId`，再保存配置；业务 domain 不需要因此升级到 schema v5。

## 4. 上下文规则

规则统一使用以下 action：

```ts
type ContextRuleActionV4 =
  | { type: "disable" }
  | { type: "enable"; themeId?: string };
```

Web 规则：

```ts
interface WebContextRuleV4 {
  id: string;
  context: "web";
  enabled: boolean;
  match: { type: "exact" | "glob"; host: string; path?: string };
  action: ContextRuleActionV4;
}
```

桌面规则：

```ts
interface DesktopContextRuleV4 {
  id: string;
  context: "desktop";
  enabled: boolean;
  match: {
    type: "exact" | "glob";
    target: "process" | "title";
    value: string;
  };
  action: ContextRuleActionV4;
}
```

`context` 是必需判别字段。Web 规则不能携带 `process/title`，桌面规则也不能携带 `host/path`。

## 5. legacy / v3 → v4 字段归属

Git 历史中第一个正式带 `schemaVersion` 的实现已经是 v3；仓库没有稳定定义过 schema v1 或 v2。更早的 PRD 和兼容读取路径使用未标版本的 `schemes/activeSchemeId`。因此迁移器只识别可验证的 `legacy-unversioned`、`v3` 和 `v4`，不会根据版本号猜测不存在的中间格式。

| v3 字段 | v4 位置 | R3-2 处理 |
| --- | --- | --- |
| `activeThemePackId` / `activeSchemeId` | `activeThemeId` | 按优先级读取一次 |
| `themePacks` / `schemes` | `themes` | 合并后只输出一份 |
| `workbenchDraft.actionConfigs` | `theme.actionConfigs` | 过滤派生字段后提升 |
| `workbenchDraft.cursorModes` + `cursorStateActions` | `theme.cursorBindings` | 合并成结构化 binding |
| `cursorSkin` / `workbenchDraft.cursorSkin` | `theme.cursorSkin` | 顶层主题值优先，只输出一份 |
| `cursorStates` / `cursorStateAssets` | `theme.cursorSkin` | 仅在没有规范 skin 时迁移图像 |
| 主题级/全局 `keyFeedbackConfig` | `theme.keyFeedbackConfig` | 主题值优先，全局值只作旧数据 fallback |
| `siteRules` | `contextRules[context=web]` | 转成 Web 判别类型 |
| `appRules` 或旧桌面 `siteRules` | `contextRules[context=desktop]` | 转成 Desktop 判别类型 |
| `editor` | 独立 editor repository | 不进入 v4 runtime config |
| `reset*`、主题摘要等派生值 | 不持久化 | 从默认值或主题内容重建 |

## 6. 验证与迁移边界

`validateCursorDanceConfigV4(unknown)` 只验证已经迁移完成的规范数据，不承担兼容迁移，也不会补默认值。

R3-2 的固定处理顺序为：

```text
unknown persisted input
  → 验证输入 envelope 和大小
  → 识别 legacy-unversioned / v3 / v4
  → 单向迁移到 v4
  → 补全默认值并规范化
  → validateCursorDanceConfigV4
  → 冻结或按不可变对象使用
```

禁止在 v4 normalize 中重新生成 `themePacks/schemes` 等兼容别名。旧格式只允许出现在迁移输入类型、迁移 fixture 和导入兼容测试中。

## 7. R3-1 验收结果

- 建立共享只读 TypeScript domain contract。
- 建立严格运行时验证器和断言函数。
- 根字段、主题字段、规则判别、ID 引用、JSON 数据和素材引用均有拒绝路径测试。
- 键盘反馈类型已改为复用共享 v4 定义，开始消除两端模型重复。
- 当前生产持久化仍写 v3；切换写入版本属于 R3-2，避免在迁移器完成前破坏现有用户数据。
