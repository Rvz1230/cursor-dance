import { describe, expect, it } from "vitest";
import { resolveDisplayIdAtPoint } from "./display-routing";

const DISPLAYS = [
  { id: 1, bounds: { x: 0, y: 0, width: 1440, height: 900 } },
  { id: 2, bounds: { x: 1440, y: -200, width: 1920, height: 1080 } },
] as const;

describe("resolveDisplayIdAtPoint", () => {
  it("routes to the display containing the current cursor", () => {
    expect(resolveDisplayIdAtPoint(DISPLAYS, { x: 1700, y: 100 }, 1)).toBe(2);
  });

  it("uses the nearest display when the cursor lies in a layout gap", () => {
    expect(resolveDisplayIdAtPoint(DISPLAYS, { x: 1200, y: -120 }, 1)).toBe(1);
  });

  it("falls back when Electron has not reported any displays", () => {
    expect(resolveDisplayIdAtPoint([], { x: 0, y: 0 }, 7)).toBe(7);
  });
});
