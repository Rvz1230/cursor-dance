import { describe, expect, it } from "vitest";
import { clampSliderValue, snapSliderValue } from "./slider";

describe("slider value contract", () => {
  it("clamps invalid and out-of-range values", () => {
    expect(clampSliderValue(Number.NaN, 10, 20)).toBe(10);
    expect(clampSliderValue(2, 10, 20)).toBe(10);
    expect(clampSliderValue(22, 10, 20)).toBe(20);
  });

  it("quantizes values to the configured step", () => {
    expect(snapSliderValue(12.6, 0, 100, 1)).toBe(13);
    expect(snapSliderValue(12.4, 0, 100, 0.5)).toBe(12.5);
    expect(snapSliderValue(11.2, 1, 32, 0.1)).toBe(11.2);
  });

  it("snaps near a tick and lets Option temporarily bypass snapping", () => {
    expect(snapSliderValue(58, 0, 100, 1, [25, 60, 80], true)).toBe(60);
    expect(snapSliderValue(58, 0, 100, 1, [25, 60, 80], true, true)).toBe(58);
  });
});
