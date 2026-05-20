import { describe, expect, it } from "vitest";

import { createThemeDraft } from "../model/workbenchSchema.js";
import {
  buildAiSchemeDiffItems,
  getAiProposalPatchForAction,
  getAiPatchSanitizeMeta,
  normalizeAiSchemeProposal,
  requestAiSchemeEdit,
  sanitizeAiSchemePatch,
  validateAiSchemeRequest,
} from "./aiSchemeAssistant.js";

function getBaseConfig() {
  return createThemeDraft("woodfish").actionConfigs.leftClick;
}

describe("aiSchemeAssistant", () => {
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

  it("preserves the selected AI task mode in validated requests", () => {
    const valid = validateAiSchemeRequest({
      prompt: "解释当前配置",
      actionId: "leftClick",
      taskMode: "explain_config",
      currentConfig: getBaseConfig(),
    });

    expect(valid.ok).toBe(true);
    expect(valid.value.taskMode).toBe("explain_config");
  });

  it("requires the remote AI API instead of falling back to local rules", async () => {
    const originalWindow = globalThis.window;
    globalThis.window = {
      fetch: async () => ({
        ok: false,
        status: 503,
        json: async () => ({ error: "AI model provider is not configured" }),
      }),
      setTimeout,
      clearTimeout,
    };

    await expect(requestAiSchemeEdit({
      prompt: "低调蓝色，不要声音",
      actionId: "leftClick",
      actionLabel: "左键单击",
      currentConfig: getBaseConfig(),
      taskMode: "modify_action",
    })).rejects.toThrow("AI model provider is not configured");

    globalThis.window = originalWindow;
  });

  it("normalizes AI responses into proposal contract", () => {
    const proposal = normalizeAiSchemeProposal(
      {
        mode: "generate_theme",
        scheme: {
          name: "低调科技方案",
          summary: "适合写代码的低干扰反馈。",
          styleTags: ["低调", "科技感"],
          rationale: "减少声音和震动，保留轻微视觉反馈。",
        },
        targets: [
          { type: "action", actionId: "leftClick", label: "左键单击", patch: { sound: false, volume: 0 } },
          { type: "action", actionId: "rightClick", label: "右键单击", patch: { particleCount: 999 } },
        ],
        riskLevel: "medium",
        warnings: ["音效将被关闭"],
        reply: "建议关闭音效。",
        tuningOptions: ["更低调", "更明显"],
      },
      {
        actionId: "leftClick",
        actionLabel: "左键单击",
        currentConfig: { sound: true, volume: 78 },
      }
    );

    expect(proposal.proposalId).toBeTruthy();
    expect(proposal.mode).toBe("generate_theme");
    expect(proposal.scheme.name).toBe("低调科技方案");
    expect(proposal.target).toEqual({ type: "action", actionId: "leftClick", label: "左键单击" });
    expect(proposal.targets).toHaveLength(2);
    expect(getAiProposalPatchForAction(proposal, "rightClick")).toEqual({ particleCount: 40 });
    expect(proposal.tuningOptions).toEqual(["更低调", "更明显"]);
    expect(proposal.riskLevel).toBe("medium");
    expect(proposal.warnings).toEqual(["音效将被关闭"]);
    expect(proposal.diffItems).toEqual([
      expect.objectContaining({ fieldName: "sound", beforeLabel: "开启", afterLabel: "关闭" }),
      expect.objectContaining({ fieldName: "volume", beforeLabel: "78", afterLabel: "0" }),
    ]);
  });

  it("repairs numeric plus-one intent when the model misses required text fields", () => {
    const proposal = normalizeAiSchemeProposal(
      {
        mode: "modify_action",
        targets: [
          { type: "action", actionId: "leftClick", label: "左键单击", patch: { textContent: "+1" } },
        ],
        reply: "已切换为数字 +1。",
      },
      {
        prompt: "把当前方案换成数字+1模式",
        actionId: "leftClick",
        actionLabel: "左键单击",
        currentConfig: { textEnabled: true, textKind: "文本飘字", textMode: "模板模式", textContent: "nice" },
      }
    );

    expect(proposal.patch).toMatchObject({
      textEnabled: true,
      textKind: "数字飘字",
      textStyle: "阿拉伯数字 (1, 2, 3)",
      textMode: "默认模式 (+1)",
      textContent: "+1",
      textTemplate: "${number}",
      textTags: [],
      comboEnabled: false,
    });
    expect(proposal.nextConfig.textKind).toBe("数字飘字");
    expect(proposal.nextConfig.textMode).toBe("默认模式 (+1)");
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
