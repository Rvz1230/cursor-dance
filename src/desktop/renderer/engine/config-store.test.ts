import { describe, expect, it, vi } from "vitest";

import type { CursorDanceConfigV4 } from "../../../shared/config-schema-v4";
import type { ActiveAppInfo } from "../../../shared/app-rules";
import { createConfigStore, type ConfigStoreAdapter } from "./config-store";
import { defaultConfig } from "./default-config";
import type { EngineState } from "./types";

function createStore(
  config: unknown = defaultConfig,
  options: {
    getActiveAppInfo?: () => ActiveAppInfo | null;
    storeAdapter?: ConfigStoreAdapter;
  } = {},
) {
  const state: EngineState = { activeEffects: 0 };
  const store = createConfigStore({
    window: { location: { hostname: "localhost" } } as Window,
    state,
    constants: {
      CONFIG_STORAGE_KEY: "cursordance.config",
      INTERACTIVE_SELECTOR: "a,button",
      TEXT_EDITABLE_SELECTOR: "input,textarea",
    },
    getActiveAppInfo: options.getActiveAppInfo,
    storeAdapter: options.storeAdapter,
  });
  store.setConfig(config);
  return store;
}

function replaceTheme(
  themeId: string,
  update: (theme: CursorDanceConfigV4["themes"][number]) => CursorDanceConfigV4["themes"][number],
): CursorDanceConfigV4["themes"] {
  return defaultConfig.themes.map((theme) => theme.id === themeId ? update(theme) : theme);
}

describe("config-store schema v4", () => {
  it("reads action, cursor and keyboard settings from the active theme", () => {
    const themes = replaceTheme("drift", (theme) => ({
      ...theme,
      actionConfigs: {
        ...theme.actionConfigs,
        leftClick: { ...theme.actionConfigs.leftClick, textContent: "v4-only" },
      },
      cursorBindings: {
        ...theme.cursorBindings,
        pointer: { mode: "override", actionId: "rightClick" },
      },
      keyFeedbackConfig: { ...theme.keyFeedbackConfig, color: "#22CCDD", fontSize: 72 },
    }));
    const store = createStore({ ...defaultConfig, activeThemeId: "drift", themes });

    expect(store.getActiveScheme().id).toBe("drift");
    expect(store.getActionConfig(store.getActiveScheme(), "leftClick")?.textContent).toBe("v4-only");
    expect(store.getCursorStateBinding(store.getActiveScheme(), "pointer", "leftClick")).toMatchObject({
      actionId: "rightClick",
      inheritedFromDefault: false,
    });
    expect(store.getKeyFeedbackConfig()).toMatchObject({ color: "#22CCDD", fontSize: 72 });
  });

  it("applies the first matching desktop context rule", () => {
    const activeApp = { processName: "Code", title: "README — Project Alpha" };
    const store = createStore({
      ...defaultConfig,
      contextRules: [{
        id: "project-theme",
        context: "desktop",
        enabled: true,
        match: { type: "glob", target: "title", value: "*Project Alpha*" },
        action: { type: "enable", themeId: "drift" },
      }],
    }, { getActiveAppInfo: () => activeApp });

    expect(store.isCurrentSiteEnabled()).toBe(true);
    expect(store.getActiveScheme().id).toBe("drift");
  });

  it("disables effects for a matching desktop context rule", () => {
    let activeApp: ActiveAppInfo | null = { processName: "Code", title: "README" };
    const store = createStore({
      ...defaultConfig,
      contextRules: [{
        id: "disable-code",
        context: "desktop",
        enabled: true,
        match: { type: "exact", target: "process", value: "Code" },
        action: { type: "disable" },
      }],
    }, { getActiveAppInfo: () => activeApp });

    expect(store.isCurrentSiteEnabled()).toBe(false);
    activeApp = null;
    expect(store.isCurrentSiteEnabled()).toBe(true);
  });

  it("accepts valid stored v4 without writing it back", async () => {
    const stored = { ...defaultConfig, enabled: false };
    const adapter: ConfigStoreAdapter = {
      get: vi.fn().mockResolvedValue({ "cursordance.config": stored }),
      set: vi.fn().mockResolvedValue(undefined),
    };
    const store = createStore(defaultConfig, { storeAdapter: adapter });

    await store.syncConfigFromStorage({ clearStateCursorOverlay: vi.fn() });

    expect(store.getConfig()).toBe(stored);
    expect(adapter.set).not.toHaveBeenCalled();
  });

  it("resets and persists non-v4 stored data", async () => {
    const adapter: ConfigStoreAdapter = {
      get: vi.fn().mockResolvedValue({ "cursordance.config": { schemaVersion: 3 } }),
      set: vi.fn().mockResolvedValue(undefined),
    };
    const store = createStore(defaultConfig, { storeAdapter: adapter });

    await store.syncConfigFromStorage({ clearStateCursorOverlay: vi.fn() });

    expect(store.getConfig()).toBe(defaultConfig);
    expect(adapter.set).toHaveBeenCalledWith({ "cursordance.config": defaultConfig });
  });
});
