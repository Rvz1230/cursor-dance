import { describe, expect, it, vi } from "vitest";

import {
  generateSchemePatchWithModel,
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
          reply: "已调整为低干扰方案。",
          patch: {
            textColor: "0284c7",
            particleCount: 999,
            unsafeField: "nope",
          },
          diffSummary: ["主色调整为蓝色"],
        }),
      }),
    }));

    const result = await generateSchemePatchWithModel(requestState, {
      OPENAI_API_KEY: "sk-test",
      CURSORDANCE_AI_API_BASE_URL: "https://api.openai.test/v1",
      CURSORDANCE_AI_MODEL: "test-model",
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.openai.test/v1/responses",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.source).toBe("model-responses-api");
    expect(result.patch).toEqual({
      textColor: "#0284C7",
      particleCount: 40,
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
                reply: "已关闭声音。",
                patch: { sound: false, volume: 0 },
                diffSummary: ["关闭音效"],
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
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://provider.test/v1/chat/completions",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.source).toBe("model-chat-completions");
    expect(result.patch).toEqual({ sound: false, volume: 0 });

    globalThis.fetch = originalFetch;
  });
});
