import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAiRequestErrorMessage } from "../src/errors.js";

describe("getAiRequestErrorMessage", () => {
  it("returns timeout message", () => {
    assert.equal(
      getAiRequestErrorMessage({ code: "timeout" }),
      "AI 请求超时，请稍后重试。",
    );
  });

  it("returns network message", () => {
    assert.equal(
      getAiRequestErrorMessage({ code: "network" }),
      "后端未连接，请确认 AI API 服务已启动。",
    );
  });

  it("returns auth error for 401/403", () => {
    assert.equal(
      getAiRequestErrorMessage({ status: 401 }),
      "AI API 权限校验失败，请检查访问 token。",
    );
    assert.equal(
      getAiRequestErrorMessage({ status: 403 }),
      "AI API 权限校验失败，请检查访问 token。",
    );
  });

  it("returns body size error for 400/413/invalid_request", () => {
    const msg = getAiRequestErrorMessage({ status: 400, code: "invalid_request", message: "" });
    assert.ok(msg.includes("超出限制"));
  });

  it("returns invalid schema error for 422", () => {
    const msg = getAiRequestErrorMessage({ status: 422 });
    assert.ok(msg.includes("结构无效"));
  });

  it("returns provider error for 502/503", () => {
    const msg = getAiRequestErrorMessage({ status: 502, code: "provider_failed", message: "" });
    assert.ok(msg.includes("暂时失败"));
  });

  it("returns error message from Error instance", () => {
    assert.equal(
      getAiRequestErrorMessage(new Error("custom error")),
      "custom error",
    );
  });

  it("returns fallback for unknown errors", () => {
    const msg = getAiRequestErrorMessage({ code: "unknown_error", message: "" });
    assert.ok(msg.includes("生成失败"));
  });
});
