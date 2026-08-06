/** @platform shared-renderer — canonical schema v4 defaults and strict reader. */

import {
  CURSORDANCE_CONFIG_SCHEMA_VERSION,
  assertCursorDanceConfigV4,
  validateCursorDanceConfigV4,
} from "../config-schema-v4";
import {
  createCursorBindings,
  createCursorSkin,
  type CursorDanceConfig,
  type CursorDanceTheme,
} from "../domain/cursor-dance";
import { defaultKeyFeedbackConfig } from "./key-feedback";
import { CURSOR_STATE_IDS } from "../cursor-states";

export type { CursorDanceConfig };
export type ThemePack = CursorDanceTheme;

export function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createDefaultThemes(): CursorDanceTheme[] {
  return BUILTIN_THEME_METADATA.map((definition) => ({
    ...definition,
    actionConfigs: {},
    cursorBindings: createCursorBindings(CURSOR_STATE_IDS),
    cursorSkin: createCursorSkin(),
    keyFeedbackConfig: cloneValue(defaultKeyFeedbackConfig),
  }));
}

const BUILTIN_THEME_METADATA = [
  {
    id: "mono-geo",
    name: "几何",
    description: "黑白灰配色、方块粒子和几何波纹，极简克制的反馈风格。",
    kind: "builtin",
  },
  {
    id: "drift",
    name: "流光",
    description: "轨道粒子环绕光标、涟漪扩散，沉静青绿调，适合专注工作场景。",
    kind: "builtin",
  },
  {
    id: "molten",
    name: "熔金",
    description: "火花向上喷发如熔岩飞溅、能量脉冲涟漪，温暖有力的橙金调。",
    kind: "builtin",
  },
  {
    id: "sunset",
    name: "夕霞",
    description: "钻石粒子缓缓飘落、回声涟漪荡漾，落日粉橙暖调，温柔优雅。",
    kind: "builtin",
  },
] as const;

export const defaultConfig: CursorDanceConfig = {
  schemaVersion: CURSORDANCE_CONFIG_SCHEMA_VERSION,
  enabled: true,
  activeThemeId: "mono-geo",
  themes: createDefaultThemes(),
  contextRules: [],
  performance: {
    maxActiveEffects: 48,
  },
};

assertCursorDanceConfigV4(defaultConfig);

/**
 * Accept only a complete schema v4 object. Missing, malformed or non-v4 data
 * resets as one unit to a known-good default; no field merge or migration is
 * performed here.
 */
export function normalizeConfig(
  value: unknown,
  fallbackConfig: CursorDanceConfig = defaultConfig,
): CursorDanceConfig {
  assertCursorDanceConfigV4(fallbackConfig);
  const validation = validateCursorDanceConfigV4(value);
  return validation.ok ? validation.value : fallbackConfig;
}

export function needsConfigReset(value: unknown): boolean {
  return validateCursorDanceConfigV4(value).ok === false;
}
