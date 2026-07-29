# CursorDance 配置 Schema v4

状态：**R3-3 已投入生产链路**

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

`dataUrl` 只用于主题导入导出和尚未进入资产仓库的临时数据。Electron 与 Chrome 持久化层都会先将大素材转换成 `assetId` 再保存配置；业务 domain 不需要因此升级到 schema v5。Electron 使用 `sha256:<digest>` 内容寻址并通过 `cursordance-asset://` 只读协议加载，主题导出时由主进程恢复为可移植 data URL。

动作贴纸目前仍属于通用 `actionConfigs` JSON：编辑态使用 `imageDataUrl`，Electron 持久化态使用 `imageAssetId`，两者不会同时写入磁盘。主进程拒绝远程图片 URL 和非法 asset URL；后续动作配置强类型化时再把该字段收敛为与光标一致的判别联合类型。

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

## 5. v4-only 读取策略

生产代码只识别 `schemaVersion: 4`，不解析未标版本、v1/v2/v3，也不根据旧字段猜测用户意图。旧字段名仅作为严格验证器的拒绝用例存在，不进入生产转换逻辑。

固定读取流程：

```text
unknown persisted input
  → validateCursorDanceConfigV4
  → 有效：冻结或按不可变对象使用
  → 无效：直接使用已验证的最新默认 v4 配置
```

这项策略接受升级后丢弃旧配置的行为，以换取更小的生产代码、更清晰的单一数据模型和更低的长期维护成本。R3-2 切换生产链路后，将删除 v3 模型、旧别名写入与旧版本识别分支。

## 6. 验证与恢复边界

`validateCursorDanceConfigV4(unknown)` 只验证规范 v4 数据，不承担兼容迁移，也不会补默认值。

- `schemaVersion !== 4`、缺失版本号或存在未知字段时，整份配置判为无效。
- 无效持久化数据直接恢复最新默认配置，不保留 legacy/v3 迁移器、fixture 或备份格式。
- 默认配置自身必须通过同一个严格验证器；默认值不合法属于构建或测试失败，不能在运行时静默修补。
- normalize 只能处理 v4 内部允许的等价表示，禁止重新生成 `themePacks/schemes` 等兼容别名。
- Chrome Storage、Electron Store 和静态预览 adapter 使用同一读取策略，平台层只负责存取，不解释 schema。

## 7. R3-2 验收结果

- 建立共享只读 TypeScript domain contract。
- 建立严格运行时验证器和断言函数。
- 根字段、主题字段、规则判别、ID 引用、JSON 数据和素材引用均有拒绝路径测试。
- 键盘反馈类型已改为复用共享 v4 定义，开始消除两端模型重复。
- Electron、Chrome 扩展和静态 Workbench 已统一只读写 v4。
- Workbench 编辑草稿与导航状态不再混入运行时配置，主题文件只接受当前 v4 envelope。
- 既有非 v4、缺失字段、未知字段或损坏数据直接恢复最新默认配置，不执行迁移。
