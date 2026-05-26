import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const textSemanticsSource = readFileSync(new URL("../config-runtime/text-semantics.js", import.meta.url), "utf8");
const actionConfigSource = readFileSync(new URL("../config-runtime/action-config.js", import.meta.url), "utf8");
const publicConfigSource = readFileSync(new URL("../config.js", import.meta.url), "utf8");

beforeAll(async () => {
  globalThis.window = {
    CursorDanceDefaultConfig: {},
    CursorDanceConfigRuntime: {},
    CursorDanceConfigHelpers: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    location: {
      hostname: "example.com",
    },
  };
  new Function(textSemanticsSource)();
  new Function(actionConfigSource)();
  new Function(publicConfigSource)();
  await import("./config-store.js");
});

function makeConfig(overrides = {}) {
  return {
    enabled: true,
    activeSchemeId: "woodfish",
    schemes: [
      { id: "woodfish", name: "木鱼" },
      { id: "petal", name: "花瓣" },
    ],
    themePacks: [
      { id: "woodfish", name: "木鱼" },
      { id: "petal", name: "花瓣" },
    ],
    siteRules: { byHost: {} },
    performance: { maxActiveEffects: 48 },
    ...overrides,
  };
}

describe("getActiveScheme with site rules", () => {
  let configStore;

  beforeAll(() => {
    configStore = globalThis.window.CursorDanceContentModules.createConfigStore({
      window: globalThis.window,
      defaultConfig: globalThis.window.CursorDanceDefaultConfig,
      runtimeConfig: globalThis.window.CursorDanceConfigRuntime,
      constants: {
        INTERACTIVE_SELECTOR: "a,button",
        TEXT_EDITABLE_SELECTOR: "input",
        CONFIG_STORAGE_KEY: "cursordance.config",
        LEGACY_ENABLED_STORAGE_KEY: "cursordance.enabled",
        CURSOR_ASSET_STORAGE_KEY_PREFIX: "cursordance.cursorAsset.",
      },
      state: { config: null },
    });
  });

  it("returns site rule themePackId when mode is enabled", () => {
    const config = makeConfig({
      siteRules: { byHost: { "example.com": { mode: "enabled", themePackId: "petal" } } },
    });
    configStore.setConfig(config);

    const scheme = configStore.getActiveScheme();
    expect(scheme.id).toBe("petal");
  });

  it("falls back to global activeSchemeId when mode is inherit", () => {
    const config = makeConfig({
      siteRules: { byHost: { "example.com": { mode: "inherit" } } },
    });
    configStore.setConfig(config);

    const scheme = configStore.getActiveScheme();
    expect(scheme.id).toBe("woodfish");
  });

  it("falls back to global when no site rule exists", () => {
    const config = makeConfig();
    configStore.setConfig(config);

    const scheme = configStore.getActiveScheme();
    expect(scheme.id).toBe("woodfish");
  });
});

describe("isCurrentSiteEnabled", () => {
  let configStore;

  beforeAll(() => {
    configStore = globalThis.window.CursorDanceContentModules.createConfigStore({
      window: globalThis.window,
      defaultConfig: globalThis.window.CursorDanceDefaultConfig,
      runtimeConfig: globalThis.window.CursorDanceConfigRuntime,
      constants: {
        INTERACTIVE_SELECTOR: "a,button",
        TEXT_EDITABLE_SELECTOR: "input",
        CONFIG_STORAGE_KEY: "cursordance.config",
        LEGACY_ENABLED_STORAGE_KEY: "cursordance.enabled",
        CURSOR_ASSET_STORAGE_KEY_PREFIX: "cursordance.cursorAsset.",
      },
      state: { config: null },
    });
  });

  it("returns true when site mode is enabled regardless of global", () => {
    const config = makeConfig({
      enabled: false,
      siteRules: { byHost: { "example.com": { mode: "enabled" } } },
    });
    configStore.setConfig(config);
    expect(configStore.isCurrentSiteEnabled()).toBe(true);
  });

  it("returns false when site mode is disabled regardless of global", () => {
    const config = makeConfig({
      enabled: true,
      siteRules: { byHost: { "example.com": { mode: "disabled" } } },
    });
    configStore.setConfig(config);
    expect(configStore.isCurrentSiteEnabled()).toBe(false);
  });

  it("returns true when inherit and global enabled", () => {
    const config = makeConfig({
      enabled: true,
      siteRules: { byHost: {} },
    });
    configStore.setConfig(config);
    expect(configStore.isCurrentSiteEnabled()).toBe(true);
  });

  it("returns false when inherit and global disabled", () => {
    const config = makeConfig({
      enabled: false,
      siteRules: { byHost: {} },
    });
    configStore.setConfig(config);
    expect(configStore.isCurrentSiteEnabled()).toBe(false);
  });
});
