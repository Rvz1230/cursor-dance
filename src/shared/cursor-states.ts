/**
 * @platform shared — 光标状态的唯一真值源。
 *
 * 此前状态词表被复制在 7 处（Workbench 的 CURSOR_STATES、默认配置的
 * DEFAULT_CURSOR_STATE_IDS、overlay 的类型联合、persistence 的硬编码数组、
 * 素材文件名匹配表、试用区 TRY_ZONES，以及运行时解析输出），且存在三套互不
 * 兼容的词汇——运行时产出 `wait`，而配置槽位叫 `busy`，导致「忙碌」永不生效。
 *
 * 这里以 **运行时实际能产出的状态** 为准来定义可达性：
 * - 扩展（web）：`resolveCursorStateId` 读 `getComputedStyle(el).cursor`，
 *   能区分 default / text / pointer / notAllowed / busy / help。
 *   注意它把 grab、grabbing、move、crosshair、*-resize 全部归并成 pointer。
 * - 桌面：没有 DOM，也没有查询系统当前光标的能力，overlay 只能从自身的
 *   拖拽状态机推出 default / grabbing 两种。
 *
 * 因此不可达的状态不再提供配置槽位。新增状态时必须同时让运行时真的能产出它，
 * 否则 `cursor-states.test.ts` 的一致性断言会失败。
 */

export type CursorStateId =
  | "default"
  | "text"
  | "pointer"
  | "notAllowed"
  | "busy"
  | "help"
  | "grabbing";

export type CursorStatePlatform = "extension" | "desktop";

type CursorHotspotPreset = "topLeft" | "center";

export interface CursorStateDescriptor {
  readonly id: CursorStateId;
  readonly label: string;
  readonly detail: string;
  /** 建议的默认指向点。文本/拖拽/精确类光标通常更适合中心点。 */
  readonly defaultHotspot: CursorHotspotPreset;
  /** 运行时确实能产出该状态的平台。空数组意味着该状态不该存在。 */
  readonly reachableOn: readonly CursorStatePlatform[];
}

const CURSOR_STATE_DESCRIPTORS: readonly CursorStateDescriptor[] = [
  {
    id: "default",
    label: "普通",
    detail: "默认指针，无法识别状态时使用",
    defaultHotspot: "topLeft",
    reachableOn: ["extension", "desktop"],
  },
  {
    id: "text",
    label: "文本选择",
    detail: "输入框、编辑器、文本区域",
    defaultHotspot: "center",
    reachableOn: ["extension"],
  },
  {
    id: "pointer",
    label: "可点击",
    detail: "按钮、链接、菜单项；也覆盖拖拽、缩放和精确选择光标",
    defaultHotspot: "topLeft",
    reachableOn: ["extension"],
  },
  {
    id: "notAllowed",
    label: "不可用",
    detail: "禁用按钮、无效拖放区域",
    defaultHotspot: "center",
    reachableOn: ["extension"],
  },
  {
    id: "busy",
    label: "忙碌",
    detail: "页面加载、等待响应",
    defaultHotspot: "center",
    reachableOn: ["extension"],
  },
  {
    id: "help",
    label: "帮助",
    detail: "帮助提示、说明图标",
    defaultHotspot: "topLeft",
    reachableOn: ["extension"],
  },
  {
    id: "grabbing",
    label: "拖拽中",
    detail: "按住并移动对象或内容",
    defaultHotspot: "center",
    reachableOn: ["desktop"],
  },
];

const CURSOR_STATE_DESCRIPTORS_BY_ID: Readonly<Record<CursorStateId, CursorStateDescriptor>> =
  Object.freeze(
    Object.fromEntries(
      CURSOR_STATE_DESCRIPTORS.map((descriptor) => [descriptor.id, descriptor]),
    ) as Record<CursorStateId, CursorStateDescriptor>,
  );

/** 全部合法状态 id（两端并集）。持久化配置只允许出现这些 key。 */
export const CURSOR_STATE_IDS: readonly CursorStateId[] = CURSOR_STATE_DESCRIPTORS.map(
  (descriptor) => descriptor.id,
);

export function getCursorStatesForPlatform(
  platform: CursorStatePlatform,
): readonly CursorStateDescriptor[] {
  return CURSOR_STATE_DESCRIPTORS.filter((descriptor) => descriptor.reachableOn.includes(platform));
}

/** 完整的合法状态清单。编辑器用它展示跨平台配置，并用 reachableOn 如实标注可达性。 */
export function getAllCursorStates(): readonly CursorStateDescriptor[] {
  return CURSOR_STATE_DESCRIPTORS;
}

export function isCursorStateId(value: unknown): value is CursorStateId {
  return typeof value === "string" && value in CURSOR_STATE_DESCRIPTORS_BY_ID;
}

/**
 * 丢弃不在真值源里的状态 key。
 *
 * 存量配置可能带有已移除的槽位（grab / crosshair / move / resize* 等）。
 * `validateCursorSkin` 不做 id 白名单校验，所以这些 key 不会让整份配置校验失败；
 * 这里在读写路径上静默丢弃即可，**不可** 改成拒绝式校验——那会触发
 * 「非 v4 数据整份恢复默认配置」，把用户其余主题一起清掉。
 */
export function pickKnownCursorStates<T>(
  states: Readonly<Record<string, T>> | null | undefined,
): Record<string, T> {
  if (!states) return {};
  return Object.fromEntries(
    Object.entries(states).filter(([stateId]) => isCursorStateId(stateId)),
  );
}

/** 素材文件名 → 状态 id 的启发式匹配。仅覆盖真值源里的状态。 */
const FILE_NAME_MATCH_RULES: readonly { stateId: CursorStateId; patterns: readonly string[] }[] = [
  { stateId: "default", patterns: ["normal", "default", "arrow", "cursor", "base"] },
  { stateId: "pointer", patterns: ["pointer", "hand", "link", "hover", "click"] },
  { stateId: "text", patterns: ["text", "ibeam", "i-beam", "input"] },
  { stateId: "grabbing", patterns: ["grabbing", "closedhand", "dragging", "drag", "grab"] },
  { stateId: "busy", patterns: ["wait", "busy", "loading", "progress"] },
  {
    stateId: "notAllowed",
    patterns: ["disabled", "disable", "notallowed", "not-allowed", "ban", "forbidden"],
  },
  { stateId: "help", patterns: ["help", "question"] },
];

export function matchCursorStateIdFromFileName(fileName: string): CursorStateId | "" {
  const normalized = fileName.toLowerCase().replace(/\.[^.]+$/, "");
  const matched = FILE_NAME_MATCH_RULES.find((rule) =>
    rule.patterns.some((pattern) => normalized.includes(pattern)),
  );
  return matched?.stateId ?? "";
}
