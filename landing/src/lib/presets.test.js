import { describe, it, expect } from "vitest";
import { PRESETS } from "./presets.js";

describe("PRESETS", () => {
  it("has 6 presets", () => {
    expect(PRESETS).toHaveLength(6);
  });

  it("each preset has required fields", () => {
    for (const preset of PRESETS) {
      expect(preset).toHaveProperty("id");
      expect(preset).toHaveProperty("label");
      expect(preset).toHaveProperty("particleColors");
      expect(preset).toHaveProperty("rippleColor");
      expect(preset).toHaveProperty("textColor");
    }
  });

  it("each preset has at least 4 particle colors", () => {
    for (const preset of PRESETS) {
      expect(preset.particleColors.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("all preset ids are unique", () => {
    const ids = PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all particle colors are valid hex/rgba", () => {
    for (const preset of PRESETS) {
      for (const color of preset.particleColors) {
        expect(color).toMatch(/^(#[0-9a-fA-F]{6}|rgba?\(.+\))$/);
      }
    }
  });

  it("rippleColor is valid rgba", () => {
    for (const preset of PRESETS) {
      expect(preset.rippleColor).toMatch(/^rgba?\(.+\)$/);
    }
  });

  it("known preset ids exist", () => {
    const ids = PRESETS.map((p) => p.id);
    expect(ids).toContain("aurora");
    expect(ids).toContain("flame");
    expect(ids).toContain("minimal");
    expect(ids).toContain("neon");
    expect(ids).toContain("stardust");
    expect(ids).toContain("ocean");
  });
});
