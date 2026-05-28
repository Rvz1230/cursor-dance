import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatDiffValue, buildAiSchemeDiffItems } from "../src/diff.js";

describe("formatDiffValue", () => {
  it("formats boolean values in Chinese", () => {
    assert.equal(formatDiffValue(true), "开启");
    assert.equal(formatDiffValue(false), "关闭");
  });

  it("joins arrays with Chinese separator", () => {
    assert.equal(formatDiffValue(["a", "b", "c"]), "a、b、c");
  });

  it("returns 空 for empty array", () => {
    assert.equal(formatDiffValue([]), "空");
  });

  it("returns 空 for falsy values", () => {
    assert.equal(formatDiffValue(undefined), "空");
    assert.equal(formatDiffValue(null), "空");
    assert.equal(formatDiffValue(""), "空");
  });

  it("stringifies other values", () => {
    assert.equal(formatDiffValue(42), "42");
  });
});

describe("buildAiSchemeDiffItems", () => {
  it("returns diff items for changed fields", () => {
    const items = buildAiSchemeDiffItems(
      { particle: false, particleCount: 0 },
      { particle: true, particleCount: 10 },
    );
    assert.equal(items.length, 2);
    assert.equal(items[0].fieldName, "particle");
    assert.equal(items[0].before, false);
    assert.equal(items[0].after, true);
  });

  it("excludes unchanged fields", () => {
    const items = buildAiSchemeDiffItems(
      { particle: true },
      { particle: true, ripple: false },
    );
    assert.equal(items.length, 1);
    assert.equal(items[0].fieldName, "ripple");
  });

  it("sanitizes patch input", () => {
    const items = buildAiSchemeDiffItems(
      { particle: true },
      { particle: "invalid", unknownField: "xss" },
    );
    // particle: "invalid" sanitizes to undefined, so it won't appear
    // unknownField is dropped
    assert.equal(items.length, 0);
  });
});
