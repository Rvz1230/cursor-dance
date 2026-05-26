import { describe, expect, it } from "vitest";
import { initialState, reducer } from "./themeWorkbenchStateStore.js";

function makeState(overrides = {}) {
  return {
    ...initialState,
    ...overrides,
    site: {
      host: "example.com",
      isSupportedPage: true,
      tabId: null,
      ...(overrides.site || {}),
    },
  };
}

describe("site rules reducer", () => {
  describe("site-mode/set", () => {
    it('writes an "enabled" rule when mode is 始终启用', () => {
      const state = makeState();
      const next = reducer(state, { type: "site-mode/set", payload: "始终启用" });

      expect(next.siteMode).toBe("始终启用");
      expect(next.siteRulesByHost["example.com"]).toEqual({
        mode: "enabled",
        themePackId: state.selection.themeId,
      });
      expect(next.ui.unsaved).toBe(true);
    });

    it('writes a "disabled" rule without themePackId when mode is 始终禁用', () => {
      const state = makeState();
      const next = reducer(state, { type: "site-mode/set", payload: "始终禁用" });

      expect(next.siteMode).toBe("始终禁用");
      expect(next.siteRulesByHost["example.com"]).toEqual({ mode: "disabled" });
      expect(next.ui.unsaved).toBe(true);
    });

    it("deletes the host from siteRulesByHost when mode is 跟随全局", () => {
      const state = makeState({
        siteRulesByHost: { "example.com": { mode: "enabled", themePackId: "test" } },
        siteMode: "始终启用",
      });
      const next = reducer(state, { type: "site-mode/set", payload: "跟随全局" });

      expect(next.siteMode).toBe("跟随全局");
      expect(next.siteRulesByHost["example.com"]).toBeUndefined();
    });

    it("is a no-op when host is empty", () => {
      const state = makeState({ site: { host: "", isSupportedPage: false } });
      const next = reducer(state, { type: "site-mode/set", payload: "始终启用" });

      expect(next.siteMode).toBe("始终启用");
      expect(next.siteRulesByHost).toEqual({});
    });

    it("preserves existing themePackId when switching back to enabled", () => {
      const state = makeState({
        siteRulesByHost: { "example.com": { mode: "disabled" } },
        siteMode: "始终禁用",
      });
      // Switching disabled → enabled should not set a themePackId
      const next = reducer(state, { type: "site-mode/set", payload: "始终启用" });

      expect(next.siteMode).toBe("始终启用");
      expect(next.siteRulesByHost["example.com"].mode).toBe("enabled");
      expect(next.siteRulesByHost["example.com"].themePackId).toBe(state.selection.themeId);
    });
  });

  describe("site-theme/set", () => {
    it("sets mode to enabled and stores themePackId", () => {
      const state = makeState({ siteMode: "跟随全局" });
      const next = reducer(state, { type: "site-theme/set", payload: "petal" });

      expect(next.siteMode).toBe("始终启用");
      expect(next.siteThemeId).toBe("petal");
      expect(next.siteRulesByHost["example.com"]).toEqual({
        mode: "enabled",
        themePackId: "petal",
      });
      expect(next.ui.unsaved).toBe(true);
    });

    it("is a no-op when host is empty", () => {
      const state = makeState({ site: { host: "" } });
      const next = reducer(state, { type: "site-theme/set", payload: "petal" });

      expect(next.siteMode).toBe("始终启用");
      expect(next.siteRulesByHost).toEqual({});
    });

    it("upgrades disabled rule to enabled when setting theme", () => {
      const state = makeState({
        siteRulesByHost: { "example.com": { mode: "disabled" } },
        siteMode: "始终禁用",
      });
      const next = reducer(state, { type: "site-theme/set", payload: "petal" });

      expect(next.siteMode).toBe("始终启用");
      expect(next.siteRulesByHost["example.com"]).toEqual({
        mode: "enabled",
        themePackId: "petal",
      });
    });
  });

  describe("site-rules/clear-all", () => {
    it("resets siteMode, siteThemeId, and clears all rules", () => {
      const state = makeState({
        siteMode: "始终启用",
        siteThemeId: "petal",
        siteRulesByHost: {
          "example.com": { mode: "enabled", themePackId: "petal" },
          "other.com": { mode: "disabled" },
        },
      });
      const next = reducer(state, { type: "site-rules/clear-all" });

      expect(next.siteMode).toBe("跟随全局");
      expect(next.siteThemeId).toBe(state.selection.themeId);
      expect(next.siteRulesByHost).toEqual({});
    });
  });

  describe("site-rules/remove-hosts", () => {
    it("removes specified hosts and resets current host state", () => {
      const state = makeState({
        siteMode: "始终启用",
        siteThemeId: "petal",
        siteRulesByHost: {
          "example.com": { mode: "enabled", themePackId: "petal" },
          "other.com": { mode: "disabled" },
        },
      });
      const next = reducer(state, { type: "site-rules/remove-hosts", payload: ["example.com"] });

      expect(next.siteRulesByHost["example.com"]).toBeUndefined();
      expect(next.siteRulesByHost["other.com"]).toEqual({ mode: "disabled" });
      expect(next.siteMode).toBe("跟随全局");
      expect(next.siteThemeId).toBe(state.selection.themeId);
    });

    it("does not reset current host state when removing a different host", () => {
      const state = makeState({
        siteMode: "始终启用",
        siteThemeId: "petal",
        siteRulesByHost: {
          "example.com": { mode: "enabled", themePackId: "petal" },
          "other.com": { mode: "disabled" },
        },
      });
      const next = reducer(state, { type: "site-rules/remove-hosts", payload: ["other.com"] });

      expect(next.siteRulesByHost["other.com"]).toBeUndefined();
      expect(next.siteRulesByHost["example.com"]).toBeDefined();
      expect(next.siteMode).toBe("始终启用");
    });
  });

  describe("site-rules/remove-host", () => {
    it("removes a single host", () => {
      const state = makeState({
        siteMode: "始终启用",
        siteThemeId: "petal",
        siteRulesByHost: {
          "example.com": { mode: "enabled", themePackId: "petal" },
          "other.com": { mode: "disabled" },
        },
      });
      const next = reducer(state, { type: "site-rules/remove-host", payload: "other.com" });

      expect(next.siteRulesByHost["other.com"]).toBeUndefined();
      expect(next.siteRulesByHost["example.com"]).toBeDefined();
      expect(next.siteMode).toBe("始终启用");
    });

    it("resets site mode when removing the current host", () => {
      const state = makeState({
        siteMode: "始终启用",
        siteThemeId: "petal",
        siteRulesByHost: {
          "example.com": { mode: "enabled", themePackId: "petal" },
        },
      });
      const next = reducer(state, { type: "site-rules/remove-host", payload: "example.com" });

      expect(next.siteRulesByHost["example.com"]).toBeUndefined();
      expect(next.siteMode).toBe("跟随全局");
      expect(next.siteThemeId).toBe(state.selection.themeId);
    });
  });
});
