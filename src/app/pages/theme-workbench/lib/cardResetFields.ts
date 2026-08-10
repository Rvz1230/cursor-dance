export const CARD_RESET_FIELDS: Record<string, readonly string[]> = {
  trigger: ["triggerTiming", "triggerZone", "holdMs"],
  text: [
    "textEnabled",
    "textKind",
    "textContent",
    "textTags",
    "textColor",
    "textDuration",
    "textEasing",
    "textWeight",
    "textShadow",
    "textStyle",
    "textMode",
    "textTemplate",
    "textTagPlayMode",
    "textOpacity",
    "textFontFamily",
    "textOutlineWidth",
    "textOffsetX",
    "textOffsetY",
    "textGradient",
    "textGradientStart",
    "textGradientEnd",
    "fontSize",
    "comboEnabled",
    "comboWindowMs",
    "textDelay",
  ],
  particle: [
    "particle",
    "particleStyle",
    "particleCount",
    "particleSpread",
    "particleDirection",
    "particleDuration",
    "particleSize",
    "particleOpacity",
    "particleGravity",
    "particleBounce",
    "particleWind",
    "particleTrail",
    "particleColorMode",
    "particlePalette",
    "particleStagger",
    "particleMotionMode",
    "particleDelay",
    "orbitalCount",
    "orbitalRadius",
    "orbitalSpeed",
  ],
  ripple: [
    "ripple",
    "rippleStyle",
    "rippleSize",
    "rippleDuration",
    "rippleEasing",
    "rippleOpacity",
    "rippleColor",
    "rippleLineWidth",
    "rippleDelay",
  ],
  audio: [
    "sound",
    "soundFile",
    "volume",
    "playbackRate",
    "soundFadeOut",
    "soundTriggerMode",
    "soundBlendMode",
    "soundDelay",
  ],
  animation: [
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
  ],
  image: [
    "imageEnabled",
    "imageDataUrl",
    "imageDuration",
    "imageSize",
    "imageOpacity",
    "imageOffsetX",
    "imageOffsetY",
    "imageDelay",
  ],
  cursor: [
    "shake",
    "cursorOverride",
    "cursorSize",
    "cursorGlowColor",
  ],
  trail: [
    "shape",
    "material",
    "length",
    "width",
    "lifetimeMs",
    "smoothing",
    "opacity",
    "glow",
    "velocityResponse",
    "turnResponse",
    "gestureResponse",
    "randomSeed",
    "clickColor",
    "clickDurationMs",
    "followCursorStateColor",
    "blendMode",
    "quality",
    "colors",
    "segments",
  ],
};

export function buildCardResetPatch(
  cardKey: keyof typeof CARD_RESET_FIELDS,
  currentConfig: Record<string, unknown>,
  defaultConfig: Record<string, unknown>,
): Record<string, unknown> | null {
  const fields = CARD_RESET_FIELDS[cardKey];
  if (!fields) return null;
  const patch: Record<string, unknown> = {};
  let changed = false;
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(defaultConfig, field)) continue;
    const currentValue = currentConfig[field];
    const defaultValue = defaultConfig[field];
    if (!shallowEqual(currentValue, defaultValue)) {
      patch[field] = cloneResetValue(defaultValue);
      changed = true;
    }
  }
  return changed ? patch : null;
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) => shallowEqual(left[key], right[key]));
  }
  return false;
}

function cloneResetValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneResetValue) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneResetValue(item)])) as T;
  }
  return value;
}
