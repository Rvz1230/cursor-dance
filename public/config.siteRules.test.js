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

describe("normalizeSiteRules", () => {
  const normalizeSiteRules = () => globalThis.window.CursorDanceConfigRuntime.normalizeSiteRules;

  describe("new array format", () => {
    it("returns array as-is for valid rules", () => {
      const rules = [
        { id: "r1", pattern: { type: "exact", value: "example.com" }, action: "disable" },
        { id: "r2", pattern: { type: "glob", value: "*.google.com" }, action: { enable: true, theme: "woodfish" } },
      ];
      const result = normalizeSiteRules()(rules);
      expect(result[0]).toMatchObject({ id: "r1", pattern: { type: "exact", value: "example.com" }, action: "disable" });
      expect(result[1]).toMatchObject({ id: "r2", pattern: { type: "glob", value: "*.google.com" }, action: { enable: true, theme: "woodfish" } });
    });

    it("generates ids for rules without them", () => {
      const rules = [
        { pattern: { type: "exact", value: "example.com" }, action: "disable" },
        { pattern: { type: "glob", value: "*.test.com" }, action: { enable: true } },
      ];
      const result = normalizeSiteRules()(rules);
      expect(result[0].id).toBe("r1");
      expect(result[1].id).toBe("r2");
    });

    it("defaults enabled to true", () => {
      const rules = [
        { id: "r1", pattern: { type: "exact", value: "example.com" }, action: "disable" },
      ];
      const result = normalizeSiteRules()(rules);
      expect(result[0].enabled).toBe(true);
    });

    it("preserves explicit enabled: false", () => {
      const rules = [
        { id: "r1", pattern: { type: "exact", value: "example.com" }, action: "disable", enabled: false },
      ];
      const result = normalizeSiteRules()(rules);
      expect(result[0].enabled).toBe(false);
    });

    it("filters out rules without pattern or action", () => {
      const rules = [
        { id: "r1", pattern: { type: "exact", value: "example.com" }, action: "disable" },
        { id: "r2", pattern: null, action: "disable" },
        { id: "r3", pattern: { type: "exact", value: "test.com" }, action: null },
      ];
      const result = normalizeSiteRules()(rules);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("r1");
    });
  });


  describe("fallback and edge cases", () => {
    it("returns empty array for null input", () => {
      expect(normalizeSiteRules()(null)).toEqual([]);
    });

    it("returns empty array for undefined input", () => {
      expect(normalizeSiteRules()(undefined)).toEqual([]);
    });

    it("returns empty array for non-object non-array input", () => {
      expect(normalizeSiteRules()("not-valid")).toEqual([]);
    });

    it("uses fallback array when primary is null", () => {
      const fallback = [
        { id: "r1", pattern: { type: "exact", value: "fallback.com" }, action: "disable" },
      ];
      expect(normalizeSiteRules()(null, fallback)).toEqual(fallback);
    });

    it("returns empty array when fallback is non-array", () => {
      const fallback = { byHost: { "example.com": { mode: "disabled" } } };
      const result = normalizeSiteRules()(null, fallback);
      expect(result).toEqual([]);
    });
  });
});
