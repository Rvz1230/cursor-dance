import { describe, expect, it } from "vitest";
import {
  CONTENT_PALETTE,
  EASINGS,
  FONTS,
  SHAPE_PATH,
  getBezierOvershoot,
  getCssEasing,
  getEasingPoints,
  normalizeHexColor,
} from "./control-data";

describe("control data", () => {
  it("keeps each shared table unique", () => {
    expect(new Set(EASINGS.map(({ value }) => value)).size).toBe(EASINGS.length);
    expect(new Set(FONTS.map(({ value }) => value)).size).toBe(FONTS.length);
    expect(new Set(CONTENT_PALETTE).size).toBe(CONTENT_PALETTE.length);
    expect(Object.values(SHAPE_PATH).every((path) => path.includes("currentColor"))).toBe(true);
  });

  it("derives runtime easing and visual metadata from the same points", () => {
    expect(getCssEasing("线性")).toBe("linear");
    expect(getCssEasing("弹跳")).toBe("cubic-bezier(0.34, 1.56, 0.64, 1)");
    expect(getBezierOvershoot(getEasingPoints("弹跳")!)).toBe(9.8);
    expect(getBezierOvershoot(getEasingPoints("弹性")!)).toBe(6.2);
  });

  it("falls back safely and normalizes editable colors", () => {
    expect(getCssEasing("未知")).toBe("cubic-bezier(0, 0, 0.2, 1)");
    expect(normalizeHexColor("f59e0b")).toBe("#F59E0B");
    expect(normalizeHexColor("#xyz")).toBeNull();
    expect(normalizeHexColor("")).toBeNull();
  });
});
