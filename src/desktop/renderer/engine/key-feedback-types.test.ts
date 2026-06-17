import { describe, it, expect } from "vitest";
import {
  defaultKeyFeedbackConfig,
  normalizeKeyFeedbackConfig,
  type KeyFeedbackConfig,
} from "./key-feedback-types";

describe("normalizeKeyFeedbackConfig", () => {
  it("returns a fresh copy of defaults when input is undefined", () => {
    const result = normalizeKeyFeedbackConfig(undefined);
    expect(result).toEqual(defaultKeyFeedbackConfig);
    // 不应是同一引用——避免外部 mutate 污染默认值
    expect(result).not.toBe(defaultKeyFeedbackConfig);
  });

  it("merges partial overrides on top of defaults", () => {
    const result = normalizeKeyFeedbackConfig({
      enabled: false,
      animationStyle: "raindrop",
      bounceHeight: 200,
    });
    expect(result.enabled).toBe(false);
    expect(result.animationStyle).toBe("raindrop");
    expect(result.bounceHeight).toBe(200);
    // 未指定字段保留默认
    expect(result.fontSize).toBe(defaultKeyFeedbackConfig.fontSize);
    expect(result.color).toBe(defaultKeyFeedbackConfig.color);
    expect(result.cooldownMs).toBe(defaultKeyFeedbackConfig.cooldownMs);
  });

  it("preserves forward-compat fields (trail/splash) even when not in UI", () => {
    const result = normalizeKeyFeedbackConfig({});
    expect(result.trail).toBe(false);
    expect(result.trailLength).toBe(3);
    expect(result.splash).toBe(false);
  });

  it("does not mutate the input partial", () => {
    const partial: Partial<KeyFeedbackConfig> = { fontSize: 99 };
    normalizeKeyFeedbackConfig(partial);
    expect(partial).toEqual({ fontSize: 99 });
    expect(Object.keys(partial)).toHaveLength(1);
  });
});
