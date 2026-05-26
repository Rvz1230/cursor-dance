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

describe("normalizeSiteRule", () => {
  const normalizeSiteRule = () => globalThis.window.CursorDanceConfigRuntime.normalizeSiteRule;

  it("converts string 'enabled' to object", () => {
    expect(normalizeSiteRule()("enabled")).toEqual({ mode: "enabled" });
  });

  it("converts string 'disabled' to object", () => {
    expect(normalizeSiteRule()("disabled")).toEqual({ mode: "disabled" });
  });

  it("converts string 'inherit' to object", () => {
    expect(normalizeSiteRule()("inherit")).toEqual({ mode: "inherit" });
  });

  it("preserves valid object with mode and themePackId", () => {
    expect(normalizeSiteRule()({ mode: "enabled", themePackId: "woodfish" })).toEqual({
      mode: "enabled",
      themePackId: "woodfish",
    });
  });

  it("normalizes themePackId alias", () => {
    expect(normalizeSiteRule()({ mode: "enabled", themePackId: "cute-pink" })).toEqual({
      mode: "enabled",
      themePackId: "woodfish",
    });
  });

  it("defaults null to inherit", () => {
    expect(normalizeSiteRule()(null)).toEqual({ mode: "inherit" });
  });

  it("defaults undefined to inherit", () => {
    expect(normalizeSiteRule()(undefined)).toEqual({ mode: "inherit" });
  });

  it("treats array as invalid and defaults to inherit", () => {
    expect(normalizeSiteRule()(["enabled"])).toEqual({ mode: "inherit" });
  });

  it("preserves any mode string as-is (no enum validation)", () => {
    expect(normalizeSiteRule()({ mode: "unknown", themePackId: "x" })).toEqual({
      mode: "unknown",
      themePackId: "x",
    });
  });

  it("strips extra keys beyond mode and themePackId", () => {
    expect(normalizeSiteRule()({ mode: "enabled", themePackId: "x", extra: true })).toEqual({
      mode: "enabled",
      themePackId: "x",
    });
  });

  it("omits undefined themePackId", () => {
    expect(normalizeSiteRule()({ mode: "enabled" })).toEqual({ mode: "enabled" });
  });
});

describe("normalizeSiteRules", () => {
  const normalizeSiteRules = () => globalThis.window.CursorDanceConfigRuntime.normalizeSiteRules;

  it("merges with fallback byHost", () => {
    const fallback = { byHost: { "example.com": { mode: "enabled", themePackId: "woodfish" } } };
    const result = normalizeSiteRules()({ byHost: {} }, fallback);
    expect(result.byHost["example.com"]).toEqual({ mode: "enabled", themePackId: "woodfish" });
  });

  it("overrides fallback with stored values", () => {
    const fallback = { byHost: { "example.com": { mode: "enabled" } } };
    const result = normalizeSiteRules()({ byHost: { "example.com": { mode: "disabled" } } }, fallback);
    expect(result.byHost["example.com"]).toEqual({ mode: "disabled" });
  });

  it("normalizes legacy string rules to objects", () => {
    const result = normalizeSiteRules()({ byHost: { "example.com": "enabled" } });
    expect(result.byHost["example.com"]).toEqual({ mode: "enabled" });
  });
});
