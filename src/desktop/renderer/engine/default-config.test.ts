import { describe, expect, it } from "vitest";

import { validateCursorDanceConfigV4 } from "../../../shared/config-schema-v4";
import {
  createDefaultThemes,
  defaultConfig,
  needsConfigReset,
  normalizeConfig,
} from "./default-config";
import { defaultKeyFeedbackConfig } from "./key-feedback-types";

const DESKTOP_ACTION_IDS = ["leftClick", "rightClick", "doubleClick", "longPress", "wheel"] as const;
const BUILTIN_THEME_IDS = ["mono-geo", "drift", "molten", "sunset"] as const;

describe("defaultConfig schema v4", () => {
  it("is a complete valid v4 config", () => {
    expect(validateCursorDanceConfigV4(defaultConfig)).toEqual({ ok: true, value: defaultConfig });
    expect(defaultConfig.schemaVersion).toBe(4);
    expect(defaultConfig.activeThemeId).toBe("mono-geo");
    expect(defaultConfig.themes.map((theme) => theme.id)).toEqual(BUILTIN_THEME_IDS);
  });

  it("provides all desktop actions and theme-owned feedback settings", () => {
    for (const theme of defaultConfig.themes) {
      expect(Object.keys(theme.actionConfigs)).toEqual(expect.arrayContaining([...DESKTOP_ACTION_IDS]));
      for (const actionId of DESKTOP_ACTION_IDS) {
        const action = theme.actionConfigs[actionId];
        expect(action, `${theme.id} is missing ${actionId}`).toBeDefined();
        expect(
          action.textEnabled === true
            || action.particle === true
            || action.ripple === true
            || action.sound === true
            || action.animationEnabled === true
            || action.imageEnabled === true,
          `${theme.id}.${actionId} has no enabled output`,
        ).toBe(true);
      }
      expect(theme.cursorBindings.default).toEqual({ mode: "override", actionId: "leftClick" });
      expect(theme.cursorBindings.pointer).toEqual({ mode: "inherit", actionId: "leftClick" });
      expect(theme.cursorSkin).toEqual({ version: 1, enabled: true, transitionMs: 80, states: {} });
      expect(theme.keyFeedbackConfig).toEqual(defaultKeyFeedbackConfig);
    }
  });

  it("creates independent theme copies", () => {
    const first = createDefaultThemes();
    const second = createDefaultThemes();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);
    expect(first[0].actionConfigs).not.toBe(second[0].actionConfigs);
  });
});

describe("normalizeConfig v4-only", () => {
  it("accepts a complete v4 object without rewriting it", () => {
    const valid = { ...defaultConfig, enabled: false };
    expect(normalizeConfig(valid)).toBe(valid);
    expect(needsConfigReset(valid)).toBe(false);
  });

  it.each([
    ["legacy v3", { ...defaultConfig, schemaVersion: 3 }],
    ["missing field", { ...defaultConfig, performance: undefined }],
    ["unknown field", { ...defaultConfig, editor: {} }],
    ["invalid theme reference", { ...defaultConfig, activeThemeId: "missing" }],
  ])("resets %s as a whole", (_label, value) => {
    expect(normalizeConfig(value)).toBe(defaultConfig);
    expect(needsConfigReset(value)).toBe(true);
  });
});
