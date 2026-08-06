import { describe, expect, it } from "vitest";
import { clampXYValue } from "./xy-pad";

describe("clampXYValue", () => {
  it("clamps each axis independently", () => {
    expect(clampXYValue({ x: -4, y: 120 }, [0, 100], [5, 90])).toEqual({ x: 0, y: 90 });
  });

  it("uses the lower bound for invalid values", () => {
    expect(clampXYValue({ x: Number.NaN, y: Number.POSITIVE_INFINITY }, [10, 20], [30, 40]))
      .toEqual({ x: 10, y: 30 });
  });
});
