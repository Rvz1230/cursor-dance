import { describe, expect, it, vi } from "vitest";
import { createContentConfigStore } from "./config-store";

function createFixture(configOverrides: Record<string, unknown> = {}) {
  const config = {
    schemaVersion: 4,
    enabled: true,
    activeThemeId: "drift",
    themes: [{
      id: "drift",
      actionConfigs: {
        leftClick: { textContent: "custom-left", textEnabled: true },
      },
      cursorBindings: {
        default: { mode: "override", actionId: "leftClick" },
      },
      cursorSkin: { states: {} },
    }],
    contextRules: [],
    performance: { maxActiveEffects: 48 },
    ...configOverrides,
  };
  const state = { config };
  const localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  const store = createContentConfigStore({
    window: {
      location: {
        hostname: "example.com",
        pathname: "/docs",
      },
      localStorage,
      setTimeout,
      clearTimeout,
    } as unknown as Window,
    defaultConfig: config as never,
    runtimeConfig: { normalizeConfig: (value) => value as never },
    constants: {
      CONFIG_STORAGE_KEY: "cursordance.config",
      LIVE_PREVIEW_CONFIG_STORAGE_KEY: "cursordance.livePreviewConfig",
      INTERACTIVE_SELECTOR: "a,button",
      TEXT_EDITABLE_SELECTOR: "input,textarea",
    },
    state: state as never,
  });
  return { config, state, store };
}

describe("extension config store", () => {
  it("uses the shared theme defaults without leaking left-click fields", () => {
    const { store } = createFixture();
    const theme = store.getActiveScheme();

    expect(store.getActionConfig(theme, "leftClick")).toMatchObject({
      textContent: "custom-left",
      particleMotionMode: "orbital",
    });
    expect(store.getActionConfig(theme, "rightClick")).toMatchObject({
      textContent: "menu",
      particleCount: 8,
    });
  });

  it("applies the first matching v4 web rule", () => {
    const { store } = createFixture({
      contextRules: [{
        id: "disable-docs",
        context: "web",
        enabled: true,
        match: { type: "exact", host: "example.com", path: "/docs" },
        action: { type: "disable" },
      }],
    });

    expect(store.isCurrentSiteEnabled()).toBe(false);
  });

  it("cancels pending debounced synchronization when destroyed", async () => {
    vi.useFakeTimers();
    try {
      const { store } = createFixture();
      const clearStateCursorOverlay = vi.fn();

      store.debouncedSyncConfigFromStorage({ clearStateCursorOverlay });
      store.destroy();
      await vi.advanceTimersByTimeAsync(100);

      expect(clearStateCursorOverlay).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
