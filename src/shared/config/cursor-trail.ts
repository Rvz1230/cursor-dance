/** @platform shared — theme-level continuous cursor trail configuration. */

import type { ConfigJsonObject } from "../config-schema-v4";

export type CursorTrailPresetId = "comet" | "stardust" | "pixel" | "echo";
type CursorTrailShape = "ribbon" | "stardust" | "pixel" | "echo";
export type CursorTrailSegmentId = "tail" | "middle" | "head";

type CursorTrailSegmentStyle = ConfigJsonObject & {
  readonly color: string;
  readonly width: number;
  readonly opacity: number;
};

export type CursorTrailSegments = ConfigJsonObject & Record<CursorTrailSegmentId, CursorTrailSegmentStyle>;

export type CursorTrailConfig = ConfigJsonObject & {
  readonly enabled: boolean;
  readonly shape: CursorTrailShape;
  readonly length: number;
  readonly width: number;
  readonly lifetimeMs: number;
  readonly smoothing: number;
  readonly opacity: number;
  readonly glow: number;
  readonly velocityResponse: number;
  readonly turnResponse: number;
  readonly gestureResponse: number;
  readonly colors: readonly [string, string];
  readonly segments: CursorTrailSegments;
};

export type AtmosphereConfig = ConfigJsonObject & {
  readonly mode?: string;
  readonly magnetRadius?: number;
  readonly magnetStrength?: number;
  readonly trail?: CursorTrailConfig;
};

export interface CursorTrailPreset {
  readonly id: CursorTrailPresetId;
  readonly label: string;
  readonly description: string;
  readonly config: CursorTrailConfig;
}

const DEFAULT_COLORS = ["#14B8A6", "#8B5CF6"] as const;

export const DEFAULT_CURSOR_TRAIL_SEGMENTS: CursorTrailSegments = Object.freeze({
  tail: Object.freeze({ color: "#14B8A6", width: 2.4, opacity: 24 }),
  middle: Object.freeze({ color: "#508ACE", width: 4.96, opacity: 52 }),
  head: Object.freeze({ color: "#8B5CF6", width: 8, opacity: 72 }),
});

export const DEFAULT_CURSOR_TRAIL_CONFIG: CursorTrailConfig = Object.freeze({
  enabled: false,
  shape: "ribbon",
  length: 24,
  width: 8,
  lifetimeMs: 320,
  smoothing: 68,
  opacity: 72,
  glow: 14,
  velocityResponse: 60,
  turnResponse: 36,
  gestureResponse: 55,
  colors: DEFAULT_COLORS,
  segments: DEFAULT_CURSOR_TRAIL_SEGMENTS,
});

export const CURSOR_TRAIL_PRESETS: readonly CursorTrailPreset[] = Object.freeze([
  {
    id: "comet",
    label: "彗星柔光",
    description: "顺滑的双色光带，适合日常使用。",
    config: DEFAULT_CURSOR_TRAIL_CONFIG,
  },
  {
    id: "stardust",
    label: "星尘",
    description: "沿移动路径散落细小光点。",
    config: {
      enabled: true,
      shape: "stardust",
      length: 32,
      width: 7,
      lifetimeMs: 520,
      smoothing: 42,
      opacity: 78,
      glow: 10,
      velocityResponse: 82,
      turnResponse: 88,
      gestureResponse: 72,
      colors: ["#F59E0B", "#FB7185"],
      segments: {
        tail: { color: "#F59E0B", width: 2.1, opacity: 27 },
        middle: { color: "#F88848", width: 4.34, opacity: 56 },
        head: { color: "#FB7185", width: 7, opacity: 78 },
      },
    },
  },
  {
    id: "pixel",
    label: "像素残影",
    description: "清晰的方块断点轨迹。",
    config: {
      enabled: true,
      shape: "pixel",
      length: 20,
      width: 9,
      lifetimeMs: 300,
      smoothing: 18,
      opacity: 84,
      glow: 0,
      velocityResponse: 36,
      turnResponse: 24,
      gestureResponse: 64,
      colors: ["#0EA5E9", "#6366F1"],
      segments: {
        tail: { color: "#0EA5E9", width: 2.7, opacity: 29 },
        middle: { color: "#3986ED", width: 5.58, opacity: 60 },
        head: { color: "#6366F1", width: 9, opacity: 84 },
      },
    },
  },
  {
    id: "echo",
    label: "光标残像",
    description: "留下逐渐缩小的指针剪影。",
    config: {
      enabled: true,
      shape: "echo",
      length: 14,
      width: 14,
      lifetimeMs: 420,
      smoothing: 55,
      opacity: 48,
      glow: 4,
      velocityResponse: 24,
      turnResponse: 18,
      gestureResponse: 92,
      colors: ["#0F172A", "#64748B"],
      segments: {
        tail: { color: "#0F172A", width: 4.2, opacity: 16 },
        middle: { color: "#3A465B", width: 8.68, opacity: 35 },
        head: { color: "#64748B", width: 14, opacity: 48 },
      },
    },
  },
]);

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function mixHexColor(from: string, to: string): string {
  const parse = (value: string) => /^#[\da-f]{6}$/i.test(value)
    ? [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16))
    : null;
  const a = parse(from);
  const b = parse(to);
  if (!a || !b) return from;
  return `#${a.map((channel, index) => Math.round((channel + b[index]) / 2).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function cloneSegments(segments: CursorTrailSegments): CursorTrailSegments {
  return {
    tail: { ...segments.tail },
    middle: { ...segments.middle },
    head: { ...segments.head },
  };
}

function normalizeSegment(
  value: unknown,
  fallback: CursorTrailSegmentStyle,
): CursorTrailSegmentStyle {
  const source = asRecord(value);
  return {
    color: normalizeColor(source.color, fallback.color),
    width: clampNumber(source.width, fallback.width, 1, 32),
    opacity: Math.round(clampNumber(source.opacity, fallback.opacity, 0, 100)),
  };
}

function isCursorTrailShape(value: unknown): value is CursorTrailShape {
  return value === "ribbon" || value === "stardust" || value === "pixel" || value === "echo";
}

function createDefaultCursorTrailConfig(): CursorTrailConfig {
  return {
    ...DEFAULT_CURSOR_TRAIL_CONFIG,
    colors: [...DEFAULT_CURSOR_TRAIL_CONFIG.colors],
    segments: cloneSegments(DEFAULT_CURSOR_TRAIL_SEGMENTS),
  };
}

export function createDefaultAtmosphereConfig(): AtmosphereConfig {
  return {
    mode: "none",
    trail: createDefaultCursorTrailConfig(),
  };
}

export function normalizeCursorTrailConfig(value: unknown): CursorTrailConfig {
  const source = asRecord(value);
  const sourceColors = Array.isArray(source.colors) ? source.colors : DEFAULT_COLORS;
  const colors: [string, string] = [
    normalizeColor(sourceColors[0], DEFAULT_COLORS[0]),
    normalizeColor(sourceColors[1], DEFAULT_COLORS[1]),
  ];
  const width = clampNumber(source.width, DEFAULT_CURSOR_TRAIL_CONFIG.width, 2, 24);
  const opacity = Math.round(clampNumber(source.opacity, DEFAULT_CURSOR_TRAIL_CONFIG.opacity, 10, 100));
  const legacySegments: CursorTrailSegments = {
    tail: { color: colors[0], width: Math.max(1, width * 0.3), opacity: Math.round(opacity * 0.34) },
    middle: { color: mixHexColor(colors[0], colors[1]), width: Math.max(1, width * 0.62), opacity: Math.round(opacity * 0.72) },
    head: { color: colors[1], width, opacity },
  };
  const sourceSegments = asRecord(source.segments);
  return {
    enabled: source.enabled === true,
    shape: isCursorTrailShape(source.shape) ? source.shape : DEFAULT_CURSOR_TRAIL_CONFIG.shape,
    length: Math.round(clampNumber(source.length, DEFAULT_CURSOR_TRAIL_CONFIG.length, 6, 48)),
    width,
    lifetimeMs: Math.round(clampNumber(source.lifetimeMs, DEFAULT_CURSOR_TRAIL_CONFIG.lifetimeMs, 120, 900)),
    smoothing: Math.round(clampNumber(source.smoothing, DEFAULT_CURSOR_TRAIL_CONFIG.smoothing, 0, 90)),
    opacity,
    glow: Math.round(clampNumber(source.glow, DEFAULT_CURSOR_TRAIL_CONFIG.glow, 0, 24)),
    velocityResponse: Math.round(clampNumber(source.velocityResponse, DEFAULT_CURSOR_TRAIL_CONFIG.velocityResponse, 0, 100)),
    turnResponse: Math.round(clampNumber(source.turnResponse, DEFAULT_CURSOR_TRAIL_CONFIG.turnResponse, 0, 100)),
    gestureResponse: Math.round(clampNumber(source.gestureResponse, DEFAULT_CURSOR_TRAIL_CONFIG.gestureResponse, 0, 100)),
    colors,
    segments: {
      tail: normalizeSegment(sourceSegments.tail, legacySegments.tail),
      middle: normalizeSegment(sourceSegments.middle, legacySegments.middle),
      head: normalizeSegment(sourceSegments.head, legacySegments.head),
    },
  };
}

export function getCursorTrailConfig(atmosphere: unknown): CursorTrailConfig {
  const source = atmosphere && typeof atmosphere === "object" && !Array.isArray(atmosphere)
    ? atmosphere as Record<string, unknown>
    : {};
  return normalizeCursorTrailConfig(source.trail);
}

function getCursorTrailPreset(id: CursorTrailPresetId): CursorTrailPreset {
  return CURSOR_TRAIL_PRESETS.find((preset) => preset.id === id) ?? CURSOR_TRAIL_PRESETS[0];
}

export function applyCursorTrailPreset(id: CursorTrailPresetId, enabled = true): CursorTrailConfig {
  const preset = getCursorTrailPreset(id);
  return {
    ...preset.config,
    enabled,
    colors: [...preset.config.colors],
    segments: cloneSegments(preset.config.segments),
  };
}

export function identifyCursorTrailPreset(value: unknown): CursorTrailPresetId | null {
  const config = normalizeCursorTrailConfig(value);
  const comparable = { ...config, enabled: true };
  const match = CURSOR_TRAIL_PRESETS.find((preset) => (
    JSON.stringify(comparable) === JSON.stringify({ ...preset.config, enabled: true })
  ));
  return match?.id ?? null;
}
