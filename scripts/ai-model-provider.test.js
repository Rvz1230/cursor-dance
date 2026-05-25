import { describe, expect, it, vi } from "vitest";

import {
  generateSchemePatchWithModel,
  generateSchemePatchWithModelStreaming,
  hasConfiguredModelProvider,
} from "./ai-model-provider.mjs";

const requestState = {
  prompt: "低调蓝色，不要声音",
  actionId: "leftClick",
  actionLabel: "左键单击",
  currentConfig: {
    particleCount: 18,
    volume: 80,
  },
};

describe("ai-model-provider", () => {
  it("detects configured providers from supported API key env vars", () => {
    expect(hasConfiguredModelProvider({})).toBe(false);
    expect(hasConfiguredModelProvider({ OPENAI_API_KEY: "sk-test" })).toBe(true);
    expect(hasConfiguredModelProvider({ CURSORDANCE_AI_API_KEY: "provider-key" })).toBe(true);
  });

  it("normalizes Responses API JSON output through the patch sanitizer", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({
        output_text: JSON.stringify({
          mode: "modify_action",
          scheme: {
            name: "低干扰蓝色方案",
            summary: "适合专注场景的轻量反馈。",
            styleTags: ["低调", "蓝色"],
            rationale: "关闭声音并限制粒子强度。",
          },
          targets: [
            {
              type: "action",
              actionId: "leftClick",
              label: "左键单击",
              patch: {
                textColor: "0284c7",
                particleCount: 999,
                unsafeField: "nope",
              },
            },
          ],
          reply: "已调整为低干扰方案。",
          diffSummary: ["主色调整为蓝色"],
          riskLevel: "low",
          warnings: [],
          tuningOptions: ["更低调", "更明显"],
        }),
      }),
    }));

    const result = await generateSchemePatchWithModel(requestState, {
      OPENAI_API_KEY: "sk-test",
      CURSORDANCE_AI_API_BASE_URL: "https://api.openai.test/v1",
      CURSORDANCE_AI_MODEL: "test-model",
      CURSORDANCE_AI_MAX_OUTPUT_TOKENS: "600",
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.openai.test/v1/responses",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"max_output_tokens":600'),
      })
    );
    expect(result.source).toBe("model-responses-api");
    expect(result.scheme.name).toBe("低干扰蓝色方案");
    expect(result.target).toEqual({ type: "action", actionId: "leftClick", label: "左键单击" });
    expect(result.riskLevel).toBe("low");
    expect(result.patch).toEqual({
      textColor: "#0284C7",
      particleCount: 40,
      sound: false,
      volume: 0,
    });

    globalThis.fetch = originalFetch;
  });

  it("supports OpenAI-compatible chat completions JSON mode", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                intent: "modify_action",
                scheme: {
                  name: "静音点击方案",
                  summary: "关闭声音，保留轻反馈。",
                  styleTags: ["静音"],
                  rationale: "避免音效打扰。",
                },
                targets: [
                  { type: "action", actionId: "leftClick", label: "左键单击", patch: { sound: false, volume: 0 } },
                ],
                reply: "已关闭声音。",
                diffSummary: ["关闭音效"],
                riskLevel: "low",
                warnings: [],
                tuningOptions: ["加一点波纹"],
              }),
            },
          },
        ],
      }),
    }));

    const result = await generateSchemePatchWithModel(requestState, {
      CURSORDANCE_AI_API_KEY: "provider-key",
      CURSORDANCE_AI_API_BASE_URL: "https://provider.test/v1",
      CURSORDANCE_AI_API_MODE: "chat_completions",
      CURSORDANCE_AI_MODEL: "provider-model",
      CURSORDANCE_AI_MAX_OUTPUT_TOKENS: "700",
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://provider.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"max_tokens":700'),
      })
    );
    expect(result.source).toBe("model-chat-completions");
    expect(result.patch).toEqual({ sound: false, volume: 0 });

    globalThis.fetch = originalFetch;
  });

  it("streams partial reply text via onProgress during model generation", async () => {
    const originalFetch = globalThis.fetch;
    const progressCalls = [];

    const innerJson = JSON.stringify({
      mode: "modify_action",
      scheme: { name: "低干扰方案", summary: "减少干扰。", styleTags: ["低调"], rationale: "测试理由。" },
      targets: [{ type: "action", actionId: "leftClick", label: "左键单击", patch: { sound: false, volume: 0 } }],
      reply: "已调整为低噪音反馈。",
      diffSummary: ["关闭音效"],
      riskLevel: "low",
      warnings: [],
      tuningOptions: ["更低调", "更明显"],
    });

    // Split the inner JSON into two parts to test progressive accumulation
    const splitAt = Math.floor(innerJson.length * 0.45);
    const part1 = innerJson.slice(0, splitAt);
    const part2 = innerJson.slice(splitAt);

    const sse1 = `data: ${JSON.stringify({ type: "response.output_text.delta", delta: part1 })}\n\n`;
    const sse2 = `data: ${JSON.stringify({ type: "response.output_text.delta", delta: part2 })}\n\n`;

    let chunkIndex = 0;
    const chunks = [sse1, sse2];
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      body: new ReadableStream({
        pull(controller) {
          if (chunkIndex < chunks.length) {
            controller.enqueue(new TextEncoder().encode(chunks[chunkIndex]));
            chunkIndex++;
          } else {
            controller.close();
          }
        },
      }),
    }));

    const result = await generateSchemePatchWithModelStreaming(
      { ...requestState, prompt: "低干扰方案" },
      { OPENAI_API_KEY: "sk-test", CURSORDANCE_AI_API_BASE_URL: "https://api.openai.test/v1", CURSORDANCE_AI_MODEL: "test-model" },
      (reply) => { progressCalls.push(reply); }
    );

    expect(progressCalls.length).toBeGreaterThanOrEqual(1);
    expect(progressCalls[progressCalls.length - 1]).toContain("低噪音");
    expect(result.source).toContain("streaming");
    expect(result.patch).toMatchObject({ sound: false, volume: 0 });

    globalThis.fetch = originalFetch;
  });
});
