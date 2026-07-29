/** @platform shared-renderer — canonical schema v4 defaults and strict reader. */

import {
  CURSORDANCE_CONFIG_SCHEMA_VERSION,
  assertCursorDanceConfigV4,
  validateCursorDanceConfigV4,
  type CursorBindingV4,
  type CursorDanceConfigV4,
  type CursorDanceThemeV4,
  type CursorSkinV4,
} from "../../../shared/config-schema-v4";
import { defaultKeyFeedbackConfig } from "./key-feedback-types";
import { getDefaultThemeDefinitions } from "./data/default-theme-packs";

export type CursorDanceConfig = CursorDanceConfigV4;
export type ThemePack = CursorDanceThemeV4;

export const DEFAULT_CURSOR_STATE_IDS = [
  "default",
  "text",
  "pointer",
  "grab",
  "grabbing",
  "busy",
  "notAllowed",
  "crosshair",
  "move",
  "resizeHorizontal",
  "resizeVertical",
  "resizeDiagonalNWSE",
  "resizeDiagonalNESW",
] as const;

export function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createDefaultCursorBindings(): Record<string, CursorBindingV4> {
  return Object.fromEntries(DEFAULT_CURSOR_STATE_IDS.map((stateId) => [
    stateId,
    {
      mode: stateId === "default" ? "override" : "inherit",
      actionId: "leftClick",
    },
  ]));
}

export function createDefaultCursorSkin(): CursorSkinV4 {
  return {
    version: 1,
    enabled: true,
    transitionMs: 80,
    states: {},
  };
}

export function createDefaultThemes(): CursorDanceThemeV4[] {
  return getDefaultThemeDefinitions().map((definition) => ({
    ...cloneValue(definition),
    cursorBindings: createDefaultCursorBindings(),
    cursorSkin: createDefaultCursorSkin(),
    keyFeedbackConfig: cloneValue(defaultKeyFeedbackConfig),
  }));
}

export const defaultConfig: CursorDanceConfigV4 = {
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
  fallbackConfig: CursorDanceConfigV4 = defaultConfig,
): CursorDanceConfigV4 {
  assertCursorDanceConfigV4(fallbackConfig);
  const validation = validateCursorDanceConfigV4(value);
  return validation.ok ? validation.value : fallbackConfig;
}

export function needsConfigReset(value: unknown): boolean {
  return validateCursorDanceConfigV4(value).ok === false;
}
