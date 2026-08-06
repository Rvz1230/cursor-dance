import { CARD_RESET_FIELDS } from "./cardResetFields";

export interface EffectPreset {
  name: string;
  patch: Record<string, unknown>;
}

export const EFFECT_PRESETS: Record<string, EffectPreset[]> = {
  text: [
    { name: "轻盈", patch: { fontSize: 22, textDuration: 700, textOffsetY: -24, textOpacity: 90, textEasing: "缓出" } },
    { name: "弹跳", patch: { fontSize: 28, textDuration: 1000, textOffsetY: -48, textOpacity: 100, textEasing: "弹跳" } },
    { name: "爆裂", patch: { fontSize: 40, textDuration: 760, textOffsetY: -64, textOpacity: 100, textOutlineWidth: 2 } },
    { name: "打字机", patch: { textKind: "文本飘字", fontSize: 20, textDuration: 1200, textOffsetY: -12, textOpacity: 100 } },
  ],
  animation: [
    { name: "脉冲", patch: { animationStyle: "聚焦脉冲", animationScale: 120, animationDuration: 720 } },
    { name: "抖动", patch: { animationStyle: "斜切闪片", animationScale: 104, animationDuration: 520 } },
    { name: "缩放", patch: { animationStyle: "弹跳徽记", animationScale: 150, animationDuration: 820 } },
  ],
  image: [
    { name: "原样", patch: { imageSize: 48, imageDuration: 780, imageOpacity: 100 } },
    { name: "旋入", patch: { imageSize: 56, imageDuration: 960, imageOpacity: 92 } },
    { name: "弹入", patch: { imageSize: 64, imageDuration: 720, imageOpacity: 100 } },
  ],
  particle: [
    { name: "礼花", patch: { particleStyle: "点状粒子", particleCount: 14, particleSpread: 90, particleSize: 8, particleGravity: 3 } },
    { name: "火花", patch: { particleStyle: "火花", particleCount: 28, particleSpread: 90, particleSize: 6, particleGravity: 1 } },
    { name: "尘埃", patch: { particleStyle: "碎屑粒子", particleCount: 18, particleSpread: 72, particleSize: 6, particleGravity: 6 } },
    { name: "气泡", patch: { particleStyle: "点状粒子", particleCount: 22, particleSpread: 80, particleSize: 12, particleGravity: 0 } },
  ],
  ripple: [
    { name: "涟漪", patch: { rippleStyle: "单环", rippleSize: 96, rippleLineWidth: 2, rippleOpacity: 100 } },
    { name: "脉冲", patch: { rippleStyle: "脉冲波纹", rippleSize: 84, rippleLineWidth: 3, rippleOpacity: 100 } },
    { name: "回声", patch: { rippleStyle: "回声环", rippleSize: 110, rippleLineWidth: 1, rippleOpacity: 70 } },
  ],
  audio: [
    { name: "清脆", patch: { soundFile: "chime-bright.wav", volume: 70, playbackRate: 108 } },
    { name: "低沉", patch: { soundFile: "woodfish-deep.wav", volume: 55, playbackRate: 88 } },
    { name: "水滴", patch: { soundFile: "pop-soft.wav", volume: 80, playbackRate: 100 } },
  ],
  cursor: [
    { name: "跟随状态", patch: { cursorOverride: "跟随当前状态", cursorSize: 48, shake: 0 } },
    { name: "按下缩小", patch: { cursorOverride: "木鱼（按压态）", cursorSize: 42, shake: 24 } },
    { name: "按下高亮", patch: { cursorOverride: "木鱼（增强态）", cursorSize: 54, shake: 36 } },
  ],
};

export function getEnabledEffectCount(config: Record<string, unknown> | null | undefined): number {
  if (!config) return 0;
  return [
    config.textEnabled,
    config.animationEnabled,
    config.imageEnabled,
    config.particle,
    config.ripple,
    config.sound,
    config.cursorOverride && config.cursorOverride !== "跟随当前状态",
  ].filter(Boolean).length;
}

export function getCardChangedCount(
  cardKey: string,
  config: Record<string, unknown>,
  baseline: Record<string, unknown> = {},
): number {
  return (CARD_RESET_FIELDS[cardKey] || []).filter((field) => {
    if (!Object.prototype.hasOwnProperty.call(baseline, field)) return false;
    return !sameValue(config[field], baseline[field]);
  }).length;
}

export function getCardSettingCount(cardKey: string): number {
  return CARD_RESET_FIELDS[cardKey]?.length || 0;
}

export function findMatchingPreset(
  presets: EffectPreset[],
  config: Record<string, unknown>,
): EffectPreset | undefined {
  return presets.find((preset) => Object.entries(preset.patch).every(([key, value]) => sameValue(config[key], value)));
}

export function getCardTimeLabel(cardKey: string, config: Record<string, unknown>): string | null {
  const timing: Record<string, [string, string?]> = {
    text: ["textDelay", "textDuration"],
    animation: ["animationDelay", "animationDuration"],
    image: ["imageDelay", "imageDuration"],
    particle: ["particleDelay", "particleDuration"],
    ripple: ["rippleDelay", "rippleDuration"],
    audio: ["soundDelay"],
  };
  const fields = timing[cardKey];
  if (!fields) return null;
  const delay = Number(config[fields[0]] || 0);
  const duration = fields[1] ? Number(config[fields[1]] || 0) : 0;
  return duration > 0 ? `${delay}–${delay + duration}ms` : `${delay}ms`;
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }
  return false;
}
