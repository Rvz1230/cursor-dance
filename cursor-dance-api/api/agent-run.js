import {
  buildCorsHeaders,
  serializeAiProposal,
  validateAiApiAccess,
} from "../src/proposal-service.mjs";
import { hasConfiguredModelProvider } from "../src/model-provider.mjs";
import { validateAiSchemeRequest } from "../src/normalize.js";
import { runAgentLoop } from "../src/agent-loop.mjs";

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

function sendSse(response, event, data) {
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
    response.end(JSON.stringify({ error: "Invalid AI agent request", code: "invalid_request", details: reqState.errors }));
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
    const result = await runAgentLoop({
      ...reqState.value,
      env: process.env,
      onEvent: (event, data) => {
        if (!response.writableEnded) {
          sendSse(response, event, data);
        }
      },
    });

    if (!response.writableEnded && result.ok) {
      sendSse(response, "result", {
        proposal: serializeAiProposal(result.proposal),
        steps: result.steps.length,
        totalTokens: result.totalTokens,
        durationMs: result.durationMs,
      });
    } else if (!response.writableEnded && !result.ok) {
      sendSse(response, "error", {
        error: result.error || "Agent loop failed",
        steps: result.steps?.length || 0,
      });
    }
  } catch (err) {
    if (!response.writableEnded) {
      sendSse(response, "error", {
        error: "Agent run failed",
        details: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  } finally {
    if (!response.writableEnded) response.end();
  }
}
