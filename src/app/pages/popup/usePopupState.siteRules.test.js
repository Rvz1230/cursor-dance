import { describe, expect, it, vi } from "vitest";
import {
  getEffectiveActiveThemeId,
  resolveNextConfigForThemeChange,
} from "./usePopupState.js";

describe("getEffectiveActiveThemeId", () => {
  it("returns themePackId when mode is enabled and themePackId is set", () => {
    const result = getEffectiveActiveThemeId(
      { mode: "enabled", themePackId: "petal" },
      "woodfish"
    );
    expect(result).toBe("petal");
  });

  it("falls back to activeThemeId when mode is enabled but themePackId is missing", () => {
    const result = getEffectiveActiveThemeId(
      { mode: "enabled" },
      "woodfish"
    );
    expect(result).toBe("woodfish");
  });

  it("falls back to activeThemeId when mode is disabled", () => {
    const result = getEffectiveActiveThemeId(
      { mode: "disabled", themePackId: "petal" },
      "woodfish"
    );
    expect(result).toBe("woodfish");
  });

  it("falls back to activeThemeId when mode is inherit", () => {
    const result = getEffectiveActiveThemeId(
      { mode: "inherit" },
      "woodfish"
    );
    expect(result).toBe("woodfish");
  });
});

describe("resolveNextConfigForThemeChange", () => {
  const baseConfig = {
    enabled: true,
    activeThemePackId: "woodfish",
    activeSchemeId: "woodfish",
    themePacks: [],
    schemes: [],
    siteRules: { byHost: {} },
    editor: {},
  };

  function setupRuntime(mocks = {}) {
    globalThis.window = {
      ...globalThis.window,
      CursorDanceConfigRuntime: {
        getSiteRule: mocks.getSiteRule ?? (() => ({ mode: "inherit" })),
        setSiteRuleMode: mocks.setSiteRuleMode ?? vi.fn((config, host, mode) => ({
          ...config,
          siteRules: {
            ...config.siteRules,
            byHost: {
              ...config.siteRules?.byHost,
              [host]: { mode, themePackId: config.siteRules?.byHost?.[host]?.themePackId },
            },
          },
        })),
        setSiteRuleThemePackId: mocks.setSiteRuleThemePackId ?? vi.fn((config, host, themePackId) => ({
          ...config,
          siteRules: {
            ...config.siteRules,
            byHost: {
              ...config.siteRules?.byHost,
              [host]: { mode: "enabled", themePackId },
            },
          },
        })),
      },
    };
  }

  it("updates site rule themePackId when site mode is enabled", () => {
    const setSiteRuleThemePackId = vi.fn((config, host, themePackId) => ({
      ...config,
      siteRules: {
        ...config.siteRules,
        byHost: {
          ...config.siteRules?.byHost,
          [host]: { mode: "enabled", themePackId },
        },
      },
    }));
    setupRuntime({
      getSiteRule: () => ({ mode: "enabled", themePackId: "woodfish" }),
      setSiteRuleThemePackId,
    });

    const result = resolveNextConfigForThemeChange(
      baseConfig,
      { host: "example.com" },
      "petal",
      "leftClick"
    );

    expect(setSiteRuleThemePackId).toHaveBeenCalledWith(baseConfig, "example.com", "petal");
    expect(result.siteRules.byHost["example.com"]).toEqual({
      mode: "enabled",
      themePackId: "petal",
    });
  });

  it("enables and sets theme when site mode is disabled", () => {
    const setSiteRuleMode = vi.fn((config, host, mode) => ({
      ...config,
      siteRules: {
        ...config.siteRules,
        byHost: {
          ...config.siteRules?.byHost,
          [host]: { mode },
        },
      },
    }));
    const setSiteRuleThemePackId = vi.fn((config, host, themePackId) => ({
      ...config,
      siteRules: {
        ...config.siteRules,
        byHost: {
          ...config.siteRules?.byHost,
          [host]: { mode: "enabled", themePackId },
        },
      },
    }));
    setupRuntime({
      getSiteRule: () => ({ mode: "disabled" }),
      setSiteRuleMode,
      setSiteRuleThemePackId,
    });

    const result = resolveNextConfigForThemeChange(
      baseConfig,
      { host: "example.com" },
      "petal",
      "leftClick"
    );

    expect(setSiteRuleMode).toHaveBeenCalledWith(baseConfig, "example.com", "enabled");
    expect(result.siteRules.byHost["example.com"]).toEqual({
      mode: "enabled",
      themePackId: "petal",
    });
  });

  it("updates global activeThemePackId when site mode is inherit", () => {
    setupRuntime({
      getSiteRule: () => ({ mode: "inherit" }),
    });

    const result = resolveNextConfigForThemeChange(
      baseConfig,
      { host: "example.com" },
      "petal",
      "doubleClick"
    );

    expect(result.activeThemePackId).toBe("petal");
    expect(result.activeSchemeId).toBe("petal");
    expect(result.editor.lastActionId).toBe("doubleClick");
    // Should not create site rules
    expect(result.siteRules.byHost).toEqual({});
  });

  it("updates global when site.host is empty", () => {
    setupRuntime({
      getSiteRule: () => ({ mode: "inherit" }),
    });

    const result = resolveNextConfigForThemeChange(
      baseConfig,
      { host: "" },
      "petal",
      "leftClick"
    );

    expect(result.activeThemePackId).toBe("petal");
  });

  it("skips site rule update when host is empty even if mode is enabled", () => {
    setupRuntime({
      getSiteRule: () => ({ mode: "enabled", themePackId: "woodfish" }),
    });

    // When site.host is empty, the enabled branch doesn't execute (site.host is falsy)
    const result = resolveNextConfigForThemeChange(
      baseConfig,
      { host: "" },
      "petal",
      "leftClick"
    );

    // Falls through to global update
    expect(result.activeThemePackId).toBe("petal");
    expect(result.siteRules.byHost).toEqual({});
  });
});
