import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";
import { createApp } from "../src/server.mjs";

describe("AI HTTP request body boundary", () => {
  let server;
  let port;
  const previousLimit = process.env.CURSORDANCE_AI_MAX_REQUEST_BYTES;

  before(async () => {
    process.env.CURSORDANCE_AI_MAX_REQUEST_BYTES = "1024";
    server = createApp();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = server.address().port;
  });

  after(async () => {
    if (previousLimit === undefined) delete process.env.CURSORDANCE_AI_MAX_REQUEST_BYTES;
    else process.env.CURSORDANCE_AI_MAX_REQUEST_BYTES = previousLimit;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it("rejects an oversized chunked body before JSON/service processing", async () => {
    const statusCode = await new Promise((resolve, reject) => {
      const request = http.request({
        host: "127.0.0.1",
        port,
        path: "/api/ai/scheme-proposals",
        method: "POST",
        headers: { "content-type": "application/json" },
      }, (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode));
      });
      request.on("error", reject);
      request.write('{"prompt":"');
      request.write("x".repeat(2048));
      request.end('","currentConfig":{}}');
    });

    assert.equal(statusCode, 413);
  });

  it("rejects and drains a body whose declared content length is oversized", async () => {
    const payload = JSON.stringify({ prompt: "x".repeat(2048), currentConfig: {} });
    const statusCode = await new Promise((resolve, reject) => {
      const request = http.request({
        host: "127.0.0.1",
        port,
        path: "/api/ai/scheme-proposals",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
        },
      }, (response) => {
        response.resume();
        response.on("end", () => resolve(response.statusCode));
      });
      request.on("error", reject);
      request.end(payload);
    });

    assert.equal(statusCode, 413);
  });
});
