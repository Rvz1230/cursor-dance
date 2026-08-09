import { beforeEach, describe, expect, it } from "vitest";

import { defaultConfig } from "@/shared/config/default-config";
import { validateCursorDanceConfigV4 } from "@/shared/config-schema-v4";
import {
  buildPreviewThemePackFromWorkbench,
  buildStoredConfigFromWorkbench,
  buildStoredThemePackFromWorkbench,
  hydrateWorkbenchState,
} from "./themeDraftAdapter";

function installRuntime() {
  globalThis.window = {} as Window & typeof globalThis;
}

function hydrate(config: unknown = defaultConfig) {
  return hydrateWorkbenchState(config, { host: "example.com" });
}

function getTheme(state: ReturnType<typeof hydrateWorkbenchState>, themeId = state.domain.activeThemeId) {
  const theme = state.domain.themes.find((item) => item.meta.id === themeId);
  if (!theme) throw new Error(`Missing workbench theme: ${themeId}`);
  return theme;
}

describe("themeDraftAdapter schema v4", () => {
  beforeEach(installRuntime);

  it("hydrates themes and theme-owned runtime settings", () => {
    const theme = {
      ...defaultConfig.themes[0],
      actionConfigs: {
        ...defaultConfig.themes[0].actionConfigs,
        leftClick: { ...defaultConfig.themes[0].actionConfigs.leftClick, textContent: "已保存" },
      },
      keyFeedbackConfig: { ...defaultConfig.themes[0].keyFeedbackConfig, color: "#00FFAA" },
    };
    const state = hydrate({ ...defaultConfig, themes: [theme], activeThemeId: theme.id });

    expect(state.domain.activeThemeId).toBe(theme.id);
    expect(getTheme(state, theme.id).draft.actionConfigs.leftClick.textContent).toBe("已保存");
    expect(getTheme(state, theme.id).draft.keyFeedbackConfig.color).toBe("#00FFAA");
    expect(getTheme(state, theme.id).draft.cursorSkin).toEqual(theme.cursorSkin);
  });

  it("converts v4 context rules to the existing rule editor model", () => {
    const state = hydrate({
      ...defaultConfig,
      contextRules: [
        {
          id: "web-docs",
          context: "web",
          enabled: true,
          match: { type: "glob", host: "*.example.com", path: "/docs" },
          action: { type: "enable", themeId: "drift" },
        },
        {
          id: "desktop-code",
          context: "desktop",
          enabled: true,
          match: { type: "exact", target: "process", value: "Code" },
          action: { type: "disable" },
        },
      ],
    });

    expect(state.domain.siteRules).toEqual([{
      id: "web-docs",
      enabled: true,
      pattern: { type: "path", hostType: "glob", value: "*.example.com/docs" },
      action: { enable: true, theme: "drift" },
    }]);
    expect(state.domain.appRules).toEqual([{
      id: "desktop-code",
      enabled: true,
      pattern: { type: "exact", target: "process", value: "Code" },
      action: "disable",
    }]);
  });

  it("persists only canonical v4 root and theme fields", () => {
    const state = hydrate();
    state.domain.enabled = false;
    state.domain.activeThemeId = "drift";
    const stored = buildStoredConfigFromWorkbench(defaultConfig, state);

    expect(Object.keys(stored).sort()).toEqual([
      "activeThemeId", "contextRules", "enabled", "performance", "schemaVersion", "themes",
    ]);
    expect(Object.keys(stored.themes[0]).sort()).toEqual([
      "actionConfigs", "atmosphere", "cursorBindings", "cursorSkin", "description", "id", "keyFeedbackConfig", "kind", "name",
    ]);
    expect(stored.activeThemeId).toBe("drift");
    expect(stored.enabled).toBe(false);
    expect(validateCursorDanceConfigV4(stored).ok).toBe(true);
  });

  it("keeps the complete theme-level trail when saving and rehydrating", () => {
    const state = hydrate();
    const draft = getTheme(state).draft;
    draft.atmosphere = {
      ...draft.atmosphere,
      trail: {
        enabled: true,
        shape: "stardust",
        blendMode: "screen",
        quality: "balanced",
        randomSeed: 8128,
        clickColor: "#E0F2FE",
        clickDurationMs: 240,
        followCursorStateColor: true,
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
      },
    };

    const stored = buildStoredConfigFromWorkbench(defaultConfig, state);
    const storedTrail = stored.themes.find((theme) => theme.id === state.domain.activeThemeId)?.atmosphere?.trail;
    expect(storedTrail).toMatchObject({
      enabled: true,
      shape: "stardust",
      blendMode: "screen",
      quality: "balanced",
      randomSeed: 8128,
      clickColor: "#E0F2FE",
      clickDurationMs: 240,
      followCursorStateColor: true,
      turnResponse: 88,
      gestureResponse: 72,
    });
    const rehydrated = hydrate(stored);
    expect(getTheme(rehydrated).draft.atmosphere.trail).toEqual(storedTrail);
  });

  it("round-trips web and desktop rules through contextRules", () => {
    const state = hydrate();
    state.domain.siteRules = [{
      id: "web-rule",
      enabled: true,
      pattern: { type: "path", hostType: "glob", value: "*.example.com/docs" },
      action: { enable: true, theme: "sunset" },
    }];
    state.domain.appRules = [{
      id: "app-rule",
      kind: "application",
      enabled: true,
      preferredTheme: "drift",
      pattern: { type: "exact", target: "bundle", value: "com.example.Focus" },
      action: "disable",
    }];

    const stored = buildStoredConfigFromWorkbench(defaultConfig, state);
    expect(stored.contextRules).toEqual([
      {
        id: "web-rule",
        context: "web",
        enabled: true,
        match: { type: "glob", host: "*.example.com", path: "/docs" },
        action: { type: "enable", themeId: "sunset" },
      },
      {
        id: "app-rule",
        context: "desktop",
        kind: "application",
        enabled: true,
        preferredThemeId: "drift",
        match: { type: "exact", target: "bundle", value: "com.example.Focus" },
        action: { type: "disable" },
      },
    ]);
    const rehydrated = hydrate(stored);
    expect(rehydrated.domain.siteRules).toEqual(state.domain.siteRules);
    expect(rehydrated.domain.appRules).toEqual(state.domain.appRules);
  });

  it("builds preview and stored themes without editor-only fields", () => {
    const state = hydrate();
    getTheme(state).draft.actionConfigs.leftClick.textContent = "预览";
    const storedTheme = buildStoredThemePackFromWorkbench(defaultConfig, state);
    const previewTheme = buildPreviewThemePackFromWorkbench(defaultConfig, state);

    expect(previewTheme).toEqual(storedTheme);
    expect(storedTheme.actionConfigs.leftClick.textContent).toBe("预览");
    expect(storedTheme).not.toHaveProperty("workbenchDraft");
    expect(storedTheme).not.toHaveProperty("cursorStates");
    expect(storedTheme).not.toHaveProperty("resetActionConfigs");
  });

  it("keeps cursor bindings and inline skin images through a round trip", () => {
    const state = hydrate();
    const draft = getTheme(state).draft;
    draft.cursorBindings.pointer = { mode: "override", actionId: "rightClick" };
    draft.cursorSkin = {
      version: 1,
      enabled: true,
      transitionMs: 60,
      states: {
        pointer: {
          image: {
            kind: "dataUrl",
            mimeType: "image/png",
            dataUrl: "data:image/png;base64,cursor",
            width: 64,
            height: 64,
          },
          hotspot: { x: 8 / 64, y: 9 / 64 },
          size: { mode: "fixedBox", boxSize: 56 },
        },
      },
    };

    const stored = buildStoredConfigFromWorkbench(defaultConfig, state);
    expect(stored.themes[0].cursorBindings.pointer).toEqual({ mode: "override", actionId: "rightClick" });
    const rehydrated = hydrate(stored);
    const nextDraft = getTheme(rehydrated, state.domain.activeThemeId).draft;
    expect(nextDraft.cursorBindings.pointer).toEqual({ mode: "override", actionId: "rightClick" });
    expect(nextDraft.cursorSkin.states.pointer.image).toMatchObject({
      kind: "dataUrl",
      dataUrl: "data:image/png;base64,cursor",
    });
  });
});
