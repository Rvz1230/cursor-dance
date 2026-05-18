import { describe, expect, it } from "vitest";

import { createThemeDraft } from "../model/workbenchSchema.js";
import {
  buildAiSchemeDiffItems,
  createLocalAiSchemeResponse,
  getAiPatchSanitizeMeta,
  normalizeAiSchemeProposal,
  sanitizeAiSchemePatch,
  validateAiSchemeRequest,
} from "./aiSchemeAssistant.js";

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

    expect(result.intent).toBe("modify_action");
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

  it("sanitizes AI patches before they can touch workbench config", () => {
    const rawPatch = {
      textColor: "0284c7",
      particleCount: 999,
      sound: "false",
      soundFile: "unknown.wav",
      textTags: ["focus", "", 42, "ship"],
      unsafeField: "ignore me",
    };
    const patch = sanitizeAiSchemePatch(rawPatch);

    expect(patch).toEqual({
      textColor: "#0284C7",
      particleCount: 40,
      textTags: ["focus", "ship"],
    });
    expect(getAiPatchSanitizeMeta(rawPatch, patch)).toMatchObject({
      rawFieldCount: 6,
      acceptedFieldCount: 3,
      droppedFieldCount: 3,
      droppedFields: ["sound", "soundFile", "unsafeField"],
    });
  });

  it("validates required AI request shape", () => {
    const invalid = validateAiSchemeRequest({ prompt: "" });
    const valid = validateAiSchemeRequest({
      prompt: "帮我做一个低调的蓝色效果",
      actionId: "leftClick",
      currentConfig: getBaseConfig(),
    });

    expect(invalid.ok).toBe(false);
    expect(invalid.errors).toContain("prompt is required");
    expect(valid.ok).toBe(true);
    expect(valid.value.actionId).toBe("leftClick");
  });

  it("normalizes AI responses into proposal contract", () => {
    const proposal = normalizeAiSchemeProposal(
      {
        intent: "modify_action",
        target: { type: "action", actionId: "leftClick", label: "左键单击" },
        riskLevel: "medium",
        warnings: ["音效将被关闭"],
        patch: { sound: false, volume: 0 },
        reply: "建议关闭音效。",
      },
      {
        actionId: "leftClick",
        actionLabel: "左键单击",
        currentConfig: { sound: true, volume: 78 },
      }
    );

    expect(proposal.proposalId).toBeTruthy();
    expect(proposal.target).toEqual({ type: "action", actionId: "leftClick", label: "左键单击" });
    expect(proposal.riskLevel).toBe("medium");
    expect(proposal.warnings).toEqual(["音效将被关闭"]);
    expect(proposal.diffItems).toEqual([
      expect.objectContaining({ fieldName: "sound", beforeLabel: "开启", afterLabel: "关闭" }),
      expect.objectContaining({ fieldName: "volume", beforeLabel: "78", afterLabel: "0" }),
    ]);
  });

  it("builds readable diff items for pending AI changes", () => {
    const diffItems = buildAiSchemeDiffItems(
      { sound: true, volume: 78, textColor: "#B45309", particleCount: 18 },
      { sound: false, volume: 0, textColor: "#0284C7", particleCount: 8 }
    );

    expect(diffItems).toEqual([
      expect.objectContaining({ fieldName: "sound", label: "音效", beforeLabel: "开启", afterLabel: "关闭" }),
      expect.objectContaining({ fieldName: "volume", label: "音量", beforeLabel: "78", afterLabel: "0" }),
      expect.objectContaining({ fieldName: "textColor", label: "主色", beforeLabel: "#B45309", afterLabel: "#0284C7" }),
      expect.objectContaining({ fieldName: "particleCount", label: "粒子数量", beforeLabel: "18", afterLabel: "8" }),
    ]);
  });
});
