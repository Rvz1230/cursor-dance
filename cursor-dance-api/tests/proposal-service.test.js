import { describe, it } from "node:test";
import assert from "node:assert";
import {
  getAiRequestLimits,
  getAiRequestMetrics,
  getAiServiceHealth,
  getAllowedOrigins,
  buildCorsHeaders,
  validateAiApiAccess,
  serializeAiProposal,
} from "../src/proposal-service.mjs";

describe("getAiRequestLimits", () => {
  it("returns defaults when no env is set", () => {
    const limits = getAiRequestLimits({});
    assert.equal(limits.maxRequestBytes, 50 * 1024);
    assert.equal(limits.maxPromptChars, 1200);
    assert.equal(limits.maxCurrentConfigBytes, 24 * 1024);
    assert.equal(limits.maxProposalContextBytes, 8 * 1024);
  });

  it("reads custom values from env", () => {
    const limits = getAiRequestLimits({
      CURSORDANCE_AI_MAX_REQUEST_BYTES: "100000",
      CURSORDANCE_AI_MAX_PROMPT_CHARS: "500",
    });
    assert.equal(limits.maxRequestBytes, 100000);
    assert.equal(limits.maxPromptChars, 500);
    // defaults still apply for unset
    assert.equal(limits.maxCurrentConfigBytes, 24 * 1024);
  });

  it("ignores non-positive values and falls back to defaults", () => {
    const limits = getAiRequestLimits({
      CURSORDANCE_AI_MAX_REQUEST_BYTES: "0",
      CURSORDANCE_AI_MAX_PROMPT_CHARS: "-1",
    });
    assert.equal(limits.maxRequestBytes, 50 * 1024);
    assert.equal(limits.maxPromptChars, 1200);
  });
});

describe("getAiRequestMetrics", () => {
  it("returns base metrics for empty payload", () => {
    const metrics = getAiRequestMetrics({});
    assert.equal(metrics.mode, "modify_action");
    assert.equal(metrics.promptChars, 0);
    assert.equal(metrics.currentConfigBytes, 2); // "{}"
    assert.equal(metrics.proposalContextBytes, 0);
  });

  it("captures prompt and config sizes", () => {
    const metrics = getAiRequestMetrics({
      prompt: "hello world",
      currentConfig: { textEnabled: true, particle: false },
    });
    assert.equal(metrics.promptChars, 11);
    assert.ok(metrics.currentConfigBytes > 10);
  });

  it("reads taskMode from requestState first, then payload", () => {
    const a = getAiRequestMetrics({ taskMode: "create_theme" });
    assert.equal(a.mode, "create_theme");

    const b = getAiRequestMetrics(
      { taskMode: "wrong" },
      { value: { taskMode: "modify_action" } }
    );
    assert.equal(b.mode, "modify_action");
  });

  it("includes extra fields", () => {
    const metrics = getAiRequestMetrics({}, null, {
      rawBodyLength: 1024,
      targetCount: 3,
      droppedFieldCount: 1,
      durationMs: 420,
      status: 200,
      errorCode: "",
    });
    assert.equal(metrics.rawBodyBytes, 1024);
    assert.equal(metrics.targetCount, 3);
    assert.equal(metrics.droppedFieldCount, 1);
    assert.equal(metrics.durationMs, 420);
  });
});

describe("getAiServiceHealth", () => {
  it("returns ok with provider unconfigured by default", () => {
    const health = getAiServiceHealth({});
    assert.equal(health.ok, true);
    assert.equal(health.service, "cursor-dance-ai-api");
    assert.equal(health.modelProviderConfigured, false);
    assert.equal(health.mode, "chat_completions");
  });

  it("detects configured model provider", () => {
    const health = getAiServiceHealth({ CURSORDANCE_AI_API_KEY: "sk-test" });
    assert.equal(health.modelProviderConfigured, true);
  });

  it("reports custom mode and model", () => {
    const health = getAiServiceHealth({
      CURSORDANCE_AI_API_KEY: "sk-test",
      CURSORDANCE_AI_API_MODE: "responses",
      CURSORDANCE_AI_MODEL: "gpt-4.1-mini",
    });
    assert.equal(health.mode, "responses");
    assert.equal(health.model, "gpt-4.1-mini");
  });
});

describe("getAllowedOrigins", () => {
  it("returns defaults when env is empty", () => {
    const origins = getAllowedOrigins({});
    assert.ok(origins.includes("http://localhost:5173"));
    assert.ok(origins.includes("http://127.0.0.1:5173"));
  });

  it("parses comma-separated origins", () => {
    const origins = getAllowedOrigins({
      CURSORDANCE_ALLOWED_ORIGINS: "https://example.com,chrome-extension://abc123",
    });
    assert.deepStrictEqual(origins, ["https://example.com", "chrome-extension://abc123"]);
  });

  it("handles wildcard", () => {
    const origins = getAllowedOrigins({ CURSORDANCE_ALLOWED_ORIGINS: "*" });
    assert.deepStrictEqual(origins, ["*"]);
  });
});

describe("buildCorsHeaders", () => {
  it("returns first allowed origin when no origin match", () => {
    const headers = buildCorsHeaders({ origin: "https://unknown.com" });
    assert.equal(headers["Access-Control-Allow-Origin"], "http://localhost:5173");
    assert.equal(headers["Access-Control-Allow-Methods"], "GET,POST,OPTIONS");
    assert.equal(headers["Access-Control-Max-Age"], "86400");
  });

  it("matches provided origin when in allowlist", () => {
    const headers = buildCorsHeaders({
      origin: "http://localhost:5173",
      env: { CURSORDANCE_ALLOWED_ORIGINS: "http://localhost:5173,https://app.example.com" },
    });
    assert.equal(headers["Access-Control-Allow-Origin"], "http://localhost:5173");
  });

  it("uses wildcard when * is in allowlist", () => {
    const headers = buildCorsHeaders({
      origin: "https://anything.com",
      env: { CURSORDANCE_ALLOWED_ORIGINS: "*" },
    });
    assert.equal(headers["Access-Control-Allow-Origin"], "*");
  });
});

describe("validateAiApiAccess", () => {
  it("allows access when no token is configured", () => {
    const result = validateAiApiAccess({ headers: {}, rawBodyLength: 100, env: {} });
    assert.equal(result.ok, true);
  });

  it("rejects oversized body", () => {
    const result = validateAiApiAccess({ headers: {}, rawBodyLength: 60 * 1024, env: {} });
    assert.equal(result.ok, false);
    assert.equal(result.status, 413);
  });

  it("rejects missing token when token is configured", () => {
    const result = validateAiApiAccess({
      headers: {},
      rawBodyLength: 100,
      env: { CURSORDANCE_AI_API_ACCESS_TOKEN: "secret" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
  });

  it("rejects wrong token", () => {
    const result = validateAiApiAccess({
      headers: { authorization: "Bearer wrong" },
      rawBodyLength: 100,
      env: { CURSORDANCE_AI_API_ACCESS_TOKEN: "secret" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
  });

  it("accepts correct Bearer token", () => {
    const result = validateAiApiAccess({
      headers: { authorization: "Bearer secret" },
      rawBodyLength: 100,
      env: { CURSORDANCE_AI_API_ACCESS_TOKEN: "secret" },
    });
    assert.equal(result.ok, true);
  });

  it("accepts correct X-CursorDance-Client header", () => {
    const result = validateAiApiAccess({
      headers: { "x-cursordance-client": "secret" },
      rawBodyLength: 100,
      env: { CURSORDANCE_AI_API_ACCESS_TOKEN: "secret" },
    });
    assert.equal(result.ok, true);
  });
});

describe("serializeAiProposal", () => {
  it("serializes a full proposal", () => {
    const proposal = {
      proposalId: "abc-123",
      schemaVersion: 2,
      source: "model-chat-completions",
      mode: "modify_action",
      intent: "让点击更炫酷",
      scheme: { name: "测试方案", summary: "测试摘要" },
      target: { actionId: "leftClick" },
      targets: [{ actionId: "leftClick", patch: { textColor: "#ff0000" } }],
      riskLevel: "low",
      warnings: [],
      reply: "已生成方案",
      patch: { textColor: "#ff0000" },
      sanitizeMeta: { droppedFieldCount: 0 },
      diffSummary: ["主色调整为 #ff0000"],
      tuningOptions: ["更低调", "更明显"],
    };

    const result = serializeAiProposal(proposal);
    assert.equal(result.proposalId, "abc-123");
    assert.equal(result.schemaVersion, 2);
    assert.equal(result.mode, "modify_action");
    assert.equal(result.riskLevel, "low");
    assert.deepStrictEqual(result.tuningOptions, ["更低调", "更明显"]);
  });

  it("fills defaults for missing fields", () => {
    const result = serializeAiProposal({ proposalId: "min" });
    assert.equal(result.proposalId, "min");
    assert.equal(result.source, "api");
    assert.equal(typeof result.schemaVersion, "string");
    assert.ok(result.schemaVersion.length > 0);
  });
});

describe("getAiRequestLimits integration", () => {
  it("limits are all positive integers", () => {
    const limits = getAiRequestLimits({});
    for (const [key, value] of Object.entries(limits)) {
      assert.ok(Number.isInteger(value) && value > 0, `${key} should be positive integer, got ${value}`);
    }
  });
});
