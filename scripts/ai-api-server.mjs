import { createServer } from "node:http";
import {
  createLocalAiSchemeResponse,
  sanitizeAiSchemePatch,
  validateAiSchemeRequest,
} from "../src/app/pages/theme-workbench/lib/aiSchemeAssistant.js";
import {
  generateSchemePatchWithModel,
  hasConfiguredModelProvider,
} from "./ai-model-provider.mjs";

const PORT = Number.parseInt(process.env.CURSORDANCE_AI_API_PORT || "8787", 10);
const HOST = process.env.CURSORDANCE_AI_API_HOST || "127.0.0.1";

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handleAiSchemeRequest(request, response) {
  let payload;
  try {
    payload = await readJsonBody(request);
  } catch {
    sendJson(response, 400, { error: "Invalid JSON body" });
    return;
  }

  const requestState = validateAiSchemeRequest(payload);
  if (!requestState.ok) {
    sendJson(response, 400, { error: "Invalid AI scheme request", details: requestState.errors });
    return;
  }

  let result = null;
  if (hasConfiguredModelProvider()) {
    try {
      result = await generateSchemePatchWithModel(requestState.value);
    } catch (error) {
      console.warn("AI model provider failed, falling back to local prototype:", error.message);
    }
  }

  if (!result) {
    result = createLocalAiSchemeResponse({
      prompt: requestState.value.prompt,
      currentConfig: requestState.value.currentConfig,
      actionLabel: requestState.value.actionLabel,
    });
  }

  sendJson(response, 200, {
    source: result.source || "local-api-prototype",
    intent: "generate_or_modify_scheme",
    reply: result.reply,
    patch: sanitizeAiSchemePatch(result.patch),
    diffSummary: result.diffSummary,
  });
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.method === "GET" && request.url === "/api/health") {
    sendJson(response, 200, { ok: true, service: "cursor-dance-ai-api" });
    return;
  }

  if (
    request.method === "POST"
    && (request.url === "/api/ai/modify-scheme" || request.url === "/api/ai/generate-scheme")
  ) {
    await handleAiSchemeRequest(request, response);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`CursorDance AI API listening on http://${HOST}:${PORT}`);
});
