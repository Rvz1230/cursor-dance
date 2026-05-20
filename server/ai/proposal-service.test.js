import { describe, expect, it, vi } from "vitest";

import {
  createAiSchemeProposal,
  getAiRequestLimits,
  getAiRequestMetrics,
  getAiServiceHealth,
  validateAiApiAccess,
} from "./proposal-service.mjs";

const requestPayload = {
  prompt: "把当前方案换成数字+1模式",
  actionId: "leftClick",
  actionLabel: "左键单击",
  taskMode: "modify_action",
  extensionVersion: "0.1.0",
  schemaVersion: "2026-05-20",
  currentConfig: {
    textKind: "文本飘字",
    textMode: "模板模式",
    textContent: "nice",
  },
};

describe("proposal-service", () => {
  it("reports model provider health without exposing secrets", () => {
    expect(getAiServiceHealth({
      CURSORDANCE_AI_API_KEY: "secret",
      CURSORDANCE_AI_API_MODE: "chat_completions",
      CURSORDANCE_AI_MODEL: "deepseek-chat",
    })).toMatchObject({
      ok: true,
      service: "cursor-dance-ai-api",
      modelProviderConfigured: true,
      mode: "chat_completions",
      model: "deepseek-chat",
    });
  });

  it("builds privacy-safe request metrics without prompt or config body", () => {
    const metrics = getAiRequestMetrics(requestPayload, null, {
      rawBodyLength: 1234,
      status: 200,
      durationMs: 88,
      targetCount: 2,
      droppedFieldCount: 1,
    });

    expect(metrics).toMatchObject({
      mode: "modify_action",
      schemaVersion: "2026-05-20",
      extensionVersion: "0.1.0",
      promptChars: requestPayload.prompt.length,
      rawBodyBytes: 1234,
      status: 200,
      durationMs: 88,
      targetCount: 2,
      droppedFieldCount: 1,
    });
    expect(JSON.stringify(metrics)).not.toContain(requestPayload.prompt);
    expect(JSON.stringify(metrics)).not.toContain("nice");
  });

  it("supports configurable request size limits", () => {
    expect(getAiRequestLimits({
      CURSORDANCE_AI_MAX_REQUEST_BYTES: "1024",
      CURSORDANCE_AI_MAX_PROMPT_CHARS: "200",
      CURSORDANCE_AI_MAX_CURRENT_CONFIG_BYTES: "512",
      CURSORDANCE_AI_MAX_PROPOSAL_CONTEXT_BYTES: "256",
    })).toEqual({
      maxRequestBytes: 1024,
      maxPromptChars: 200,
      maxCurrentConfigBytes: 512,
      maxProposalContextBytes: 256,
    });
  });

  it("rejects requests when the model provider is not configured", async () => {
    const result = await createAiSchemeProposal(requestPayload, { env: {} });

    expect(result.status).toBe(503);
    expect(result.body.error).toBe("AI model provider is not configured");
  });

  it("creates a sanitized AI proposal through chat completions", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                mode: "modify_action",
                scheme: {
                  name: "数字点击方案",
                  summary: "切换为数字 +1。",
                  styleTags: ["数字"],
                  rationale: "符合用户的数字反馈诉求。",
                },
                targets: [
                  { type: "action", actionId: "leftClick", label: "左键单击", patch: { textContent: "+1" } },
                ],
                reply: "已切换为数字 +1 模式。",
                diffSummary: ["切换为数字 +1"],
                riskLevel: "low",
                warnings: [],
                tuningOptions: ["开启连击累加"],
              }),
            },
          },
        ],
      }),
    }));

    const result = await createAiSchemeProposal(requestPayload, {
      env: {
        CURSORDANCE_AI_API_KEY: "provider-key",
        CURSORDANCE_AI_API_BASE_URL: "https://provider.test/v1",
        CURSORDANCE_AI_API_MODE: "chat_completions",
        CURSORDANCE_AI_MODEL: "provider-model",
      },
    });

    expect(result.status).toBe(200);
    expect(result.body.source).toBe("model-chat-completions");
    expect(result.body.schemaVersion).toBe("2026-05-20");
    expect(result.body.patch).toMatchObject({
      textEnabled: true,
      textKind: "数字飘字",
      textMode: "默认模式 (+1)",
      textContent: "+1",
    });

    globalThis.fetch = originalFetch;
  });

  it("rejects oversized proposal context before calling the model", async () => {
    const result = await createAiSchemeProposal({
      ...requestPayload,
      proposalContext: { summary: "x".repeat(9 * 1024) },
    }, {
      env: { CURSORDANCE_AI_API_KEY: "provider-key" },
    });

    expect(result.status).toBe(400);
    expect(result.body.code).toBe("invalid_request");
    expect(result.body.details).toContain("proposalContext is too large");
  });

  it("rejects oversized current config before calling the model", async () => {
    const result = await createAiSchemeProposal({
      ...requestPayload,
      currentConfig: { textContent: "x".repeat(1024) },
    }, {
      env: {
        CURSORDANCE_AI_API_KEY: "provider-key",
        CURSORDANCE_AI_MAX_CURRENT_CONFIG_BYTES: "128",
      },
    });

    expect(result.status).toBe(413);
    expect(result.body.code).toBe("invalid_request");
    expect(result.body.details).toContain("currentConfig is too large");
  });

  it("supports an optional shared access token guard", () => {
    expect(validateAiApiAccess({
      headers: { authorization: "Bearer expected" },
      env: { CURSORDANCE_AI_API_ACCESS_TOKEN: "expected" },
    }).ok).toBe(true);

    expect(validateAiApiAccess({
      headers: { authorization: "Bearer wrong" },
      env: { CURSORDANCE_AI_API_ACCESS_TOKEN: "expected" },
    })).toMatchObject({ ok: false, status: 401 });
  });
});
