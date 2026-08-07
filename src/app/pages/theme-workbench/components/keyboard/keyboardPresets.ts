import type { KeyFeedbackConfig } from "@/shared/config/key-feedback";

export interface KeyboardPreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly patch: Partial<KeyFeedbackConfig>;
  readonly more?: boolean;
}

export const KEYBOARD_PRESETS: readonly KeyboardPreset[] = [
  { id: "keycap", name: "键帽弹跳", description: "从下方弹起", patch: { animationStyle: "bounce", originEdge: "bottom", originMapping: "keyboardLayout", bounceHeight: 140, globalOffsetY: 0.08, fontSize: 48, duration: 900, color: "#F59E0B", colorMode: "solid", gradient: false, trail: false, glow: false } },
  { id: "rain", name: "雨滴坠落", description: "从顶部落下", patch: { animationStyle: "raindrop", originEdge: "top", originMapping: "keyboardLayout", gravity: 0.5, wind: 0, fontSize: 44, duration: 1100, color: "#0EA5E9", colorMode: "solid", gradient: false, trail: false, glow: false } },
  { id: "slide", name: "侧边滑入", description: "从左侧推入", patch: { animationStyle: "bounce", originEdge: "left", originMapping: "center", globalOffsetX: 0.12, globalOffsetY: 0.82, bounceHeight: 90, fontSize: 36, duration: 800, color: "#0D9488", colorMode: "solid", gradient: false, trail: false, glow: false } },
  { id: "flash", name: "中央闪现", description: "大字快闪", patch: { animationStyle: "bounce", originEdge: "bottom", originMapping: "center", globalOffsetX: 0.5, globalOffsetY: 0.42, bounceHeight: 40, fontSize: 76, duration: 460, color: "#F43F5E", colorMode: "solid", gradient: false, trail: false, glow: true, glowRadius: 14, glowColor: "#FDA4AF" } },
  { id: "rainbow", name: "彩虹键盘", description: "按键位换色", more: true, patch: { animationStyle: "bounce", originEdge: "bottom", originMapping: "keyboardLayout", bounceHeight: 140, globalOffsetY: 0.08, fontSize: 52, duration: 900, color: "#0EA5E9", colorMode: "byKey", hueSpread: 300, gradient: false, trail: false, glow: false } },
  { id: "meteor", name: "流星", description: "带残影坠落", more: true, patch: { animationStyle: "raindrop", originEdge: "top", originMapping: "keyboardLayout", gravity: 0.8, wind: 0.2, fontSize: 40, duration: 1200, color: "#8B5CF6", colorMode: "solid", gradient: false, trail: true, trailLength: 4, glow: true, glowRadius: 10, glowColor: "#C4B5FD" } },
  { id: "neon", name: "霓虹", description: "渐变 + 发光", more: true, patch: { animationStyle: "bounce", originEdge: "bottom", originMapping: "center", globalOffsetX: 0.5, globalOffsetY: 0.35, bounceHeight: 60, fontSize: 68, duration: 700, color: "#0EA5E9", gradientTo: "#F43F5E", colorMode: "solid", gradient: true, trail: false, glow: true, glowRadius: 16, glowColor: "#7DD3FC" } },
  { id: "pulse", name: "节奏脉冲", description: "越快越偏色", more: true, patch: { animationStyle: "bounce", originEdge: "bottom", originMapping: "keyboardLayout", bounceHeight: 110, globalOffsetY: 0.12, fontSize: 48, duration: 620, color: "#0D9488", colorMode: "byRhythm", hueSpread: 220, gradient: false, trail: false, glow: false, typingCombo: true, comboGain: 140 } },
];

export function isKeyboardPresetActive(config: KeyFeedbackConfig, preset: KeyboardPreset): boolean {
  return Object.entries(preset.patch).every(([key, value]) => config[key as keyof KeyFeedbackConfig] === value);
}
