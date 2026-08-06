import { describe, expect, it } from "vitest";
import {
  hotspotFromImagePixels,
  hotspotOffsetPx,
  hotspotToImagePixels,
  normalizeHotspot,
} from "./cursor-hotspot";

describe("normalizeHotspot", () => {
  it("passes normalized fractions through untouched", () => {
    expect(normalizeHotspot({ x: 0.5, y: 0.25 })).toEqual({ x: 0.5, y: 0.25 });
  });

  it("clamps out-of-range values into 0–1", () => {
    expect(normalizeHotspot({ x: 999, y: -5 })).toEqual({ x: 1, y: 0 });
  });

  it("treats missing or non-numeric input as the top-left corner", () => {
    expect(normalizeHotspot(undefined)).toEqual({ x: 0, y: 0 });
    expect(normalizeHotspot({ x: "12", y: Number.NaN })).toEqual({ x: 0, y: 0 });
  });
});

describe("pixel ↔ fraction round trip", () => {
  it("survives a round trip for every pixel of a 128px image", () => {
    for (let pixel = 0; pixel < 128; pixel += 1) {
      const fraction = hotspotFromImagePixels({ x: pixel, y: pixel }, 128, 128);
      expect(hotspotToImagePixels(fraction, 128, 128)).toEqual({ x: pixel, y: pixel });
    }
  });

  it("keeps the displayed pixel inside the image bounds", () => {
    expect(hotspotToImagePixels({ x: 1, y: 1 }, 32, 32)).toEqual({ x: 31, y: 31 });
  });
});

describe("hotspotOffsetPx", () => {
  // 缺陷的核心：偏移必须按**实际渲染尺寸**算，而不是原图尺寸。
  it("scales the fraction by the rendered size, not the source size", () => {
    expect(hotspotOffsetPx({ x: 0.5, y: 0.5 }, 32)).toEqual({ x: 16, y: 16 });
    expect(hotspotOffsetPx({ x: 0.5, y: 0.5 }, 96)).toEqual({ x: 48, y: 48 });
  });
});
