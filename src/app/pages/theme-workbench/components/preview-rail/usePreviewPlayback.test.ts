import { describe, expect, it } from "vitest";
import {
  buildPreviewInputFingerprint,
  getEffectivePreviewInterval,
  getNextPreviewComboIndex,
} from "./usePreviewPlayback";

describe("preview playback state", () => {
  it("keeps enough time for simulated multi-step actions", () => {
    expect(getEffectivePreviewInterval("leftClick", 100, 600)).toBe(600);
    expect(getEffectivePreviewInterval("longPress", 900, 600)).toBe(1300);
    expect(getEffectivePreviewInterval("doubleClick", undefined, 600)).toBe(720);
  });

  it("advances combos only inside the configured window", () => {
    expect(getNextPreviewComboIndex(2, 1000, 1750, 900)).toBe(3);
    expect(getNextPreviewComboIndex(2, 1000, 1950, 900)).toBe(1);
    expect(getNextPreviewComboIndex(2, 0, 100, 900)).toBe(1);
  });

  it("treats action switches as new preview input even when configs match", () => {
    const config = { ripple: true };
    expect(buildPreviewInputFingerprint("leftClick", config))
      .not.toBe(buildPreviewInputFingerprint("rightClick", config));
  });
});
