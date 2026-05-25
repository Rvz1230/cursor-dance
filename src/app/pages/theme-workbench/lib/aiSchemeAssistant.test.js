import { describe, expect, it } from "vitest";

import { createThemeDraft } from "../model/workbenchSchema.js";
import {
  ANIMATION_STYLE_OPTIONS,
  PARTICLE_STYLE_OPTIONS,
  RIPPLE_STYLE_OPTIONS,
} from "../model/actionConfigOptions.js";
import {
  AI_EXTENSION_VERSION,
  AI_SCHEMA_VERSION,
  buildAiProposalContext,
  buildAiSchemeDiffItems,
  getAiRequestErrorMessage,
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

  it("sends only slim request context to the remote AI API", async () => {
    const originalWindow = globalThis.window;
    let requestBody = null;
    globalThis.window = {
      fetch: async (_url, options) => {
        requestBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            schemaVersion: AI_SCHEMA_VERSION,
            mode: "tune_proposal",
            targets: [{ type: "action", actionId: "leftClick", label: "左键单击", patch: { sound: false } }],
            reply: "已微调。",
          }),
        };
      },
      setTimeout,
      clearTimeout,
    };

    await requestAiSchemeEdit({
      prompt: "再低调一点",
      actionId: "leftClick",
      actionLabel: "左键单击",
      currentConfig: getBaseConfig(),
      taskMode: "tune_proposal",
      proposalContext: {
        proposalId: "proposal-1",
        messages: [{ role: "user", content: "不应该发送完整聊天记录" }],
        targets: [{ type: "action", actionId: "leftClick", label: "左键单击", patch: { sound: true, unsafe: true } }],
        diffItems: [{ before: "large" }],
      },
    });

    expect(requestBody).toMatchObject({
      prompt: "再低调一点",
      extensionVersion: AI_EXTENSION_VERSION,
      schemaVersion: AI_SCHEMA_VERSION,
      taskMode: "tune_proposal",
    });
    expect(requestBody.messages).toBeUndefined();
    expect(requestBody.proposalContext.messages).toBeUndefined();
    expect(requestBody.proposalContext.diffItems).toBeUndefined();
    expect(requestBody.proposalContext.targets[0].patch).toEqual({ sound: true });

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

  it("repairs core user intents when the model misses required patch fields", () => {
    const cases = [
      {
        prompt: "改成文本飘字",
        patch: {},
        expected: { textEnabled: true, textKind: "文本飘字", comboEnabled: false },
      },
      {
        prompt: "关闭声音",
        patch: {},
        expected: { sound: false, volume: 0 },
      },
      {
        prompt: "粒子少一点",
        patch: {},
        currentConfig: { particle: true, particleCount: 24, particleOpacity: 80 },
        expected: { particle: true, particleCount: 12, particleOpacity: 55 },
      },
      {
        prompt: "关闭粒子",
        patch: {},
        expected: { particle: false, particleCount: 0 },
      },
      {
        prompt: "只保留波纹",
        patch: {},
        expected: {
          textEnabled: false,
          particle: false,
          particleCount: 0,
          ripple: true,
          sound: false,
          volume: 0,
          animationEnabled: false,
          imageEnabled: false,
        },
      },
      {
        prompt: "不要震动",
        patch: {},
        expected: { shake: 0 },
      },
      {
        prompt: "关闭波纹",
        patch: {},
        expected: { ripple: false },
      },
      {
        prompt: "不要动画",
        patch: {},
        expected: { animationEnabled: false },
      },
      {
        prompt: "不要图像",
        patch: {},
        expected: { imageEnabled: false },
      },
      {
        prompt: "关闭连击",
        patch: {},
        expected: { comboEnabled: false },
      },
      {
        prompt: "柔和一点",
        patch: {},
        currentConfig: { particleOpacity: 80, rippleOpacity: 70, textOpacity: 90 },
        expected: { particleOpacity: 48, rippleOpacity: 42, textOpacity: 63, textEasing: "缓出", rippleEasing: "缓出" },
      },
      {
        prompt: "更明显一点",
        patch: {},
        currentConfig: { particleCount: 20, particleOpacity: 70, rippleOpacity: 60 },
        expected: { particleCount: 28, particleOpacity: 91, rippleOpacity: 78, textOpacity: 95 },
      },
      {
        prompt: "光标大一点",
        patch: {},
        currentConfig: { cursorSize: 40 },
        expected: { cursorSize: 52 },
      },
      {
        prompt: "光标小一点",
        patch: {},
        currentConfig: { cursorSize: 48 },
        expected: { cursorSize: 36 },
      },
      {
        prompt: "波纹小一点",
        patch: {},
        currentConfig: { rippleSize: 80 },
        expected: { ripple: true, rippleSize: 48 },
      },
    ];

    for (const item of cases) {
      const proposal = normalizeAiSchemeProposal(
        {
          mode: "modify_action",
          targets: [{ type: "action", actionId: "leftClick", label: "左键单击", patch: item.patch }],
          reply: "已调整。",
        },
        {
          prompt: item.prompt,
          actionId: "leftClick",
          actionLabel: "左键单击",
          currentConfig: item.currentConfig || getBaseConfig(),
        }
      );

      expect(proposal.patch).toMatchObject(item.expected);
    }
  });

  it("classifies user-facing AI request errors", () => {
    expect(getAiRequestErrorMessage({ code: "network" })).toContain("后端未连接");
    expect(getAiRequestErrorMessage({ code: "timeout" })).toContain("超时");
    expect(getAiRequestErrorMessage({ status: 401 })).toContain("权限");
    expect(getAiRequestErrorMessage({ status: 422 })).toContain("结构无效");
    expect(getAiRequestErrorMessage({ status: 502, message: "DeepSeek failed" })).toContain("DeepSeek");
  });

  it("builds a bounded proposal context without chat history", () => {
    const context = buildAiProposalContext({
      proposalId: "proposal-1",
      schemaVersion: AI_SCHEMA_VERSION,
      mode: "modify_action",
      messages: [{ role: "user", content: "full chat" }],
      targets: [{ type: "action", actionId: "leftClick", label: "左键单击", patch: { sound: false, unknown: true } }],
      diffSummary: ["关闭音效"],
    });

    expect(context).toEqual({
      proposalId: "proposal-1",
      schemaVersion: AI_SCHEMA_VERSION,
      mode: "modify_action",
      scheme: undefined,
      targets: [{ type: "action", actionId: "leftClick", label: "左键单击", patch: { sound: false } }],
      diffSummary: ["关闭音效"],
    });
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

  it("accepts all particleStyle, rippleStyle, and animationStyle options from the canonical source", () => {
    for (const value of PARTICLE_STYLE_OPTIONS) {
      const result = sanitizeAiSchemePatch({ particleStyle: value });
      expect(result.particleStyle).toBe(value);
    }
    for (const value of RIPPLE_STYLE_OPTIONS) {
      const result = sanitizeAiSchemePatch({ rippleStyle: value });
      expect(result.rippleStyle).toBe(value);
    }
    for (const value of ANIMATION_STYLE_OPTIONS) {
      const result = sanitizeAiSchemePatch({ animationStyle: value });
      expect(result.animationStyle).toBe(value);
    }
  });
});
