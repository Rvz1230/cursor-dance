import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const textSemanticsSource = readFileSync(new URL("./config-runtime/text-semantics.js", import.meta.url), "utf8");
const actionConfigSource = readFileSync(new URL("./config-runtime/action-config.js", import.meta.url), "utf8");
const publicConfigSource = readFileSync(new URL("./config.js", import.meta.url), "utf8");

beforeAll(() => {
  globalThis.window = {
    CursorDanceDefaultConfig: {},
    CursorDanceConfigRuntime: {},
    CursorDanceConfigHelpers: {},
  };
  new Function(textSemanticsSource)();
  new Function(actionConfigSource)();
  new Function(publicConfigSource)();
});

describe("extension config v4-only", () => {
  it("publishes a canonical v4 default without legacy aliases", () => {
    const config = globalThis.window.CursorDanceDefaultConfig;
    expect(config.schemaVersion).toBe(4);
    expect(config.activeThemeId).toBe("mono-geo");
    expect(config.themes).toHaveLength(4);
    expect(config.contextRules).toEqual([]);
    expect(config).not.toHaveProperty("themePacks");
    expect(config).not.toHaveProperty("schemes");
    expect(config).not.toHaveProperty("editor");
    for (const theme of config.themes) {
      expect(theme).not.toHaveProperty("workbenchDraft");
      expect(theme).not.toHaveProperty("cursorStates");
      expect(theme.cursorBindings.default).toEqual({ mode: "override", actionId: "leftClick" });
      expect(theme.keyFeedbackConfig.animationStyle).toBe("bounce");
    }
  });

  it("accepts a complete v4 config without rewriting it", () => {
    const config = { ...globalThis.window.CursorDanceDefaultConfig, enabled: false };
    expect(globalThis.window.CursorDanceConfigRuntime.normalizeConfig(config)).toBe(config);
  });

  it.each([
    ["legacy v3", () => ({ schemaVersion: 3, enabled: true, themePacks: [] })],
    ["missing fields", () => ({ schemaVersion: 4, enabled: true })],
    ["unknown root field", () => ({ ...globalThis.window.CursorDanceDefaultConfig, editor: {} })],
  ])("resets %s to the complete default", (_label, createValue) => {
    expect(globalThis.window.CursorDanceConfigRuntime.normalizeConfig(createValue()))
      .toBe(globalThis.window.CursorDanceDefaultConfig);
  });

  it("accepts v4 web context rules and rejects missing theme references", () => {
    const defaultConfig = globalThis.window.CursorDanceDefaultConfig;
    const rule = {
      id: "docs",
      context: "web",
      enabled: true,
      match: { type: "glob", host: "*.example.com", path: "/docs" },
      action: { type: "enable", themeId: "drift" },
    };
    const valid = { ...defaultConfig, contextRules: [rule] };
    expect(globalThis.window.CursorDanceConfigRuntime.normalizeConfig(valid)).toBe(valid);

    const invalid = { ...defaultConfig, contextRules: [{ ...rule, action: { type: "enable", themeId: "missing" } }] };
    expect(globalThis.window.CursorDanceConfigRuntime.normalizeConfig(invalid)).toBe(defaultConfig);
  });
});
