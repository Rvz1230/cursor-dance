import { describe, expect, it } from "vitest";

import {
  assertCursorDanceConfigV4,
  CURSORDANCE_CONFIG_SCHEMA_VERSION,
  validateCursorDanceConfigV4,
} from "./config-schema-v4";

function createKeyFeedbackConfig() {
  return {
    enabled: true,
    animationStyle: "bounce",
    originEdge: "bottom",
    originMapping: "keyboardLayout",
    globalOffsetX: 0.5,
    globalOffsetY: 0.08,
    fontSize: 48,
    fontWeight: "加粗",
    fontFamily: "系统默认",
    color: "#F59E0B",
    opacity: 90,
    uppercase: false,
    showModifierKeys: true,
    keyDisplayMode: "typed",
    semanticStyles: true,
    typingCombo: true,
    duration: 900,
    easing: "弹跳",
    scale: 1,
    bounceHeight: 140,
    gravity: 0.3,
    wind: 0,
    glow: false,
    glowColor: "#FBBF24",
    glowRadius: 8,
    trail: false,
    trailLength: 3,
    splash: false,
    cooldownMs: 35,
    maxSimultaneous: 30,
    delay: 0,
  };
}

function createValidConfig() {
  return {
    schemaVersion: CURSORDANCE_CONFIG_SCHEMA_VERSION,
    enabled: true,
    activeThemeId: "mono-geo",
    themes: [{
      id: "mono-geo",
      name: "几何黑白",
      description: "测试主题",
      kind: "builtin",
      actionConfigs: {
        leftClick: { ripple: true, particleCount: 12, colors: ["#000000", "#ffffff"] },
      },
      cursorBindings: {
        default: { mode: "override", actionId: "leftClick" },
        pointer: { mode: "inherit", actionId: "leftClick" },
      },
      cursorSkin: {
        version: 1,
        enabled: true,
        transitionMs: 80,
        states: {
          default: {
            image: {
              kind: "dataUrl",
              mimeType: "image/png",
              dataUrl: "data:image/png;base64,AA==",
              width: 48,
              height: 48,
            },
            hotspot: { x: 8, y: 8 },
            size: { mode: "fixedBox", boxSize: 48 },
          },
          pointer: {
            image: {
              kind: "asset",
              assetId: "sha256:cursor-pointer",
              mimeType: "image/webp",
              width: 64,
              height: 64,
            },
            hotspot: { x: 4, y: 2 },
            size: { mode: "source" },
          },
        },
      },
      keyFeedbackConfig: createKeyFeedbackConfig(),
      atmosphere: { enabled: false, particles: [] },
    }],
    contextRules: [
      {
        id: "web-docs",
        context: "web",
        enabled: true,
        match: { type: "glob", host: "*.example.com", path: "/docs/*" },
        action: { type: "enable", themeId: "mono-geo" },
      },
      {
        id: "desktop-games",
        context: "desktop",
        enabled: true,
        match: { type: "glob", target: "process", value: "*Game*" },
        action: { type: "disable" },
      },
    ],
    performance: { maxActiveEffects: 48 },
  };
}

function issuePaths(value: unknown): string[] {
  const result = validateCursorDanceConfigV4(value);
  return result.ok === true ? [] : result.issues.map((issue) => issue.path);
}

describe("schema v4 contract", () => {
  it("accepts one canonical config with inline and stored cursor assets", () => {
    const config = createValidConfig();
    expect(validateCursorDanceConfigV4(config)).toEqual({ ok: true, value: config });
    expect(() => assertCursorDanceConfigV4(config)).not.toThrow();
  });

  it("rejects v3 aliases and editor-only state at the root", () => {
    const config = Object.assign(createValidConfig(), {
      activeThemePackId: "mono-geo",
      themePacks: [],
      schemes: [],
      siteRules: [],
      appRules: [],
      editor: { lastWorkspace: "states" },
      keyFeedbackConfig: createKeyFeedbackConfig(),
    });

    expect(issuePaths(config)).toEqual(expect.arrayContaining([
      "$.activeThemePackId",
      "$.themePacks",
      "$.schemes",
      "$.siteRules",
      "$.appRules",
      "$.editor",
      "$.keyFeedbackConfig",
    ]));
  });

  it("rejects workbench drafts, reset snapshots and duplicate cursor representations", () => {
    const config = createValidConfig();
    Object.assign(config.themes[0], {
      workbenchDraft: {},
      cursorStates: {},
      cursorStateAssets: {},
      resetActionConfigs: {},
      resetKeyFeedbackConfig: createKeyFeedbackConfig(),
    });

    expect(issuePaths(config)).toEqual(expect.arrayContaining([
      "themes[0].workbenchDraft",
      "themes[0].cursorStates",
      "themes[0].cursorStateAssets",
      "themes[0].resetActionConfigs",
      "themes[0].resetKeyFeedbackConfig",
    ]));
  });

  it("requires unique ids and valid theme references", () => {
    const config = createValidConfig();
    config.activeThemeId = "missing";
    config.themes.push(structuredClone(config.themes[0]));
    config.contextRules[0].action = { type: "enable", themeId: "missing" };
    config.contextRules.push(structuredClone(config.contextRules[0]));

    expect(issuePaths(config)).toEqual(expect.arrayContaining([
      "activeThemeId",
      "themes[1].id",
      "contextRules[0].action.themeId",
      "contextRules[2].id",
    ]));
  });

  it("keeps web and desktop match shapes discriminated", () => {
    const config = createValidConfig();
    config.contextRules[0] = {
      id: "broken-web",
      context: "web",
      enabled: true,
      match: { type: "glob", target: "process", value: "Safari" },
      action: { type: "disable" },
    } as unknown as typeof config.contextRules[number];
    config.contextRules[1] = {
      id: "broken-desktop",
      context: "desktop",
      enabled: true,
      match: { type: "glob", host: "example.com" },
      action: { type: "disable" },
    } as unknown as typeof config.contextRules[number];

    expect(issuePaths(config)).toEqual(expect.arrayContaining([
      "contextRules[0].match.target",
      "contextRules[0].match.value",
      "contextRules[0].match.host",
      "contextRules[1].match.host",
      "contextRules[1].match.target",
      "contextRules[1].match.value",
    ]));
  });

  it("rejects non-JSON action data and malformed asset references", () => {
    const config = createValidConfig();
    Object.assign(config.themes[0].actionConfigs.leftClick, { callback: () => undefined, count: Number.NaN });
    const defaultImage = config.themes[0].cursorSkin.states.default.image;
    Object.assign(defaultImage, { kind: "asset", assetId: "", dataUrl: undefined });

    expect(issuePaths(config)).toEqual(expect.arrayContaining([
      "themes[0].actionConfigs.leftClick",
      "themes[0].cursorSkin.states.default.image.assetId",
    ]));
    expect(() => assertCursorDanceConfigV4(config)).toThrow(/Invalid CursorDance schema v4 configuration/);
  });
});
