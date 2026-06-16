import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

var siteMatcherSource = readFileSync(
  new URL("../content-runtime/site-matcher.js", import.meta.url),
  "utf8"
);

beforeAll(function () {
  globalThis.window = globalThis.window || {};
  globalThis.window.CursorDanceContentModules = {};
  new Function(siteMatcherSource)();
});

var matchPattern = function (host, path, pattern) {
  return globalThis.window.CursorDanceContentModules.matchPattern(host, path, pattern);
};

var resolveSiteRule = function (rules, host, path) {
  return globalThis.window.CursorDanceContentModules.resolveSiteRule(rules, host, path);
};

describe("matchPattern", function () {
  describe("exact type", function () {
    it("matches exact hostname", function () {
      expect(matchPattern("example.com", "/", { type: "exact", value: "example.com" })).toBe(true);
    });

    it("is case-insensitive", function () {
      expect(matchPattern("Example.COM", "/", { type: "exact", value: "EXAMPLE.com" })).toBe(true);
    });

    it("rejects different hostname", function () {
      expect(matchPattern("other.com", "/", { type: "exact", value: "example.com" })).toBe(false);
    });

    it("rejects subdomain", function () {
      expect(matchPattern("sub.example.com", "/", { type: "exact", value: "example.com" })).toBe(false);
    });
  });

  describe("glob type", function () {
    it("matches subdomain with *. prefix", function () {
      expect(matchPattern("mail.google.com", "/", { type: "glob", value: "*.google.com" })).toBe(true);
    });

    it("matches deep subdomain with *. prefix", function () {
      expect(matchPattern("a.b.google.com", "/", { type: "glob", value: "*.google.com" })).toBe(false);
    });

    it("rejects base domain with *. prefix", function () {
      expect(matchPattern("google.com", "/", { type: "glob", value: "*.google.com" })).toBe(false);
    });

    it("matches with single-segment wildcard", function () {
      expect(matchPattern("www.bilibili.com", "/", { type: "glob", value: "*.bilibili.com" })).toBe(true);
    });

    it("does not match unrelated domain", function () {
      expect(matchPattern("twitter.com", "/", { type: "glob", value: "*.google.com" })).toBe(false);
    });

    it("matches ** multi-segment wildcard", function () {
      expect(matchPattern("a.b.c.example.com", "/", { type: "glob", value: "**.example.com" })).toBe(true);
    });
  });

  describe("path type", function () {
    it("matches host + path prefix", function () {
      expect(matchPattern("github.com", "/issues/42", { type: "path", value: "github.com/issues" })).toBe(true);
    });

    it("matches exact path", function () {
      expect(matchPattern("example.com", "/blog", { type: "path", value: "example.com/blog" })).toBe(true);
    });

    it("rejects different path", function () {
      expect(matchPattern("github.com", "/pulls", { type: "path", value: "github.com/issues" })).toBe(false);
    });

    it("rejects different host same path", function () {
      expect(matchPattern("gitlab.com", "/issues", { type: "path", value: "github.com/issues" })).toBe(false);
    });

    it("matches with www equivalence", function () {
      expect(matchPattern("www.example.com", "/blog", { type: "path", value: "example.com/blog" })).toBe(true);
    });
  });

  describe("edge cases", function () {
    it("returns false for null pattern", function () {
      expect(matchPattern("example.com", "/", null)).toBe(false);
    });

    it("returns false for undefined pattern", function () {
      expect(matchPattern("example.com", "/", undefined)).toBe(false);
    });

    it("returns false for pattern without type", function () {
      expect(matchPattern("example.com", "/", { value: "x" })).toBe(false);
    });

    it("returns false for empty host", function () {
      expect(matchPattern("", "/", { type: "exact", value: "example.com" })).toBe(false);
    });

    it("returns false for empty pattern value", function () {
      expect(matchPattern("example.com", "/", { type: "exact", value: "" })).toBe(false);
    });

    it("returns false for unknown pattern type", function () {
      expect(matchPattern("example.com", "/", { type: "regex", value: ".*" })).toBe(false);
    });
  });
});

describe("resolveSiteRule", function () {
  it("returns first matching rule action", function () {
    var rules = [
      { id: "r1", pattern: { type: "exact", value: "example.com" }, action: "disable" },
      { id: "r2", pattern: { type: "glob", value: "*.example.com" }, action: { enable: true, theme: "neon" } },
    ];
    expect(resolveSiteRule(rules, "example.com", "/")).toBe("disable");
  });

  it("skips disabled rules", function () {
    var rules = [
      { id: "r1", pattern: { type: "exact", value: "example.com" }, action: "disable", enabled: false },
      { id: "r2", pattern: { type: "exact", value: "example.com" }, action: { enable: true } },
    ];
    var result = resolveSiteRule(rules, "example.com", "/");
    expect(result).toEqual({ enable: true, theme: undefined });
  });

  it("returns null when no rule matches", function () {
    var rules = [
      { id: "r1", pattern: { type: "exact", value: "other.com" }, action: "disable" },
    ];
    expect(resolveSiteRule(rules, "example.com", "/")).toBeNull();
  });

  it("returns null for empty array", function () {
    expect(resolveSiteRule([], "example.com", "/")).toBeNull();
  });

  it("returns null for non-array input", function () {
    expect(resolveSiteRule(null, "example.com", "/")).toBeNull();
    expect(resolveSiteRule(undefined, "example.com", "/")).toBeNull();
    expect(resolveSiteRule("not-an-array", "example.com", "/")).toBeNull();
  });

  it("returns null when all rules are disabled", function () {
    var rules = [
      { id: "r1", pattern: { type: "exact", value: "example.com" }, action: "disable", enabled: false },
    ];
    expect(resolveSiteRule(rules, "example.com", "/")).toBeNull();
  });

  it("returns action with theme", function () {
    var rules = [
      { id: "r1", pattern: { type: "glob", value: "*.google.com" }, action: { enable: true, theme: "woodfish" } },
    ];
    expect(resolveSiteRule(rules, "mail.google.com", "/")).toEqual({ enable: true, theme: "woodfish" });
  });

  it("strips theme when not a string", function () {
    var rules = [
      { id: "r1", pattern: { type: "exact", value: "test.com" }, action: { enable: true, theme: 123 } },
    ];
    expect(resolveSiteRule(rules, "test.com", "/")).toEqual({ enable: true, theme: undefined });
  });

  it("skips rules with invalid action", function () {
    var rules = [
      { id: "r1", pattern: { type: "exact", value: "example.com" }, action: null },
      { id: "r2", pattern: { type: "exact", value: "example.com" }, action: "disable" },
    ];
    expect(resolveSiteRule(rules, "example.com", "/")).toBe("disable");
  });
});
