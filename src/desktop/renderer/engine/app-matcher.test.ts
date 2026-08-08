import { describe, it, expect } from "vitest";
import {
  matchAppPattern as matchPattern,
  resolveAppRule,
  resolveDesktopContextAction,
} from "../../../shared/app-rules";

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

  describe("bundle target", () => {
    it("matches a stable bundle id instead of the localized process name", () => {
      expect(matchPattern(
        { bundleId: "com.microsoft.VSCode", processName: "Visual Studio Code", title: "" },
        { target: "bundle", type: "exact", value: "COM.MICROSOFT.VSCODE" },
      )).toBe(true);
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

  it("evaluates direct application rules before advanced patterns", () => {
    const rules = [
      { id: "advanced", pattern: { target: "title" as const, type: "glob" as const, value: "*Review*" }, action: "disable" as const },
      { id: "application", pattern: { target: "process" as const, type: "exact" as const, value: "Code" }, action: { enable: true, theme: "neon" } },
    ];
    expect(resolveAppRule(rules, { processName: "Code", title: "Review" })).toEqual({ enable: true, theme: "neon" });
  });

  it("keeps an explicitly advanced exact process rule in advanced order", () => {
    const rules = [
      { id: "advanced", kind: "advanced" as const, pattern: { target: "process" as const, type: "exact" as const, value: "Code" }, action: "disable" as const },
      { id: "application", kind: "application" as const, pattern: { target: "bundle" as const, type: "exact" as const, value: "com.microsoft.VSCode" }, action: { enable: true, theme: "neon" } },
    ];
    expect(resolveAppRule(rules, {
      bundleId: "com.microsoft.VSCode",
      processName: "Code",
      title: "",
    })).toEqual({ enable: true, theme: "neon" });
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

describe("canonical desktop context rule resolution", () => {
  const info = {
    bundleId: "com.microsoft.VSCode",
    processName: "Code",
    title: "Review — cursor-dance",
  };

  it("uses the same application-before-advanced priority after v4 persistence", () => {
    const rules = [{
      id: "advanced",
      context: "desktop" as const,
      kind: "advanced" as const,
      enabled: true,
      match: { target: "title" as const, type: "glob" as const, value: "*Review*" },
      action: { type: "disable" as const },
    }, {
      id: "application",
      context: "desktop" as const,
      kind: "application" as const,
      enabled: true,
      match: { target: "bundle" as const, type: "exact" as const, value: "com.microsoft.VSCode" },
      action: { type: "enable" as const, themeId: "drift" },
    }];

    expect(resolveDesktopContextAction(rules, info, true)).toEqual({
      type: "enable",
      themeId: "drift",
    });
  });

  it("lets a no-op follow-global action fall through to a meaningful rule", () => {
    const rules = [{
      id: "application",
      context: "desktop" as const,
      kind: "application" as const,
      enabled: true,
      match: { target: "bundle" as const, type: "exact" as const, value: "com.microsoft.VSCode" },
      action: { type: "enable" as const },
    }, {
      id: "advanced",
      context: "desktop" as const,
      kind: "advanced" as const,
      enabled: true,
      match: { target: "title" as const, type: "glob" as const, value: "*Review*" },
      action: { type: "disable" as const },
    }];

    expect(resolveDesktopContextAction(rules, info, true)).toEqual({ type: "disable" });
  });
});
