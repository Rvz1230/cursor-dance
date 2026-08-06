import { describe, expect, it } from "vitest";
import {
  EFFECT_PRESETS,
  findMatchingPreset,
  getCardChangedCount,
  getEnabledEffectCount,
  getCardSettingCount,
} from "./effectCardModel";

describe("effect card presentation model", () => {
  it("counts only outputs that really run", () => {
    expect(getEnabledEffectCount({
      textEnabled: true,
      particle: true,
      ripple: false,
      sound: true,
      cursorOverride: "跟随当前状态",
    })).toBe(3);
  });

  it("matches presets by their actual configuration patch", () => {
    const preset = EFFECT_PRESETS.ripple[1];
    expect(findMatchingPreset(EFFECT_PRESETS.ripple, { ...preset.patch, ripple: true })?.name).toBe("脉冲");
    expect(findMatchingPreset(EFFECT_PRESETS.ripple, { ...preset.patch, rippleSize: 42 })).toBeUndefined();
  });

  it("reports card changes against the theme baseline", () => {
    const baseline = { ripple: true, rippleSize: 72, rippleDuration: 820 };
    expect(getCardChangedCount("ripple", { ...baseline, rippleSize: 96 }, baseline)).toBe(1);
  });

  it("uses the reset field registry as the setting-count source", () => {
    expect(getCardSettingCount("trigger")).toBe(3);
    expect(getCardSettingCount("particle")).toBe(20);
  });
});
