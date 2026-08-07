/** @platform shared — canonical CursorDance runtime configuration contract. */

export const CURSORDANCE_CONFIG_SCHEMA_VERSION = 4 as const;

type ConfigJsonPrimitive = string | number | boolean | null;
type ConfigJsonValue =
  | ConfigJsonPrimitive
  | readonly ConfigJsonValue[]
  | { readonly [key: string]: ConfigJsonValue };
type ConfigJsonObject = { readonly [key: string]: ConfigJsonValue };

type ThemeKindV4 = "builtin" | "custom";
type CursorBindingModeV4 = "inherit" | "override";
type CursorImageMimeTypeV4 = "image/png" | "image/svg+xml" | "image/webp" | "image/unknown";
type CursorSizeModeV4 = "source" | "fixedBox";

interface CursorImageMetadataV4 {
  readonly mimeType: CursorImageMimeTypeV4;
  readonly width: number;
  readonly height: number;
}

interface InlineCursorImageV4 extends CursorImageMetadataV4 {
  readonly kind: "dataUrl";
  readonly dataUrl: string;
}

interface StoredCursorImageV4 extends CursorImageMetadataV4 {
  readonly kind: "asset";
  readonly assetId: string;
}

type CursorImageV4 = InlineCursorImageV4 | StoredCursorImageV4;

export interface CursorSkinStateV4 {
  readonly image: CursorImageV4;
  readonly hotspot: {
    readonly x: number;
    readonly y: number;
  };
  readonly size: {
    readonly mode: CursorSizeModeV4;
    readonly boxSize?: number;
  };
}

export interface CursorSkinV4 {
  readonly version: 1;
  readonly enabled: boolean;
  readonly transitionMs: number;
  readonly states: Readonly<Record<string, CursorSkinStateV4>>;
}

export interface CursorBindingV4 {
  readonly mode: CursorBindingModeV4;
  readonly actionId: string;
}

export interface KeyFeedbackConfigV4 {
  readonly enabled: boolean;
  readonly animationStyle: "bounce" | "raindrop";
  readonly anchor: "screen" | "window" | "caret";
  readonly originEdge: "bottom" | "top" | "left" | "right";
  readonly originMapping: "keyboardLayout" | "center" | "typewriter";
  readonly globalOffsetX: number;
  readonly globalOffsetY: number;
  readonly fontSize: number;
  readonly fontWeight: string;
  readonly fontFamily: string;
  readonly color: string;
  readonly opacity: number;
  readonly uppercase: boolean;
  readonly showModifierKeys: boolean;
  readonly keyDisplayMode: "typed" | "physical";
  readonly semanticStyles: boolean;
  readonly semShortcut: number;
  readonly semModifier: number;
  readonly semSpecial: number;
  readonly typingCombo: boolean;
  readonly comboGain: number;
  readonly comboScale: boolean;
  readonly comboOpacity: boolean;
  readonly comboGlow: boolean;
  readonly duration: number;
  readonly easing: string;
  readonly scale: number;
  readonly bounceHeight: number;
  readonly gravity: number;
  readonly wind: number;
  readonly glow: boolean;
  readonly glowColor: string;
  readonly glowRadius: number;
  readonly colorMode: "solid" | "byKey" | "byRhythm" | "bySemantic";
  readonly hueSpread: number;
  readonly gradient: boolean;
  readonly gradientTo: string;
  readonly trail: boolean;
  readonly trailLength: number;
  readonly exitStyle: "fade" | "shrink" | "rise" | "blur";
  readonly splash: boolean;
  readonly cooldownMs: number;
  readonly maxSimultaneous: number;
  readonly delay: number;
}

export interface CursorDanceThemeV4 {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly kind: ThemeKindV4;
  readonly actionConfigs: Readonly<Record<string, ConfigJsonObject>>;
  readonly cursorBindings: Readonly<Record<string, CursorBindingV4>>;
  readonly cursorSkin: CursorSkinV4;
  readonly keyFeedbackConfig: KeyFeedbackConfigV4;
  readonly atmosphere?: ConfigJsonObject;
}

export type ContextRuleActionV4 =
  | { readonly type: "disable" }
  | { readonly type: "enable"; readonly themeId?: string };

interface ContextRuleBaseV4 {
  readonly id: string;
  readonly enabled: boolean;
  readonly action: ContextRuleActionV4;
}

export interface WebContextRuleV4 extends ContextRuleBaseV4 {
  readonly context: "web";
  readonly match: {
    readonly type: "exact" | "glob";
    readonly host: string;
    readonly path?: string;
  };
}

interface DesktopContextRuleV4 extends ContextRuleBaseV4 {
  readonly context: "desktop";
  readonly kind?: "application" | "advanced";
  readonly preferredThemeId?: string;
  readonly match: {
    readonly type: "exact" | "glob";
    readonly target: "bundle" | "process" | "title";
    readonly value: string;
  };
}

export type ContextRuleV4 = WebContextRuleV4 | DesktopContextRuleV4;

interface PerformancePolicyV4 {
  readonly maxActiveEffects: number;
}

export interface CursorDanceConfigV4 {
  readonly schemaVersion: typeof CURSORDANCE_CONFIG_SCHEMA_VERSION;
  readonly enabled: boolean;
  readonly activeThemeId: string;
  readonly themes: readonly CursorDanceThemeV4[];
  readonly contextRules: readonly ContextRuleV4[];
  readonly performance: PerformancePolicyV4;
}

interface ConfigV4Issue {
  readonly path: string;
  readonly message: string;
}

export type ConfigV4ValidationResult =
  | { readonly ok: true; readonly value: CursorDanceConfigV4 }
  | { readonly ok: false; readonly issues: readonly ConfigV4Issue[] };

type MutableIssueList = ConfigV4Issue[];
type UnknownRecord = Record<string, unknown>;

const ROOT_KEYS = new Set(["schemaVersion", "enabled", "activeThemeId", "themes", "contextRules", "performance"]);
const THEME_KEYS = new Set([
  "id",
  "name",
  "description",
  "kind",
  "actionConfigs",
  "cursorBindings",
  "cursorSkin",
  "keyFeedbackConfig",
  "atmosphere",
]);
const KEY_FEEDBACK_KEYS = new Set([
  "enabled",
  "animationStyle",
  "anchor",
  "originEdge",
  "originMapping",
  "globalOffsetX",
  "globalOffsetY",
  "fontSize",
  "fontWeight",
  "fontFamily",
  "color",
  "opacity",
  "uppercase",
  "showModifierKeys",
  "keyDisplayMode",
  "semanticStyles",
  "semShortcut",
  "semModifier",
  "semSpecial",
  "typingCombo",
  "comboGain",
  "comboScale",
  "comboOpacity",
  "comboGlow",
  "duration",
  "easing",
  "scale",
  "bounceHeight",
  "gravity",
  "wind",
  "glow",
  "glowColor",
  "glowRadius",
  "colorMode",
  "hueSpread",
  "gradient",
  "gradientTo",
  "trail",
  "trailLength",
  "exitStyle",
  "splash",
  "cooldownMs",
  "maxSimultaneous",
  "delay",
]);

function isPlainRecord(value: unknown): value is UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function addIssue(issues: MutableIssueList, path: string, message: string): void {
  issues.push({ path, message });
}

function rejectUnknownKeys(value: UnknownRecord, allowed: ReadonlySet<string>, path: string, issues: MutableIssueList): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) addIssue(issues, `${path}.${key}`, "field is not part of schema v4");
  }
}

function requireNonEmptyString(value: unknown, path: string, issues: MutableIssueList): value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    addIssue(issues, path, "must be a non-empty string");
    return false;
  }
  return true;
}

function requireFiniteNumber(value: unknown, path: string, issues: MutableIssueList): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    addIssue(issues, path, "must be a finite number");
    return false;
  }
  return true;
}

function isConfigJsonValue(value: unknown, ancestors = new WeakSet<object>()): value is ConfigJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (!value || typeof value !== "object") return false;
  if (ancestors.has(value)) return false;
  ancestors.add(value);
  const valid = Array.isArray(value)
    ? value.every((entry) => isConfigJsonValue(entry, ancestors))
    : isPlainRecord(value) && Object.values(value).every((entry) => isConfigJsonValue(entry, ancestors));
  ancestors.delete(value);
  return valid;
}

function validateCursorImage(value: unknown, path: string, issues: MutableIssueList): void {
  if (!isPlainRecord(value)) {
    addIssue(issues, path, "must be an image object");
    return;
  }
  const commonKeys = ["kind", "mimeType", "width", "height"];
  const kindKey = value.kind === "asset" ? "assetId" : "dataUrl";
  rejectUnknownKeys(value, new Set([...commonKeys, kindKey]), path, issues);
  if (value.kind !== "dataUrl" && value.kind !== "asset") addIssue(issues, `${path}.kind`, "must be dataUrl or asset");
  if (!["image/png", "image/svg+xml", "image/webp", "image/unknown"].includes(String(value.mimeType))) {
    addIssue(issues, `${path}.mimeType`, "is not supported");
  }
  if (requireFiniteNumber(value.width, `${path}.width`, issues) && value.width <= 0) addIssue(issues, `${path}.width`, "must be positive");
  if (requireFiniteNumber(value.height, `${path}.height`, issues) && value.height <= 0) addIssue(issues, `${path}.height`, "must be positive");
  if (value.kind === "dataUrl") requireNonEmptyString(value.dataUrl, `${path}.dataUrl`, issues);
  if (value.kind === "asset") requireNonEmptyString(value.assetId, `${path}.assetId`, issues);
}

function validateCursorSkinState(value: unknown, path: string, issues: MutableIssueList): void {
  if (!isPlainRecord(value)) {
    addIssue(issues, path, "must be a cursor skin state");
    return;
  }
  rejectUnknownKeys(value, new Set(["image", "hotspot", "size"]), path, issues);
  validateCursorImage(value.image, `${path}.image`, issues);
  if (!isPlainRecord(value.hotspot)) {
    addIssue(issues, `${path}.hotspot`, "must be an object");
  } else {
    rejectUnknownKeys(value.hotspot, new Set(["x", "y"]), `${path}.hotspot`, issues);
    if (requireFiniteNumber(value.hotspot.x, `${path}.hotspot.x`, issues)
      && (value.hotspot.x < 0 || value.hotspot.x > 1)) {
      addIssue(issues, `${path}.hotspot.x`, "must be a normalized value from 0 to 1");
    }
    if (requireFiniteNumber(value.hotspot.y, `${path}.hotspot.y`, issues)
      && (value.hotspot.y < 0 || value.hotspot.y > 1)) {
      addIssue(issues, `${path}.hotspot.y`, "must be a normalized value from 0 to 1");
    }
  }
  if (!isPlainRecord(value.size)) {
    addIssue(issues, `${path}.size`, "must be an object");
  } else {
    rejectUnknownKeys(value.size, new Set(["mode", "boxSize"]), `${path}.size`, issues);
    if (value.size.mode !== "source" && value.size.mode !== "fixedBox") {
      addIssue(issues, `${path}.size.mode`, "must be source or fixedBox");
    }
    if (value.size.mode === "fixedBox") {
      if (requireFiniteNumber(value.size.boxSize, `${path}.size.boxSize`, issues) && value.size.boxSize <= 0) {
        addIssue(issues, `${path}.size.boxSize`, "must be positive");
      }
    } else if (value.size.boxSize !== undefined) {
      addIssue(issues, `${path}.size.boxSize`, "is only valid for fixedBox mode");
    }
  }
}

function validateCursorSkin(value: unknown, path: string, issues: MutableIssueList): void {
  if (!isPlainRecord(value)) {
    addIssue(issues, path, "must be a cursor skin object");
    return;
  }
  rejectUnknownKeys(value, new Set(["version", "enabled", "transitionMs", "states"]), path, issues);
  if (value.version !== 1) addIssue(issues, `${path}.version`, "must equal 1");
  if (typeof value.enabled !== "boolean") addIssue(issues, `${path}.enabled`, "must be boolean");
  if (requireFiniteNumber(value.transitionMs, `${path}.transitionMs`, issues) && value.transitionMs < 0) {
    addIssue(issues, `${path}.transitionMs`, "must not be negative");
  }
  if (!isPlainRecord(value.states)) {
    addIssue(issues, `${path}.states`, "must be an object");
    return;
  }
  for (const [stateId, state] of Object.entries(value.states)) {
    if (!stateId) addIssue(issues, `${path}.states`, "state ids must not be empty");
    validateCursorSkinState(state, `${path}.states.${stateId}`, issues);
  }
}

function validateCursorBindings(value: unknown, path: string, issues: MutableIssueList): void {
  if (!isPlainRecord(value)) {
    addIssue(issues, path, "must be an object");
    return;
  }
  for (const [stateId, binding] of Object.entries(value)) {
    const bindingPath = `${path}.${stateId}`;
    if (!stateId) addIssue(issues, path, "state ids must not be empty");
    if (!isPlainRecord(binding)) {
      addIssue(issues, bindingPath, "must be a cursor binding");
      continue;
    }
    rejectUnknownKeys(binding, new Set(["mode", "actionId"]), bindingPath, issues);
    if (binding.mode !== "inherit" && binding.mode !== "override") {
      addIssue(issues, `${bindingPath}.mode`, "must be inherit or override");
    }
    requireNonEmptyString(binding.actionId, `${bindingPath}.actionId`, issues);
  }
}

function validateKeyFeedback(value: unknown, path: string, issues: MutableIssueList): void {
  if (!isPlainRecord(value)) {
    addIssue(issues, path, "must be a key feedback object");
    return;
  }
  rejectUnknownKeys(value, KEY_FEEDBACK_KEYS, path, issues);

  const booleans = [
    "enabled", "uppercase", "showModifierKeys", "semanticStyles", "typingCombo", "comboScale", "comboOpacity",
    "comboGlow", "glow", "gradient", "trail", "splash",
  ];
  const numbers = [
    "globalOffsetX", "globalOffsetY", "fontSize", "opacity", "duration", "scale", "bounceHeight", "gravity",
    "wind", "semShortcut", "semModifier", "semSpecial", "comboGain", "glowRadius", "hueSpread", "trailLength",
    "cooldownMs", "maxSimultaneous", "delay",
  ];
  const strings = ["fontWeight", "fontFamily", "color", "easing", "glowColor", "gradientTo"];
  for (const key of booleans) if (typeof value[key] !== "boolean") addIssue(issues, `${path}.${key}`, "must be boolean");
  for (const key of numbers) requireFiniteNumber(value[key], `${path}.${key}`, issues);
  for (const key of strings) requireNonEmptyString(value[key], `${path}.${key}`, issues);
  if (value.animationStyle !== "bounce" && value.animationStyle !== "raindrop") addIssue(issues, `${path}.animationStyle`, "is invalid");
  if (value.anchor !== "screen" && value.anchor !== "window" && value.anchor !== "caret") addIssue(issues, `${path}.anchor`, "is invalid");
  if (!["bottom", "top", "left", "right"].includes(String(value.originEdge))) addIssue(issues, `${path}.originEdge`, "is invalid");
  if (!["keyboardLayout", "center", "typewriter"].includes(String(value.originMapping))) addIssue(issues, `${path}.originMapping`, "is invalid");
  if (value.keyDisplayMode !== "typed" && value.keyDisplayMode !== "physical") addIssue(issues, `${path}.keyDisplayMode`, "is invalid");
  if (!["solid", "byKey", "byRhythm", "bySemantic"].includes(String(value.colorMode))) addIssue(issues, `${path}.colorMode`, "is invalid");
  if (!["fade", "shrink", "rise", "blur"].includes(String(value.exitStyle))) addIssue(issues, `${path}.exitStyle`, "is invalid");
}

function validateTheme(value: unknown, index: number, issues: MutableIssueList): string | null {
  const path = `themes[${index}]`;
  if (!isPlainRecord(value)) {
    addIssue(issues, path, "must be a theme object");
    return null;
  }
  rejectUnknownKeys(value, THEME_KEYS, path, issues);
  const id = requireNonEmptyString(value.id, `${path}.id`, issues) ? value.id : null;
  requireNonEmptyString(value.name, `${path}.name`, issues);
  if (value.description !== undefined && typeof value.description !== "string") addIssue(issues, `${path}.description`, "must be a string");
  if (value.kind !== "builtin" && value.kind !== "custom") addIssue(issues, `${path}.kind`, "must be builtin or custom");

  if (!isPlainRecord(value.actionConfigs)) {
    addIssue(issues, `${path}.actionConfigs`, "must be an object");
  } else {
    for (const [actionId, actionConfig] of Object.entries(value.actionConfigs)) {
      if (!actionId) addIssue(issues, `${path}.actionConfigs`, "action ids must not be empty");
      if (!isPlainRecord(actionConfig) || !isConfigJsonValue(actionConfig)) {
        addIssue(issues, `${path}.actionConfigs.${actionId}`, "must be a JSON object");
      }
    }
  }

  validateCursorBindings(value.cursorBindings, `${path}.cursorBindings`, issues);
  validateCursorSkin(value.cursorSkin, `${path}.cursorSkin`, issues);
  validateKeyFeedback(value.keyFeedbackConfig, `${path}.keyFeedbackConfig`, issues);
  if (value.atmosphere !== undefined && (!isPlainRecord(value.atmosphere) || !isConfigJsonValue(value.atmosphere))) {
    addIssue(issues, `${path}.atmosphere`, "must be a JSON object");
  }
  return id;
}

function validateRuleAction(value: unknown, path: string, themeIds: ReadonlySet<string>, issues: MutableIssueList): void {
  if (!isPlainRecord(value)) {
    addIssue(issues, path, "must be an action object");
    return;
  }
  if (value.type === "disable") {
    rejectUnknownKeys(value, new Set(["type"]), path, issues);
    return;
  }
  if (value.type === "enable") {
    rejectUnknownKeys(value, new Set(["type", "themeId"]), path, issues);
    if (value.themeId !== undefined && (!requireNonEmptyString(value.themeId, `${path}.themeId`, issues) || !themeIds.has(value.themeId))) {
      addIssue(issues, `${path}.themeId`, "must reference an existing theme");
    }
    return;
  }
  addIssue(issues, `${path}.type`, "must be enable or disable");
}

function validateContextRule(value: unknown, index: number, themeIds: ReadonlySet<string>, issues: MutableIssueList): string | null {
  const path = `contextRules[${index}]`;
  if (!isPlainRecord(value)) {
    addIssue(issues, path, "must be a context rule object");
    return null;
  }
  rejectUnknownKeys(
    value,
    value.context === "desktop"
      ? new Set(["id", "context", "enabled", "kind", "preferredThemeId", "match", "action"])
      : new Set(["id", "context", "enabled", "match", "action"]),
    path,
    issues,
  );
  const id = requireNonEmptyString(value.id, `${path}.id`, issues) ? value.id : null;
  if (typeof value.enabled !== "boolean") addIssue(issues, `${path}.enabled`, "must be boolean");
  validateRuleAction(value.action, `${path}.action`, themeIds, issues);

  if (!isPlainRecord(value.match)) {
    addIssue(issues, `${path}.match`, "must be an object");
    return id;
  }
  if (value.context === "web") {
    rejectUnknownKeys(value.match, new Set(["type", "host", "path"]), `${path}.match`, issues);
    if (value.match.type !== "exact" && value.match.type !== "glob") addIssue(issues, `${path}.match.type`, "must be exact or glob");
    requireNonEmptyString(value.match.host, `${path}.match.host`, issues);
    if (value.match.path !== undefined && typeof value.match.path !== "string") addIssue(issues, `${path}.match.path`, "must be a string");
  } else if (value.context === "desktop") {
    if (value.kind !== undefined && value.kind !== "application" && value.kind !== "advanced") {
      addIssue(issues, `${path}.kind`, "must be application or advanced");
    }
    if (value.preferredThemeId !== undefined) {
      if (
        !requireNonEmptyString(value.preferredThemeId, `${path}.preferredThemeId`, issues)
        || !themeIds.has(value.preferredThemeId)
      ) {
        addIssue(issues, `${path}.preferredThemeId`, "must reference an existing theme");
      }
    }
    rejectUnknownKeys(value.match, new Set(["type", "target", "value"]), `${path}.match`, issues);
    if (value.match.type !== "exact" && value.match.type !== "glob") addIssue(issues, `${path}.match.type`, "must be exact or glob");
    if (value.match.target !== "bundle" && value.match.target !== "process" && value.match.target !== "title") {
      addIssue(issues, `${path}.match.target`, "must be bundle, process or title");
    }
    requireNonEmptyString(value.match.value, `${path}.match.value`, issues);
  } else {
    addIssue(issues, `${path}.context`, "must be web or desktop");
  }
  return id;
}

export function validateCursorDanceConfigV4(value: unknown): ConfigV4ValidationResult {
  const issues: MutableIssueList = [];
  if (!isPlainRecord(value)) {
    return { ok: false, issues: [{ path: "$", message: "configuration must be an object" }] };
  }
  rejectUnknownKeys(value, ROOT_KEYS, "$", issues);
  if (value.schemaVersion !== CURSORDANCE_CONFIG_SCHEMA_VERSION) addIssue(issues, "schemaVersion", "must equal 4");
  if (typeof value.enabled !== "boolean") addIssue(issues, "enabled", "must be boolean");
  const activeThemeId = requireNonEmptyString(value.activeThemeId, "activeThemeId", issues) ? value.activeThemeId : "";

  const themeIds = new Set<string>();
  if (!Array.isArray(value.themes) || value.themes.length === 0) {
    addIssue(issues, "themes", "must contain at least one theme");
  } else {
    value.themes.forEach((theme, index) => {
      const id = validateTheme(theme, index, issues);
      if (!id) return;
      if (themeIds.has(id)) addIssue(issues, `themes[${index}].id`, "must be unique");
      themeIds.add(id);
    });
  }
  if (activeThemeId && !themeIds.has(activeThemeId)) addIssue(issues, "activeThemeId", "must reference an existing theme");

  const ruleIds = new Set<string>();
  if (!Array.isArray(value.contextRules)) {
    addIssue(issues, "contextRules", "must be an array");
  } else {
    value.contextRules.forEach((rule, index) => {
      const id = validateContextRule(rule, index, themeIds, issues);
      if (!id) return;
      if (ruleIds.has(id)) addIssue(issues, `contextRules[${index}].id`, "must be unique");
      ruleIds.add(id);
    });
  }

  if (!isPlainRecord(value.performance)) {
    addIssue(issues, "performance", "must be an object");
  } else {
    rejectUnknownKeys(value.performance, new Set(["maxActiveEffects"]), "performance", issues);
    if (
      requireFiniteNumber(value.performance.maxActiveEffects, "performance.maxActiveEffects", issues)
      && (!Number.isInteger(value.performance.maxActiveEffects) || value.performance.maxActiveEffects < 1)
    ) {
      addIssue(issues, "performance.maxActiveEffects", "must be a positive integer");
    }
  }

  return issues.length
    ? { ok: false, issues }
    : { ok: true, value: value as unknown as CursorDanceConfigV4 };
}

export function assertCursorDanceConfigV4(value: unknown): asserts value is CursorDanceConfigV4 {
  const result = validateCursorDanceConfigV4(value);
  if (result.ok === false) {
    const details = result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    throw new Error(`Invalid CursorDance schema v4 configuration: ${details}`);
  }
}
