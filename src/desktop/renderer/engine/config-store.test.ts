import { describe, expect, it } from "vitest";

import { createConfigStore } from "./config-store";
import { defaultConfig } from "./default-config";
import { defaultKeyFeedbackConfig } from "./key-feedback-types";
import type { EngineState } from "./types";

function createStore(config: unknown) {
  const state: EngineState = { activeEffects: 0 };
  const store = createConfigStore({
    window: { location: { hostname: "localhost" } } as Window,
    state,
    constants: {
      CONFIG_STORAGE_KEY: "cursordance.config",
      LEGACY_ENABLED_STORAGE_KEY: "cursordance.enabled",
      LIVE_PREVIEW_CONFIG_STORAGE_KEY: "cursordance.livePreviewConfig",
      CURSOR_ASSET_STORAGE_KEY_PREFIX: "cursordance.cursorAsset.",
      INTERACTIVE_SELECTOR: "",
      TEXT_EDITABLE_SELECTOR: "",
    },
  });
  store.setConfig(config);
  return store;
}

function withKeyFeedback(themeId: string, keyFeedbackConfig: Record<string, unknown>) {
  return defaultConfig.themePacks.map((pack) => pack.id === themeId
    ? {
        ...pack,
        workbenchDraft: {
          ...(pack.workbenchDraft || {}),
          keyFeedbackConfig,
        },
      }
    : pack);
}

describe("config-store keyFeedbackConfig", () => {
  it("优先读取当前 active theme 的键盘动效配置", () => {
    const themePacks = withKeyFeedback("mono-geo", { color: "#00FFAA", fontSize: 72 });
    const store = createStore({
      ...defaultConfig,
      activeThemePackId: "mono-geo",
      activeSchemeId: "mono-geo",
      themePacks,
      schemes: themePacks,
      keyFeedbackConfig: { ...defaultKeyFeedbackConfig, color: "#FF0000", fontSize: 32 },
    });

    expect(store.getKeyFeedbackConfig().color).toBe("#00FFAA");
    expect(store.getKeyFeedbackConfig().fontSize).toBe(72);
  });

  it("主题字段缺失时 fallback 到 legacy 顶层配置", () => {
    const themePacks = defaultConfig.themePacks.map((pack) => ({
      ...pack,
      workbenchDraft: {
        ...(pack.workbenchDraft || {}),
        keyFeedbackConfig: undefined,
      },
    }));
    const store = createStore({
      ...defaultConfig,
      activeThemePackId: "mono-geo",
      activeSchemeId: "mono-geo",
      themePacks,
      schemes: themePacks,
      keyFeedbackConfig: { ...defaultKeyFeedbackConfig, color: "#FF0000", fontSize: 32 },
    });

    expect(store.getKeyFeedbackConfig().color).toBe("#FF0000");
    expect(store.getKeyFeedbackConfig().fontSize).toBe(32);
  });

  it("主题字段和 legacy 字段都缺失时 fallback 到默认键盘配置", () => {
    const themePacks = defaultConfig.themePacks.map((pack) => ({
      ...pack,
      workbenchDraft: {
        ...(pack.workbenchDraft || {}),
        keyFeedbackConfig: undefined,
      },
    }));
    const store = createStore({
      ...defaultConfig,
      activeThemePackId: "mono-geo",
      activeSchemeId: "mono-geo",
      themePacks,
      schemes: themePacks,
      keyFeedbackConfig: undefined,
    });

    expect(store.getKeyFeedbackConfig().color).toBe(defaultKeyFeedbackConfig.color);
    expect(store.getKeyFeedbackConfig().fontSize).toBe(defaultKeyFeedbackConfig.fontSize);
  });

  it("activeSchemeId 切换时读取对应主题的键盘动效配置", () => {
    const themePacks = defaultConfig.themePacks.map((pack) => {
      if (pack.id === "mono-geo") {
        return { ...pack, workbenchDraft: { ...(pack.workbenchDraft || {}), keyFeedbackConfig: { color: "#111111" } } };
      }
      if (pack.id === "drift") {
        return { ...pack, workbenchDraft: { ...(pack.workbenchDraft || {}), keyFeedbackConfig: { color: "#22CCDD" } } };
      }
      return pack;
    });
    const store = createStore({
      ...defaultConfig,
      activeThemePackId: "drift",
      activeSchemeId: "drift",
      themePacks,
      schemes: themePacks,
    });

    expect(store.getKeyFeedbackConfig().color).toBe("#22CCDD");
  });
});
