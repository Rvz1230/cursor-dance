import { describe, expect, it } from "vitest";

import { createThemeDraft } from "../model/workbenchSchema.js";
import { createLocalAiSchemeResponse } from "./aiSchemeAssistant.js";

function getBaseConfig() {
  return createThemeDraft("woodfish").actionConfigs.leftClick;
}

describe("aiSchemeAssistant", () => {
  it("turns a minimal coding prompt into a low-noise executable patch", () => {
    const result = createLocalAiSchemeResponse({
      prompt: "适合写代码的简约蓝色点击效果，不要声音，粒子少一点",
      currentConfig: getBaseConfig(),
      actionLabel: "左键单击",
    });

    expect(result.intent).toBe("generate_or_modify_scheme");
    expect(result.patch.sound).toBe(false);
    expect(result.patch.volume).toBe(0);
    expect(result.patch.textColor).toBe("#0284C7");
    expect(result.patch.particle).toBe(true);
    expect(result.nextConfig.sound).toBe(false);
    expect(result.nextConfig.particleCount).toBeLessThanOrEqual(8);
    expect(result.diffSummary.length).toBeGreaterThan(0);
  });

  it("can strengthen an existing effect without exceeding model boundaries", () => {
    const result = createLocalAiSchemeResponse({
      prompt: "更明显一点，录屏时要看得清楚",
      currentConfig: getBaseConfig(),
      actionLabel: "左键单击",
    });

    expect(result.patch.textEnabled).toBe(true);
    expect(result.patch.particle).toBe(true);
    expect(result.patch.ripple).toBe(true);
    expect(result.nextConfig.particleCount).toBeLessThanOrEqual(40);
    expect(result.nextConfig.rippleSize).toBeLessThanOrEqual(140);
    expect(result.nextConfig.volume).toBeLessThanOrEqual(100);
  });

  it("keeps user requests for no text and no particles explicit", () => {
    const result = createLocalAiSchemeResponse({
      prompt: "不要飘字，也不要粒子，只保留轻微波纹",
      currentConfig: getBaseConfig(),
      actionLabel: "左键单击",
    });

    expect(result.patch.textEnabled).toBe(false);
    expect(result.patch.particle).toBe(false);
    expect(result.patch.particleCount).toBe(0);
    expect(result.patch.ripple).toBe(true);
    expect(result.nextConfig.textEnabled).toBe(false);
  });
});
