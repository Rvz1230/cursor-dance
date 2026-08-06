import { getCssEasing } from "./easing-data";

export const ACTION_TRIGGER_FIELDS = ["triggerTiming", "triggerZone", "holdMs"] as const;
const ACTION_TEXT_FIELDS = [
  "textKind",
  "textStyle",
  "textMode",
  "textTemplate",
  "textEnabled",
  "textContent",
  "textTags",
  "textTagPlayMode",
  "textColor",
  "textDuration",
  "textEasing",
  "textOpacity",
  "textFontFamily",
  "textWeight",
  "textOutlineWidth",
  "textShadow",
  "comboEnabled",
  "textOffsetX",
  "textOffsetY",
  "fontSize",
  "textGradient",
  "textGradientStart",
  "textGradientEnd",
  "comboWindowMs",
  "textDelay",
] as const;
const ACTION_PARTICLE_FIELDS = [
  "particle",
  "particleCount",
  "particleSpread",
  "particleStyle",
  "particleDirection",
  "particleColorMode",
  "particleDuration",
  "particleSize",
  "particleOpacity",
  "particlePalette",
  "particleGravity",
  "particleWind",
  "particleBounce",
  "particleTrail",
  "particleDelay",
  "particleStagger",
  "particleMotionMode",
  "orbitalCount",
  "orbitalRadius",
  "orbitalSpeed",
] as const;
const ACTION_RIPPLE_FIELDS = [
  "ripple",
  "rippleSize",
  "rippleDuration",
  "rippleStyle",
  "rippleEasing",
  "rippleLineWidth",
  "rippleOpacity",
  "rippleColor",
  "rippleDelay",
] as const;
const ACTION_AUDIO_FIELDS = [
  "sound",
  "volume",
  "playbackRate",
  "soundDelay",
  "soundFadeOut",
  "soundTriggerMode",
  "soundBlendMode",
  "soundFile",
] as const;
const ACTION_ANIMATION_FIELDS = [
  "animationEnabled",
  "animationStyle",
  "animationDuration",
  "animationEasing",
  "animationScale",
  "animationOpacity",
  "animationOffsetX",
  "animationOffsetY",
  "animationColor",
  "animationGlow",
  "animationDelay",
] as const;
const ACTION_IMAGE_FIELDS = [
  "imageEnabled",
  "imageDataUrl",
  "imageAssetId",
  "imageDuration",
  "imageSize",
  "imageOpacity",
  "imageOffsetX",
  "imageOffsetY",
  "imageDelay",
] as const;
const ACTION_CURSOR_FEEDBACK_FIELDS = ["shake", "cursorOverride", "cursorSize", "cursorTrailEnabled", "cursorTrailCount", "cursorTrailOpacity", "cursorGlowColor"] as const;

const ACTION_RUNTIME_FIELDS = Array.from(new Set([
  ...ACTION_TRIGGER_FIELDS,
  ...ACTION_TEXT_FIELDS,
  ...ACTION_PARTICLE_FIELDS,
  ...ACTION_RIPPLE_FIELDS,
  ...ACTION_AUDIO_FIELDS,
  ...ACTION_ANIMATION_FIELDS,
  ...ACTION_IMAGE_FIELDS,
  ...ACTION_CURSOR_FEEDBACK_FIELDS,
]));

function pickActionConfigFields(
  config: Record<string, unknown> | null | undefined,
  fieldNames: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    fieldNames
      .map((fieldName) => [fieldName, config?.[fieldName]])
      .filter((entry) => entry[1] !== undefined),
  );
}

export function getActionTriggerConfig(config: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return pickActionConfigFields(config, ACTION_TRIGGER_FIELDS);
}

export function getActionTextConfig(config: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return pickActionConfigFields(config, ACTION_TEXT_FIELDS);
}

export function getActionParticleConfig(config: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return pickActionConfigFields(config, ACTION_PARTICLE_FIELDS);
}

export function getActionRippleConfig(config: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return pickActionConfigFields(config, ACTION_RIPPLE_FIELDS);
}

export function getActionAudioConfig(config: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return pickActionConfigFields(config, ACTION_AUDIO_FIELDS);
}

export function getActionAnimationConfig(config: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return pickActionConfigFields(config, ACTION_ANIMATION_FIELDS);
}

export function getActionImageConfig(config: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return pickActionConfigFields(config, ACTION_IMAGE_FIELDS);
}

export function getActionCursorFeedbackConfig(config: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return pickActionConfigFields(config, ACTION_CURSOR_FEEDBACK_FIELDS);
}

export function pickStoredActionConfigs(
  actionConfigs: Record<string, unknown> = {},
): Record<string, Record<string, unknown>> {
  return Object.fromEntries(Object.entries(actionConfigs).map(([actionId, value]) => {
    const config = value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
    return [actionId, pickActionConfigFields(config, ACTION_RUNTIME_FIELDS)];
  }));
}

export function hasCursorOverride(config: Record<string, unknown> | undefined): boolean {
  const cursorOverride = config?.cursorOverride;
  return cursorOverride === "木鱼（增强态）"
    || cursorOverride === "木鱼（按压态）"
    || cursorOverride === "木鱼（继承默认）"
    || cursorOverride === "切换到 pointer";
}

export function hexToRgba(hex: string | undefined, alpha: number): string {
  const normalized = (hex || "#f59e0b").replace("#", "");
  const value = normalized.length === 3
    ? normalized
        .split("")
        .map((item) => item + item)
        .join("")
    : normalized;
  const int = Number.parseInt(value, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getAnimationEasing(label: string): string {
  return getCssEasing(label);
}

export function getTextWeightValue(weightLabel: string): number {
  if (weightLabel === "加粗") return 700;
  if (weightLabel === "中等") return 600;
  return 500;
}

const TEXT_FONT_FAMILY_VALUES: Record<string, string> = {
  "系统默认": '"SF Pro Text","PingFang SC","Microsoft YaHei",system-ui,sans-serif',
  "苹方 / 微软雅黑": '"PingFang SC","Microsoft YaHei","Helvetica Neue",Arial,sans-serif',
  "宋体": 'SimSun,"Songti SC",serif',
  "黑体": 'SimHei,"Heiti SC",sans-serif',
  "楷体": 'KaiTi,"Kaiti SC",serif',
  "等宽字体": '"SFMono-Regular",Consolas,"Liberation Mono",monospace',
};

export function getTextFontFamily(value: string | undefined): string {
  const textFontFamily = typeof value === "string" ? value.trim() : "";
  if (!textFontFamily || textFontFamily === "自定义") return TEXT_FONT_FAMILY_VALUES["系统默认"];
  if (TEXT_FONT_FAMILY_VALUES[textFontFamily]) return TEXT_FONT_FAMILY_VALUES[textFontFamily];
  return textFontFamily.replace(/[;\n\r]/g, "").slice(0, 120) || TEXT_FONT_FAMILY_VALUES["系统默认"];
}

export function formatNumber(style: string | undefined, number: number): string {
  if (style?.includes("中文")) {
    const values = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
    return values[(number - 1) % values.length];
  }
  if (style?.includes("英文")) {
    const values = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
    return values[(number - 1) % values.length];
  }
  return String(number);
}

export function getOrderedTextTags(actionConfig: Record<string, unknown> | undefined): string[] {
  const currentTags = Array.isArray(actionConfig?.textTags) ? actionConfig.textTags.filter(Boolean) : [];
  const primaryText = typeof actionConfig?.textContent === "string" ? actionConfig.textContent.trim() : "";
  if (!primaryText) return currentTags;
  return [primaryText].concat(currentTags.filter((item: string) => item !== primaryText));
}
