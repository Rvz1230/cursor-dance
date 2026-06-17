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
    "cursorTrailEnabled",
    "cursorTrailCount",
    "cursorTrailOpacity",
    "cursorGlowColor",
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
      patch[field] = Array.isArray(defaultValue) ? [...defaultValue] : defaultValue;
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
  return false;
}
