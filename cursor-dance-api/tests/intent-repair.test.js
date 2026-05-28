import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { repairPatchForUserIntent } from "../src/intent-repair.js";

describe("repairPatchForUserIntent", () => {
  it("applies soundOff rule when user says 不要声音", () => {
    const result = repairPatchForUserIntent(
      { particle: true },
      { prompt: "不要声音" },
    );
    assert.equal(result.sound, false);
    assert.equal(result.volume, 0);
  });

  it("applies shakeOff rule when user says 关闭震动", () => {
    const result = repairPatchForUserIntent(
      {},
      { prompt: "不要震动" },
    );
    assert.equal(result.shake, 0);
  });

  it("applies rippleOnly rule when user says 只要波纹", () => {
    const result = repairPatchForUserIntent(
      {},
      { prompt: "只要波纹" },
    );
    assert.equal(result.ripple, true);
    assert.equal(result.particle, false);
    assert.equal(result.sound, false);
    assert.equal(result.textEnabled, false);
  });

  it("applies particleOff rule when user says 不要粒子", () => {
    const result = repairPatchForUserIntent(
      {},
      { prompt: "不要粒子" },
    );
    assert.equal(result.particle, false);
    assert.equal(result.particleCount, 0);
  });

  it("applies softerFeedback rule when user says 柔和一点", () => {
    const result = repairPatchForUserIntent(
      {},
      { prompt: "柔和一点", currentConfig: { particleOpacity: 70, rippleOpacity: 60, textOpacity: 85 } },
    );
    assert.ok(result.particleOpacity < 70);
    assert.ok(result.rippleOpacity < 60);
    assert.ok(result.textOpacity < 85);
  });

  it("applies biggerCursor rule when user says 光标变大", () => {
    const result = repairPatchForUserIntent(
      {},
      { prompt: "光标变大一点", currentConfig: { cursorSize: 40 } },
    );
    assert.ok(result.cursorSize > 40);
  });

  it("applies smallerCursor rule when user says 光标变小", () => {
    const result = repairPatchForUserIntent(
      {},
      { prompt: "光标变小一点", currentConfig: { cursorSize: 40 } },
    );
    assert.ok(result.cursorSize < 40);
  });

  it("applies moreVisibleFeedback rule when user says 更明显", () => {
    const result = repairPatchForUserIntent(
      {},
      { prompt: "更明显一点", currentConfig: { particleCount: 18, particleOpacity: 70 } },
    );
    assert.ok(result.particleCount > 18);
    assert.ok(result.particleOpacity > 70);
  });

  it("sanitizes the final patch", () => {
    const result = repairPatchForUserIntent(
      { unknownField: "bad", particle: true },
      { prompt: "" },
    );
    assert.equal(result.unknownField, undefined);
    assert.equal(result.particle, true);
  });

  it("returns empty patch for empty input", () => {
    const result = repairPatchForUserIntent(null, {});
    assert.deepStrictEqual(result, {});
  });
});
