import { describe, expect, it } from "vitest";
import { matchHostPattern, resolveWebContextRule } from "./site-matcher";

describe("v4 web context matcher", () => {
  it("matches exact and glob hosts", () => {
    expect(matchHostPattern("Example.COM", { type: "exact", host: "example.com" })).toBe(true);
    expect(matchHostPattern("mail.google.com", { type: "glob", host: "*.google.com" })).toBe(true);
    expect(matchHostPattern("a.b.google.com", { type: "glob", host: "*.google.com" })).toBe(false);
    expect(matchHostPattern("a.b.example.com", { type: "glob", host: "**.example.com" })).toBe(true);
  });

  it("rejects invalid patterns", () => {
    expect(matchHostPattern("example.com", null)).toBe(false);
    expect(matchHostPattern("", { type: "exact", host: "example.com" })).toBe(false);
    expect(matchHostPattern("example.com", { type: "regex", host: ".*" })).toBe(false);
  });

  it("returns the first enabled matching web action", () => {
    const rules = [
      {
        id: "disabled",
        context: "web",
        enabled: false,
        match: { type: "exact", host: "example.com" },
        action: { type: "disable" },
      },
      {
        id: "docs",
        context: "web",
        enabled: true,
        match: { type: "exact", host: "example.com", path: "/docs" },
        action: { type: "enable", themeId: "drift" },
      },
    ];
    expect(resolveWebContextRule(rules, "example.com", "/docs/start"))
      .toEqual({ type: "enable", themeId: "drift" });
    expect(resolveWebContextRule(rules, "example.com", "/blog")).toBeNull();
  });

  it("ignores desktop rules and invalid collections", () => {
    const desktopRule = {
      id: "desktop",
      context: "desktop",
      enabled: true,
      match: { type: "exact", target: "process", value: "Code" },
      action: { type: "disable" },
    };
    expect(resolveWebContextRule([desktopRule], "example.com", "/")).toBeNull();
    expect(resolveWebContextRule([
      { context: "web", enabled: true, match: { type: "exact", host: "example.com" } },
    ], "example.com", "/")).toBeNull();
    expect(resolveWebContextRule(null, "example.com", "/")).toBeNull();
  });

  it("registers the typed matcher for the legacy config-store adapter", () => {
    expect(globalThis.CursorDanceContentModules.matchHostPattern).toBe(matchHostPattern);
    expect(globalThis.CursorDanceContentModules.resolveWebContextRule).toBe(resolveWebContextRule);
  });
});
