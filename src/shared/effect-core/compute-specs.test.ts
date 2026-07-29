import { describe, expect, it } from "vitest";
import {
  computeOrbitalParticleSpecs,
  computeParticleSpecs,
  computeRippleLayers,
  getAnimationVisualStyle,
  getParticleShapeStyle,
  getTextContent,
} from "./compute-specs";

const baseConfig = {
  textEnabled: true,
  textKind: "文本飘字",
  textTags: ["命中", "继续"],
  textTagPlayMode: "顺序播放",
  rippleSize: 48,
  rippleOpacity: 50,
  rippleDuration: 600,
  rippleDelay: 20,
  particleCount: 6,
  particleSpread: 52,
  particleSize: 10,
  particleDuration: 760,
  particleStagger: 26,
  particleStyle: "点状粒子",
  particleDirection: "四周扩散",
  orbitalCount: 5,
  orbitalRadius: 32,
  orbitalSpeed: 3,
};

describe("shared effect specs", () => {
  it("selects ordered text deterministically", () => {
    expect(getTextContent(baseConfig, 1, "leftClick")).toBe("命中");
    expect(getTextContent(baseConfig, 2, "leftClick")).toBe("继续");
  });

  it("builds ripple variants with configured delay", () => {
    expect(computeRippleLayers({ ...baseConfig, rippleStyle: "双环" })).toHaveLength(2);
    expect(computeRippleLayers({ ...baseConfig, rippleStyle: "回声环" })).toHaveLength(4);
    expect(computeRippleLayers({ ...baseConfig, rippleStyle: "单环" })[0]).toMatchObject({ delay: 20, size: 48 });
  });

  it("keeps particle output deterministic and bounded", () => {
    const first = computeParticleSpecs(baseConfig, 3);
    expect(first).toEqual(computeParticleSpecs(baseConfig, 3));
    expect(first).toHaveLength(6);
    expect(computeParticleSpecs({ ...baseConfig, particleCount: 60 }, 1)).toHaveLength(40);
  });

  it("builds orbital and visual style specs", () => {
    expect(computeOrbitalParticleSpecs(baseConfig)).toHaveLength(5);
    expect(getParticleShapeStyle({ ...baseConfig, particleStyle: "星光" }, 2, 12).clipPath).toContain("polygon");
    expect(getAnimationVisualStyle({ animationStyle: "弹跳徽记" }).borderRadius).toBe("999px");
  });
});
