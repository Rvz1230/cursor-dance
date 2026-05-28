import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clampNumber,
  normalizeHexColor,
  sanitizePatchValue,
  sanitizeAiSchemePatch,
  getAiPatchSanitizeMeta,
  mergeActionConfig,
} from "../src/sanitize.js";

describe("clampNumber", () => {
  it("clamps value within limits", () => {
    assert.equal(clampNumber("particleCount", 5), 5);
    assert.equal(clampNumber("particleCount", 0), 0);
    assert.equal(clampNumber("particleCount", 40), 40);
  });

  it("clamps value above max", () => {
    assert.equal(clampNumber("particleCount", 100), 40);
    assert.equal(clampNumber("fontSize", 999), 36);
  });

  it("clamps value below min", () => {
    assert.equal(clampNumber("rippleSize", -10), 20);
    assert.equal(clampNumber("volume", -5), 0);
  });

  it("returns min value for non-numeric input", () => {
    assert.equal(clampNumber("particleCount", "abc"), 0);
    assert.equal(clampNumber("particleCount", NaN), 0);
    assert.equal(clampNumber("particleCount", Infinity), 0);
  });

  it("rounds to integer", () => {
    assert.equal(clampNumber("particleCount", 5.7), 6);
  });

  it("returns value unchanged for unknown field", () => {
    assert.equal(clampNumber("unknownField", 42), 42);
  });
});

describe("normalizeHexColor", () => {
  it("normalizes valid 6-digit hex", () => {
    assert.equal(normalizeHexColor("#0369A1"), "#0369A1");
    assert.equal(normalizeHexColor("#ffffff"), "#FFFFFF");
  });

  it("adds # prefix if missing", () => {
    assert.equal(normalizeHexColor("0369A1"), "#0369A1");
  });

  it("returns null for invalid colors", () => {
    assert.equal(normalizeHexColor("not-a-color"), null);
    assert.equal(normalizeHexColor("#GGG"), null);
    assert.equal(normalizeHexColor("#12345"), null);
    assert.equal(normalizeHexColor("#1234567"), null);
  });

  it("returns null for non-string", () => {
    assert.equal(normalizeHexColor(123), null);
    assert.equal(normalizeHexColor(undefined), null);
    assert.equal(normalizeHexColor(null), null);
  });
});

describe("sanitizePatchValue", () => {
  it("clamps numeric fields", () => {
    assert.equal(sanitizePatchValue("particleCount", 50), 40);
    assert.equal(sanitizePatchValue("volume", 150), 100);
  });

  it("validates enum fields", () => {
    assert.equal(sanitizePatchValue("particleStyle", "火花"), "火花");
    assert.equal(sanitizePatchValue("particleStyle", "invalid"), undefined);
  });

  it("validates boolean fields", () => {
    assert.equal(sanitizePatchValue("particle", true), true);
    assert.equal(sanitizePatchValue("particle", false), false);
    assert.equal(sanitizePatchValue("particle", "true"), undefined);
  });

  it("validates string fields with length limit", () => {
    assert.equal(sanitizePatchValue("textContent", "hello"), "hello");
    const long = "a".repeat(600);
    assert.equal(sanitizePatchValue("textContent", long).length, 500);
  });

  it("validates textColor via hex normalization", () => {
    assert.equal(sanitizePatchValue("textColor", "#0369A1"), "#0369A1");
    assert.equal(sanitizePatchValue("textColor", "not-a-color"), undefined);
  });

  it("validates array fields", () => {
    assert.deepStrictEqual(sanitizePatchValue("textTags", ["a", "b", "c"]), ["a", "b", "c"]);
    assert.equal(sanitizePatchValue("textTags", "not-array"), undefined);
  });

  it("limits array fields to 8 items", () => {
    const result = sanitizePatchValue("textTags", ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    assert.equal(result.length, 8);
  });

  it("filters non-string array items", () => {
    assert.deepStrictEqual(sanitizePatchValue("textTags", ["a", 123, "b", true]), ["a", "b"]);
  });

  it("returns undefined for unknown fields", () => {
    assert.equal(sanitizePatchValue("__proto__", "polluted"), undefined);
    assert.equal(sanitizePatchValue("constructor", "polluted"), undefined);
  });
});

describe("sanitizeAiSchemePatch", () => {
  it("filters unknown fields", () => {
    const result = sanitizeAiSchemePatch({
      particle: true,
      unknownField: "xss",
      anotherBad: 123,
    });
    assert.equal(result.particle, true);
    assert.equal(result.unknownField, undefined);
    assert.equal(result.anotherBad, undefined);
  });

  it("rejects non-object input", () => {
    assert.deepStrictEqual(sanitizeAiSchemePatch(null), {});
    assert.deepStrictEqual(sanitizeAiSchemePatch("string"), {});
    assert.deepStrictEqual(sanitizeAiSchemePatch([]), {});
  });

  it("removes values that fail sanitization", () => {
    const result = sanitizeAiSchemePatch({
      particle: "not-boolean",
      particleCount: 999,
    });
    assert.equal(result.particle, undefined);
    assert.equal(result.particleCount, 40);
  });
});

describe("getAiPatchSanitizeMeta", () => {
  it("reports accepted and dropped fields", () => {
    const meta = getAiPatchSanitizeMeta({
      particle: true,
      particleCount: 12,
      bad1: "x",
      bad2: "y",
    });
    assert.equal(meta.rawFieldCount, 4);
    assert.equal(meta.acceptedFieldCount, 2);
    assert.equal(meta.droppedFieldCount, 2);
    assert.deepStrictEqual(meta.droppedFields, ["bad1", "bad2"]);
  });
});

describe("mergeActionConfig", () => {
  it("merges multiple configs", () => {
    const result = mergeActionConfig(
      { textEnabled: true, particle: false },
      { particle: true, particleCount: 10 },
      { ripple: true },
    );
    assert.equal(result.textEnabled, true);
    assert.equal(result.particle, true);
    assert.equal(result.particleCount, 10);
    assert.equal(result.ripple, true);
  });

  it("replaces textTags array (not merged)", () => {
    const result = mergeActionConfig(
      { textTags: ["a", "b"] },
      { textTags: ["c"] },
    );
    assert.deepStrictEqual(result.textTags, ["c"]);
  });

  it("clones base config", () => {
    const base = { textTags: ["a"] };
    const result = mergeActionConfig(base, { textEnabled: true });
    assert.notStrictEqual(result.textTags, base.textTags);
  });
});
