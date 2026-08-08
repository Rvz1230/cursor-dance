import { describe, expect, it } from "vitest";
import { defaultKeyFeedbackConfig } from "@/shared/config/key-feedback";
import { formatKeyboardComboStatus } from "./keyboardComboModel";

describe("formatKeyboardComboStatus", () => {
  it("reports disabled and idle states", () => {
    expect(formatKeyboardComboStatus({ ...defaultKeyFeedbackConfig, typingCombo: false }, 3)).toBe("已关闭");
    expect(formatKeyboardComboStatus(defaultKeyFeedbackConfig, 0)).toBe("未在连打");
  });

  it("reports the live level and effective modulation", () => {
    expect(formatKeyboardComboStatus(defaultKeyFeedbackConfig, 3))
      .toBe("3 级 · 字号 +10.5% · 不透明度 +6 · 发光");
  });

  it("makes an empty modulation target explicit", () => {
    expect(formatKeyboardComboStatus({
      ...defaultKeyFeedbackConfig,
      comboScale: false,
      comboOpacity: false,
      comboGlow: false,
    }, 2)).toBe("2 级 · 没有作用目标");
  });

  it("distinguishes zero gain and a glow target that is not active yet", () => {
    expect(formatKeyboardComboStatus({
      ...defaultKeyFeedbackConfig,
      comboGain: 0,
    }, 2)).toBe("2 级 · 强度为 0");
    expect(formatKeyboardComboStatus({
      ...defaultKeyFeedbackConfig,
      comboScale: false,
      comboOpacity: false,
    }, 2)).toBe("2 级 · 发光将在 3 级点亮");
  });
});
