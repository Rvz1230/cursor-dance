import { describe, it, expect } from "vitest";
import { matchPattern, resolveAppRule } from "./app-matcher";

describe("matchPattern", () => {
  describe("exact type", () => {
    it("matches exact process name", () => {
      expect(matchPattern({ processName: "Code", title: "" }, { type: "exact", value: "Code" })).toBe(true);
    });
    it("is case-insensitive", () => {
      expect(matchPattern({ processName: "CODE", title: "" }, { type: "exact", value: "code" })).toBe(true);
    });
    it("rejects different process", () => {
      expect(matchPattern({ processName: "vim", title: "" }, { type: "exact", value: "code" })).toBe(false);
    });
  });

  describe("glob type", () => {
    it("matches with single-segment wildcard on process name", () => {
      expect(matchPattern({ processName: "Code-Insiders", title: "" }, { type: "glob", value: "code-*" })).toBe(true);
    });
    it("matches ** multi-segment wildcard", () => {
      expect(matchPattern({ processName: "jetbrains.idea.community", title: "" }, { type: "glob", value: "**.idea.**" })).toBe(true);
    });
    it("does not match unrelated process", () => {
      expect(matchPattern({ processName: "vim", title: "" }, { type: "glob", value: "code-*" })).toBe(false);
    });
  });

  describe("title target", () => {
    it("matches against window title when target=title", () => {
      expect(matchPattern(
        { processName: "Code", title: "package.json — cursor-dance" },
        { type: "glob", value: "*cursor-dance*", target: "title" },
      )).toBe(true);
    });
    it("does NOT consult title when target=process (default)", () => {
      expect(matchPattern(
        { processName: "Code", title: "package.json — cursor-dance" },
        { type: "exact", value: "cursor-dance" },
      )).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("returns false for null pattern", () => {
      expect(matchPattern({ processName: "Code", title: "" }, null)).toBe(false);
    });
    it("returns false for empty processName", () => {
      expect(matchPattern({ processName: "", title: "" }, { type: "exact", value: "code" })).toBe(false);
    });
    it("returns false for empty pattern value", () => {
      expect(matchPattern({ processName: "Code", title: "" }, { type: "exact", value: "" })).toBe(false);
    });
    it("returns false for unknown pattern type", () => {
      expect(matchPattern(
        { processName: "Code", title: "" },
        { type: "regex" as unknown as "exact", value: ".*" },
      )).toBe(false);
    });
  });
});

describe("resolveAppRule", () => {
  it("returns first matching rule action", () => {
    const rules = [
      { id: "r1", pattern: { type: "exact" as const, value: "Code" }, action: "disable" as const },
      { id: "r2", pattern: { type: "glob" as const, value: "code-*" }, action: { enable: true, theme: "neon" } },
    ];
    expect(resolveAppRule(rules, { processName: "Code", title: "" })).toBe("disable");
  });

  it("skips disabled rules", () => {
    const rules = [
      { id: "r1", pattern: { type: "exact" as const, value: "Code" }, action: "disable" as const, enabled: false },
      { id: "r2", pattern: { type: "exact" as const, value: "Code" }, action: { enable: true } },
    ];
    expect(resolveAppRule(rules, { processName: "Code", title: "" })).toEqual({ enable: true, theme: undefined });
  });

  it("returns null when no rule matches", () => {
    const rules = [
      { id: "r1", pattern: { type: "exact" as const, value: "vim" }, action: "disable" as const },
    ];
    expect(resolveAppRule(rules, { processName: "Code", title: "" })).toBeNull();
  });

  it("returns null for empty array", () => {
    expect(resolveAppRule([], { processName: "Code", title: "" })).toBeNull();
  });

  it("returns null for non-array input", () => {
    expect(resolveAppRule(null, { processName: "Code", title: "" })).toBeNull();
    expect(resolveAppRule(undefined, { processName: "Code", title: "" })).toBeNull();
  });

  it("returns action with theme", () => {
    const rules = [
      { id: "r1", pattern: { type: "glob" as const, value: "code-*" }, action: { enable: true, theme: "woodfish" } },
    ];
    expect(resolveAppRule(rules, { processName: "Code-Insiders", title: "" })).toEqual({ enable: true, theme: "woodfish" });
  });

  it("strips theme when not a string", () => {
    const rules = [
      { id: "r1", pattern: { type: "exact" as const, value: "Code" }, action: { enable: true, theme: 123 as unknown as string } },
    ];
    expect(resolveAppRule(rules, { processName: "Code", title: "" })).toEqual({ enable: true, theme: undefined });
  });
});
