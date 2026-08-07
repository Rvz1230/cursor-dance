import { describe, expect, it } from "vitest";
import { defaultKeyFeedbackConfig } from "../config/key-feedback";
import {
  deriveKeyFeedbackConfig,
  getHueShiftUnavailableReason,
  resolveKeyFeedbackColor,
  shiftKeyFeedbackHue,
} from "./key-feedback-style";

describe("key feedback color derivation", () => {
  it("maps QWERTY position across the configured hue spread", () => {
    const config = { ...defaultKeyFeedbackConfig, colorMode: "byKey" as const, color: "#0EA5E9", hueSpread: 180 };
    expect(resolveKeyFeedbackColor(config, { layoutX: 0, kind: "character", comboLevel: 0 }))
      .toBe(shiftKeyFeedbackHue(config.color, -90));
    expect(resolveKeyFeedbackColor(config, { layoutX: 1, kind: "character", comboLevel: 0 }))
      .toBe(shiftKeyFeedbackHue(config.color, 90));
  });

  it("uses distinct semantic hues while keeping characters at the base color", () => {
    const config = { ...defaultKeyFeedbackConfig, colorMode: "bySemantic" as const, color: "#F59E0B", hueSpread: 140 };
    expect(resolveKeyFeedbackColor(config, { layoutX: 0.5, kind: "character", comboLevel: 0 })).toBe(config.color);
    expect(resolveKeyFeedbackColor(config, { layoutX: 0.5, kind: "shortcut", comboLevel: 0 })).not.toBe(config.color);
    expect(resolveKeyFeedbackColor(config, { layoutX: 0.5, kind: "modifier", comboLevel: 0 }))
      .not.toBe(resolveKeyFeedbackColor(config, { layoutX: 0.5, kind: "special", comboLevel: 0 }));
  });

  it("reports colors whose hue cannot produce a visible change", () => {
    expect(getHueShiftUnavailableReason("#FFFFFF")).toContain("灰阶");
    expect(getHueShiftUnavailableReason("#0F172A")).toContain("太暗");
    expect(shiftKeyFeedbackHue("#FFFFFF", 180)).toBe("#FFFFFF");
  });
});

describe("key feedback semantic and rhythm derivation", () => {
  it("scales semantic deltas instead of replacing the baseline", () => {
    const subtle = deriveKeyFeedbackConfig({ ...defaultKeyFeedbackConfig, semShortcut: 0.5 }, { kind: "shortcut", comboLevel: 0 });
    const strong = deriveKeyFeedbackConfig({ ...defaultKeyFeedbackConfig, semShortcut: 1.5 }, { kind: "shortcut", comboLevel: 0 });
    expect(subtle.fontSize).toBeCloseTo(defaultKeyFeedbackConfig.fontSize * 1.09);
    expect(strong.fontSize).toBeCloseTo(defaultKeyFeedbackConfig.fontSize * 1.27);
  });

  it("only applies rhythm gain to enabled targets", () => {
    const derived = deriveKeyFeedbackConfig({
      ...defaultKeyFeedbackConfig,
      comboGain: 200,
      comboScale: false,
      comboOpacity: true,
      comboGlow: false,
    }, { kind: "character", comboLevel: 5 });
    expect(derived.scale).toBe(defaultKeyFeedbackConfig.scale);
    expect(derived.opacity).toBe(100);
    expect(derived.glow).toBe(defaultKeyFeedbackConfig.glow);
  });
});
