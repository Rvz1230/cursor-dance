import {
  buildCorsHeaders,
  serializeAiProposal,
  validateAiApiAccess,
} from "../src/proposal-service.mjs";
import {
  generateSchemePatchWithModelStreaming,
  hasConfiguredModelProvider,
} from "../src/model-provider.mjs";
import {
  getAiPatchSanitizeMeta,
  sanitizeAiSchemePatch,
} from "../src/sanitize.js";
import {
  normalizeAiSchemeProposal,
  validateAiSchemeRequest,
} from "../src/normalize.js";

async function readRequestBody(request) {
  if (request.body && typeof request.body === "object") {
    return { body: request.body, rawBodyLength: Buffer.byteLength(JSON.stringify(request.body), "utf8") };
  }
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  if (!buffer.length) return { body: {}, rawBodyLength: 0 };
  return { body: JSON.parse(buffer.toString("utf8")), rawBodyLength: buffer.byteLength };
}

function sse(response, event, data) {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function handler(request, response) {
  const cors = buildCorsHeaders({ origin: request.headers.origin || "" });

  if (request.method === "OPTIONS") { response.writeHead(204, cors); response.end(); return; }
  if (request.method !== "POST") {
    response.writeHead(405, { "Content-Type": "application/json", ...cors });
    response.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  let payload, rawBodyLength;
  try {
    const parsed = await readRequestBody(request);
    payload = parsed.body;
    rawBodyLength = parsed.rawBodyLength;
  } catch {
    response.writeHead(400, { "Content-Type": "application/json", ...cors });
    response.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const access = validateAiApiAccess({ headers: request.headers, rawBodyLength });
  if (!access.ok) {
    response.writeHead(access.status, { "Content-Type": "application/json", ...cors });
    response.end(JSON.stringify(access.body));
    return;
  }

  const reqState = validateAiSchemeRequest(payload);
  if (!reqState.ok) {
    response.writeHead(400, { "Content-Type": "application/json", ...cors });
    response.end(JSON.stringify({ error: "Invalid AI scheme request", code: "invalid_request", details: reqState.errors }));
    return;
  }

  if (!hasConfiguredModelProvider(process.env)) {
    response.writeHead(503, { "Content-Type": "application/json", ...cors });
    response.end(JSON.stringify({ error: "AI model provider is not configured", code: "provider_failed" }));
    return;
  }

  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    ...cors,
  });

  try {
    const result = await generateSchemePatchWithModelStreaming(
      reqState.value, process.env,
      (reply) => { if (!response.writableEnded) sse(response, "progress", { reply }); }
    );
    const sanitized = sanitizeAiSchemePatch(result.patch);
    const proposal = normalizeAiSchemeProposal(
      { ...result, patch: sanitized, sanitizeMeta: getAiPatchSanitizeMeta(result.patch, sanitized) },
      reqState.value
    );
    if (!response.writableEnded) sse(response, "result", serializeAiProposal(proposal));
  } catch (err) {
    if (!response.writableEnded) sse(response, "error", {
      error: "AI model provider streaming failed",
      details: err instanceof Error ? err.message : "Unknown error.",
    });
  } finally {
    if (!response.writableEnded) response.end();
  }
}
