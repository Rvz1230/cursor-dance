import { normalizeCursorTrailConfig, type CursorTrailConfig } from "./cursor-trail";

export const CURSOR_TRAIL_RECIPE_FORMAT = "cursordance-cursor-trail" as const;
export const CURSOR_TRAIL_RECIPE_VERSION = 1 as const;

export interface CursorTrailRecipe {
  readonly format: typeof CURSOR_TRAIL_RECIPE_FORMAT;
  readonly version: typeof CURSOR_TRAIL_RECIPE_VERSION;
  readonly exportedAt: string;
  readonly trail: CursorTrailConfig;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function buildCursorTrailRecipe(value: unknown, exportedAt = new Date().toISOString()): CursorTrailRecipe {
  return {
    format: CURSOR_TRAIL_RECIPE_FORMAT,
    version: CURSOR_TRAIL_RECIPE_VERSION,
    exportedAt,
    trail: normalizeCursorTrailConfig(value),
  };
}

export function serializeCursorTrailRecipe(value: unknown): string {
  return `${JSON.stringify(buildCursorTrailRecipe(value), null, 2)}\n`;
}

export function parseCursorTrailRecipe(value: string | unknown): CursorTrailConfig {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error("拖尾配方不是合法的 JSON。");
    }
  }
  if (!isRecord(parsed)
    || parsed.format !== CURSOR_TRAIL_RECIPE_FORMAT
    || parsed.version !== CURSOR_TRAIL_RECIPE_VERSION
    || !isRecord(parsed.trail)) {
    throw new Error("文件不是受支持的 CursorDance 拖尾配方。");
  }
  return normalizeCursorTrailConfig(parsed.trail);
}
