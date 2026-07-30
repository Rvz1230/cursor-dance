import { createServer } from "node:http";
import {
  buildCorsHeaders,
  createAiSchemeProposal,
  createAiSchemeProposalStreaming,
  createAiAgentProposal,
  validateAiStreamingRequest,
  getAiServiceHealth,
  validateAiApiAccess,
} from "./proposal-service.mjs";
import { AI_SCHEMA_VERSION } from "./field-defs.js";
import {
  acquireSlot,
  configureRateLimiter,
  getRateLimitMetrics,
  releaseSlot,
} from "./rate-limiter.mjs";

const DEPRECATED_ENDPOINTS = ["/api/ai/modify-scheme", "/api/ai/generate-scheme"];

function sendJson(response, statusCode, payload, origin = "") {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...buildCorsHeaders({ origin }),
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  // FC3: body is pre-buffered as Buffer, string, or parsed object
  if (request.body != null) {
    let raw;
    if (typeof request.body === "string") {
      raw = request.body;
    } else if (typeof request.body === "object" && !Array.isArray(request.body)) {
      // Already parsed JSON object
      return { body: request.body, rawBodyLength: Buffer.byteLength(JSON.stringify(request.body), "utf8") };
    } else {
      // Buffer or other — try to convert
      raw = String(request.body);
    }
    if (!raw.trim()) return { body: {}, rawBodyLength: 0 };
    return { body: JSON.parse(raw), rawBodyLength: Buffer.byteLength(raw, "utf8") };
  }

  // Standard Node HTTP: read from stream
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  if (!buffer.length) return { body: {}, rawBodyLength: 0 };
  return { body: JSON.parse(buffer.toString("utf8")), rawBodyLength: buffer.byteLength };
}

function sendSseHeaders(response, origin = "") {
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-cache, no-transform, must-revalidate",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
    ...buildCorsHeaders({ origin }),
  });
  if (typeof response.flushHeaders === "function") response.flushHeaders();
}

function sendSseEvent(response, event, data) {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function handleAgentRun(request, response) {
  let payload;
  let rawBodyLength = 0;
  try {
    const parsed = await readJsonBody(request);
    payload = parsed.body;
    rawBodyLength = parsed.rawBodyLength;
  } catch {
    sendJson(response, 400, { error: "Invalid JSON body" }, request.headers.origin || "");
    return;
  }

  const access = validateAiApiAccess({ headers: request.headers, rawBodyLength });
  if (!access.ok) {
    sendJson(response, access.status, access.body, request.headers.origin || "");
    return;
  }

  const validation = validateAiStreamingRequest(payload, { requestLabel: "AI agent" });
  if (!validation.ok) {
    sendJson(response, validation.result.status, validation.result.body, request.headers.origin || "");
    return;
  }

  const origin = request.headers.origin || "";
  const slot = acquireSlot(request, "agent");
  if (!slot.ok) {
    sendJson(response, slot.status, {
      error: slot.error,
      code: slot.code,
      retryAfter: slot.retryAfter,
      schemaVersion: AI_SCHEMA_VERSION,
    }, origin);
    return;
  }

  sendSseHeaders(response, origin);

  try {
    const result = await createAiAgentProposal(payload, {
      onEvent: (event, data) => {
        if (!response.writableEnded) {
          sendSseEvent(response, event, data);
        }
      },
    });

    if (!response.writableEnded && result.status === 200) {
      sendSseEvent(response, "result", result.body);
    } else if (!response.writableEnded) {
      sendSseEvent(response, "error", result.body);
    }
  } catch (error) {
    if (!response.writableEnded) {
      sendSseEvent(response, "error", {
        error: "Agent run failed",
        details: error instanceof Error ? error.message : "Unknown error.",
      });
    }
  } finally {
    releaseSlot("agent");
    if (!response.writableEnded) {
      response.end();
    }
  }
}

async function handleSchemeProposal(request, response) {
  let payload;
  let rawBodyLength = 0;
  try {
    const parsed = await readJsonBody(request);
    payload = parsed.body;
    rawBodyLength = parsed.rawBodyLength;
  } catch {
    sendJson(response, 400, { error: "Invalid JSON body" }, request.headers.origin || "");
    return;
  }

  const access = validateAiApiAccess({ headers: request.headers, rawBodyLength });
  if (!access.ok) {
    sendJson(response, access.status, access.body, request.headers.origin || "");
    return;
  }

  const origin = request.headers.origin || "";
  const slot = acquireSlot(request, "quick");
  if (!slot.ok) {
    sendJson(response, slot.status, {
      error: slot.error,
      code: slot.code,
      retryAfter: slot.retryAfter,
      schemaVersion: AI_SCHEMA_VERSION,
    }, origin);
    return;
  }

  try {
    const result = await createAiSchemeProposal(payload);
    sendJson(response, result.status, result.body, origin);
  } finally {
    releaseSlot("quick");
  }
}

async function handleSchemeProposalStream(request, response) {
  let payload;
  let rawBodyLength = 0;
  try {
    const parsed = await readJsonBody(request);
    payload = parsed.body;
    rawBodyLength = parsed.rawBodyLength;
  } catch {
    sendJson(response, 400, { error: "Invalid JSON body" }, request.headers.origin || "");
    return;
  }

  const access = validateAiApiAccess({ headers: request.headers, rawBodyLength });
  if (!access.ok) {
    sendJson(response, access.status, access.body, request.headers.origin || "");
    return;
  }

  const validation = validateAiStreamingRequest(payload);
  if (!validation.ok) {
    sendJson(response, validation.result.status, validation.result.body, request.headers.origin || "");
    return;
  }

  const origin = request.headers.origin || "";
  const slot = acquireSlot(request, "quick");
  if (!slot.ok) {
    sendJson(response, slot.status, {
      error: slot.error,
      code: slot.code,
      retryAfter: slot.retryAfter,
      schemaVersion: AI_SCHEMA_VERSION,
    }, origin);
    return;
  }

  sendSseHeaders(response, origin);

  try {
    const result = await createAiSchemeProposalStreaming(payload, {
      onProgress: (replyText) => {
        if (!response.writableEnded) {
          sendSseEvent(response, "progress", { reply: replyText });
        }
      },
    });

    if (!response.writableEnded && result.status === 200) {
      sendSseEvent(response, "result", result.body);
    } else if (!response.writableEnded) {
      sendSseEvent(response, "error", result.body);
    }
  } catch (error) {
    if (!response.writableEnded) {
      sendSseEvent(response, "error", {
        error: "AI model provider streaming failed",
        details: error instanceof Error ? error.message : "Unknown error.",
      });
    }
  } finally {
    releaseSlot("quick");
    if (!response.writableEnded) {
      response.end();
    }
  }
}

function createApp() {
  return createServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      sendJson(response, 204, {}, request.headers.origin || "");
      return;
    }

    // Deprecated endpoint redirects
    if (DEPRECATED_ENDPOINTS.includes(request.url)) {
      sendJson(response, 308, {
        error: "This endpoint is deprecated. Use /api/ai/scheme-proposals instead.",
        code: "deprecated",
        redirect: "/api/ai/scheme-proposals",
      }, request.headers.origin || "");
      return;
    }

    // Health check
    if (request.method === "GET" && request.url === "/api/health") {
      sendJson(response, 200, {
        ...getAiServiceHealth(),
        rateLimiter: getRateLimitMetrics(),
      }, request.headers.origin || "");
      return;
    }

    // Non-streaming scheme proposal
    if (request.method === "POST" && request.url === "/api/ai/scheme-proposals") {
      await handleSchemeProposal(request, response);
      return;
    }

    // Streaming scheme proposal
    if (request.method === "POST" && request.url === "/api/ai/scheme-proposals/stream") {
      await handleSchemeProposalStream(request, response);
      return;
    }

    // Agent run
    if (request.method === "POST" && request.url === "/api/ai/agent/run") {
      await handleAgentRun(request, response);
      return;
    }

    sendJson(response, 404, { error: "Not found" }, request.headers.origin || "");
  });
}

export function startServer(port = 8787, host = "127.0.0.1") {
  configureRateLimiter(process.env);
  const server = createApp();
  server.listen(port, host, () => {
    console.log(`CursorDance AI API listening on http://${host}:${port}`);
  });
  return server;
}
