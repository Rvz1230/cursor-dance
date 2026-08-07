import { describe, it, expect } from "vitest";
import {
  defaultKeyFeedbackConfig,
  normalizeKeyFeedbackConfig,
  type KeyFeedbackConfig,
} from "./key-feedback";

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

  it("fills the complete visual and motion model", () => {
    const result = normalizeKeyFeedbackConfig({});
    expect(result.anchor).toBe("screen");
    expect(result.colorMode).toBe("solid");
    expect(result.comboGain).toBe(100);
    expect(result.trail).toBe(false);
    expect(result.trailLength).toBe(3);
    expect(result.exitStyle).toBe("fade");
    expect(result.splash).toBe(false);
  });

  it("does not mutate the input partial", () => {
    const partial: Partial<KeyFeedbackConfig> = { fontSize: 99 };
    normalizeKeyFeedbackConfig(partial);
    expect(partial).toEqual({ fontSize: 99 });
    expect(Object.keys(partial)).toHaveLength(1);
  });

  it("normalizes invalid imported fields to safe defaults", () => {
    const result = normalizeKeyFeedbackConfig({
      enabled: "false" as unknown as boolean,
      animationStyle: "spin" as never,
      originEdge: "middle" as never,
      originMapping: "random" as never,
      anchor: "element" as never,
      keyDisplayMode: "display" as never,
      colorMode: "random" as never,
      exitStyle: "explode" as never,
      fontSize: "large" as unknown as number,
      color: 123 as unknown as string,
      maxSimultaneous: "many" as unknown as number,
    });

    expect(result.enabled).toBe(defaultKeyFeedbackConfig.enabled);
    expect(result.animationStyle).toBe(defaultKeyFeedbackConfig.animationStyle);
    expect(result.originEdge).toBe(defaultKeyFeedbackConfig.originEdge);
    expect(result.originMapping).toBe(defaultKeyFeedbackConfig.originMapping);
    expect(result.anchor).toBe(defaultKeyFeedbackConfig.anchor);
    expect(result.keyDisplayMode).toBe(defaultKeyFeedbackConfig.keyDisplayMode);
    expect(result.colorMode).toBe(defaultKeyFeedbackConfig.colorMode);
    expect(result.exitStyle).toBe(defaultKeyFeedbackConfig.exitStyle);
    expect(result.fontSize).toBe(defaultKeyFeedbackConfig.fontSize);
    expect(result.color).toBe(defaultKeyFeedbackConfig.color);
    expect(result.maxSimultaneous).toBe(defaultKeyFeedbackConfig.maxSimultaneous);
  });
});
