import { beforeEach, describe, expect, it } from "vitest";

import { defaultConfig, normalizeConfig } from "@/desktop/renderer/engine/default-config";
import { validateCursorDanceConfigV4 } from "@/shared/config-schema-v4";
import {
  buildPreviewThemePackFromWorkbench,
  buildStoredConfigFromWorkbench,
  buildStoredThemePackFromWorkbench,
  hydrateWorkbenchState,
} from "./themeDraftAdapter";

function installRuntime() {
  globalThis.window = {
    CursorDanceDefaultConfig: defaultConfig,
    CursorDanceConfigRuntime: { normalizeConfig },
    CursorDanceConfigHelpers: {},
  } as unknown as Window & typeof globalThis;
}

function hydrate(config: unknown = defaultConfig) {
  return hydrateWorkbenchState(config, { host: "example.com" });
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

    expect(state.selection.themeId).toBe(theme.id);
    expect(state.draftsByTheme[theme.id].actionConfigs.leftClick.textContent).toBe("已保存");
    expect(state.draftsByTheme[theme.id].keyFeedbackConfig.color).toBe("#00FFAA");
    expect(state.draftsByTheme[theme.id].cursorSkin).toEqual(theme.cursorSkin);
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

    expect(state.siteRules).toEqual([{
      id: "web-docs",
      enabled: true,
      pattern: { type: "path", hostType: "glob", value: "*.example.com/docs" },
      action: { enable: true, theme: "drift" },
    }]);
    expect(state.appRules).toEqual([{
      id: "desktop-code",
      enabled: true,
      pattern: { type: "exact", target: "process", value: "Code" },
      action: "disable",
    }]);
  });

  it("persists only canonical v4 root and theme fields", () => {
    const state = hydrate();
    state.ui.enabled = false;
    state.selection.themeId = "drift";
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

  it("round-trips web and desktop rules through contextRules", () => {
    const state = hydrate();
    state.siteRules = [{
      id: "web-rule",
      enabled: true,
      pattern: { type: "path", hostType: "glob", value: "*.example.com/docs" },
      action: { enable: true, theme: "sunset" },
    }];
    state.appRules = [{
      id: "app-rule",
      enabled: true,
      pattern: { type: "exact", target: "title", value: "Focus" },
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
        enabled: true,
        match: { type: "exact", target: "title", value: "Focus" },
        action: { type: "disable" },
      },
    ]);
    const rehydrated = hydrate(stored);
    expect(rehydrated.siteRules).toEqual(state.siteRules);
    expect(rehydrated.appRules).toEqual(state.appRules);
  });

  it("builds preview and stored themes without editor-only fields", () => {
    const state = hydrate();
    state.draftsByTheme[state.selection.themeId].actionConfigs.leftClick.textContent = "预览";
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
    const draft = state.draftsByTheme[state.selection.themeId];
    draft.cursorModes.pointer = "覆盖";
    draft.cursorStateActions.pointer = "rightClick";
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
          hotspot: { x: 8, y: 9 },
          size: { mode: "fixedBox", boxSize: 56 },
        },
      },
    };

    const stored = buildStoredConfigFromWorkbench(defaultConfig, state);
    expect(stored.themes[0].cursorBindings.pointer).toEqual({ mode: "override", actionId: "rightClick" });
    const rehydrated = hydrate(stored);
    const nextDraft = rehydrated.draftsByTheme[state.selection.themeId];
    expect(nextDraft.cursorModes.pointer).toBe("覆盖");
    expect(nextDraft.cursorStateAssets.pointer.imageDataUrl).toBe("data:image/png;base64,cursor");
  });
});
