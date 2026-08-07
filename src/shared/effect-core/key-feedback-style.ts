import type { KeyFeedbackConfig } from "../config/key-feedback";

export type KeySemanticKind = "character" | "shortcut" | "modifier" | "special";

const SEMANTIC_HUE_POSITION: Record<KeySemanticKind, number> = {
  character: 0,
  shortcut: 0.5,
  modifier: -0.35,
  special: 0.25,
};

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!match) return null;
  const [r, g, b] = match.slice(1).map((value) => Number.parseInt(value, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (!delta) return { h: 0, s: 0, l: lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  const hue = max === r
    ? (g - b) / delta + (g < b ? 6 : 0)
    : max === g
      ? (b - r) / delta + 2
      : (r - g) / delta + 4;
  return { h: hue * 60, s: saturation, l: lightness };
}

function hslToHex({ h, s, l }: { h: number; s: number; l: number }): string {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const segment = (((h % 360) + 360) % 360) / 60;
  const second = chroma * (1 - Math.abs((segment % 2) - 1));
  const channels = [
    [chroma, second, 0], [second, chroma, 0], [0, chroma, second],
    [0, second, chroma], [second, 0, chroma], [chroma, 0, second],
  ][Math.floor(segment) % 6];
  const offset = l - chroma / 2;
  return `#${channels.map((value) => Math.round((value + offset) * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export function getHueShiftUnavailableReason(hex: string): string | null {
  const hsl = hexToHsl(hex);
  if (!hsl) return "颜色格式无效";
  if (hsl.s < 0.15) return "灰阶颜色没有可辨识的色相";
  if (hsl.l < 0.18) return "颜色太暗，色相变化不明显";
  if (hsl.l > 0.92) return "颜色太亮，色相变化不明显";
  return null;
}

export function shiftKeyFeedbackHue(hex: string, degrees: number): string {
  const hsl = hexToHsl(hex);
  if (!hsl || getHueShiftUnavailableReason(hex)) return hex;
  return hslToHex({ ...hsl, h: hsl.h + degrees });
}

export function resolveKeyFeedbackColor(
  config: KeyFeedbackConfig,
  input: { layoutX: number; kind: KeySemanticKind; comboLevel: number },
): string {
  if (config.colorMode === "solid") return config.color;
  if (config.colorMode === "byKey") return shiftKeyFeedbackHue(config.color, (input.layoutX - 0.5) * config.hueSpread);
  if (config.colorMode === "byRhythm") return shiftKeyFeedbackHue(config.color, (Math.min(input.comboLevel, 5) / 5) * config.hueSpread);
  return shiftKeyFeedbackHue(config.color, SEMANTIC_HUE_POSITION[input.kind] * config.hueSpread);
}

function semanticIntensity(config: KeyFeedbackConfig, kind: KeySemanticKind): number {
  if (kind === "shortcut") return config.semShortcut;
  if (kind === "modifier") return config.semModifier;
  if (kind === "special") return config.semSpecial;
  return 1;
}

export function deriveKeyFeedbackConfig(
  config: KeyFeedbackConfig,
  context: { kind: KeySemanticKind; comboLevel: number },
): KeyFeedbackConfig {
  let next = { ...config };
  if (config.semanticStyles && context.kind !== "character") {
    const intensity = semanticIntensity(config, context.kind);
    const interpolate = (target: number) => 1 + (target - 1) * intensity;
    if (context.kind === "shortcut") {
      next = {
        ...next,
        anchor: config.anchor === "caret" ? "window" : config.anchor,
        originMapping: "center",
        globalOffsetX: 0.5,
        globalOffsetY: 0.5,
        fontSize: config.fontSize * interpolate(1.18),
        duration: Math.round(config.duration * interpolate(0.72)),
        opacity: Math.min(100, config.opacity + 8 * intensity),
      };
    } else if (context.kind === "modifier") {
      next = {
        ...next,
        fontSize: config.fontSize * interpolate(0.72),
        duration: Math.round(config.duration * interpolate(0.55)),
        opacity: intensity > 0 ? Math.max(45, Math.round(config.opacity * interpolate(0.72))) : config.opacity,
      };
    } else {
      next = {
        ...next,
        fontSize: config.fontSize * interpolate(1.08),
        duration: Math.round(config.duration * interpolate(0.82)),
        opacity: Math.min(100, config.opacity + 4 * intensity),
      };
    }
  }

  if (config.typingCombo && context.kind === "character" && context.comboLevel > 0) {
    const level = Math.min(context.comboLevel, 5);
    const gain = config.comboGain / 100;
    next = {
      ...next,
      scale: config.comboScale ? next.scale * (1 + level * 0.035 * gain) : next.scale,
      opacity: config.comboOpacity ? Math.min(100, next.opacity + level * 2 * gain) : next.opacity,
      glow: config.comboGlow && level >= 3 ? true : next.glow,
      glowRadius: config.comboGlow && level >= 3 ? Math.max(next.glowRadius, 6 + level * 2 * gain) : next.glowRadius,
    };
  }
  return next;
}
