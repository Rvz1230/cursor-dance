import { describe, expect, it } from "vitest";
import {
  applyCursorTrailPreset,
  createDefaultAtmosphereConfig,
  identifyCursorTrailPreset,
  normalizeCursorTrailConfig,
} from "./cursor-trail";

describe("cursor trail config", () => {
  it("normalizes incomplete and out-of-range values", () => {
    expect(normalizeCursorTrailConfig({
      enabled: true,
      shape: "pixel",
      length: 200,
      width: -4,
      lifetimeMs: 12,
      smoothing: 200,
      opacity: 0,
      glow: 99,
      velocityResponse: -10,
      turnResponse: 180,
      gestureResponse: -20,
      colors: ["#112233", ""],
    })).toEqual({
      enabled: true,
      shape: "pixel",
      length: 48,
      width: 2,
      lifetimeMs: 120,
      smoothing: 90,
      opacity: 10,
      glow: 24,
      velocityResponse: 0,
      turnResponse: 100,
      gestureResponse: 0,
      colors: ["#112233", "#8B5CF6"],
      segments: {
        tail: { color: "#112233", width: 1, opacity: 3 },
        middle: { color: "#4E3F95", width: 1.24, opacity: 7 },
        head: { color: "#8B5CF6", width: 2, opacity: 10 },
      },
    });
  });

  it("normalizes three explicit trail segments independently", () => {
    const config = normalizeCursorTrailConfig({
      segments: {
        tail: { color: "#111111", width: 0, opacity: -10 },
        middle: { color: "#777777", width: 12.5, opacity: 44 },
        head: { color: "#FFFFFF", width: 99, opacity: 120 },
      },
    });

    expect(config.segments).toEqual({
      tail: { color: "#111111", width: 1, opacity: 0 },
      middle: { color: "#777777", width: 12.5, opacity: 44 },
      head: { color: "#FFFFFF", width: 32, opacity: 100 },
    });
  });

  it("treats presets as starting points and returns independent color arrays", () => {
    const first = applyCursorTrailPreset("stardust");
    const second = applyCursorTrailPreset("stardust");

    expect(first.enabled).toBe(true);
    expect(identifyCursorTrailPreset({ ...first, enabled: false })).toBe("stardust");
    expect(first.colors).not.toBe(second.colors);
    expect(first.segments).not.toBe(second.segments);
    expect(first.segments.tail).not.toBe(second.segments.tail);
  });

  it("creates a disabled theme-level default", () => {
    const atmosphere = createDefaultAtmosphereConfig();
    expect(atmosphere.mode).toBe("none");
    expect(atmosphere.trail?.enabled).toBe(false);
  });
});
