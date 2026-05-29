import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatDiffValue, buildAiSchemeDiffItems, describeDiff } from "../src/diff.js";

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

describe("describeDiff", () => {
  it("describes text changes", () => {
    const lines = describeDiff({ textEnabled: true, textKind: "文本飘字", textContent: "Nice" });
    assert.ok(lines.some((l) => l.includes("文本飘字") && l.includes("Nice")));
  });

  it("describes switching to number mode", () => {
    const lines = describeDiff({ textEnabled: true, textKind: "数字飘字", textMode: "默认模式 (+1)" });
    assert.ok(lines.some((l) => l.includes("数字飘字")));
  });

  it("describes particle changes with style", () => {
    const lines = describeDiff({ particle: true, particleCount: 12, particleStyle: "星光" });
    assert.ok(lines.some((l) => l.includes("星光") && l.includes("12")));
  });

  it("describes ripple changes", () => {
    const lines = describeDiff({ ripple: true, rippleSize: 80, rippleStyle: "双环" });
    assert.ok(lines.some((l) => l.includes("双环") && l.includes("80")));
  });

  it("describes audio changes", () => {
    const lines = describeDiff({ sound: true, volume: 50, soundFile: "chime-bright.wav" });
    assert.ok(lines.some((l) => l.includes("50")));
    assert.ok(lines.some((l) => l.includes("chime-bright.wav")));
  });

  it("describes cursor changes", () => {
    const lines = describeDiff({ shake: 30, cursorSize: 48 });
    assert.ok(lines.some((l) => l.includes("震动") && l.includes("30")));
    assert.ok(lines.some((l) => l.includes("48")));
  });

  it("describes animation and image toggles", () => {
    const lines = describeDiff({ animationEnabled: true, animationStyle: "聚焦脉冲", imageEnabled: false });
    assert.ok(lines.some((l) => l.includes("聚焦脉冲")));
    assert.ok(lines.some((l) => l.includes("关闭图像")));
  });

  it("truncates to at most 5 items", () => {
    const lines = describeDiff({
      textEnabled: true, particle: true, ripple: true, sound: true,
      animationEnabled: true, imageEnabled: true, shake: 10,
    });
    assert.ok(lines.length <= 5);
  });
});
