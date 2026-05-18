import { createServer } from "node:http";
import { loadLocalEnv } from "./load-local-env.mjs";
import {
  createLocalAiSchemeResponse,
  getAiPatchSanitizeMeta,
  normalizeAiSchemeProposal,
  sanitizeAiSchemePatch,
  validateAiSchemeRequest,
} from "../src/app/pages/theme-workbench/lib/aiSchemeAssistant.js";
import {
  generateSchemePatchWithModel,
  hasConfiguredModelProvider,
} from "./ai-model-provider.mjs";

loadLocalEnv();

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

  const sanitizedPatch = sanitizeAiSchemePatch(result.patch);
  const proposal = normalizeAiSchemeProposal(
    {
      ...result,
      patch: sanitizedPatch,
      sanitizeMeta: getAiPatchSanitizeMeta(result.patch, sanitizedPatch),
    },
    requestState.value
  );

  sendJson(response, 200, {
    proposalId: proposal.proposalId,
    source: proposal.source || "local-api-prototype",
    intent: proposal.intent,
    target: proposal.target,
    riskLevel: proposal.riskLevel,
    warnings: proposal.warnings,
    reply: proposal.reply,
    patch: proposal.patch,
    sanitizeMeta: proposal.sanitizeMeta,
    diffSummary: proposal.diffSummary,
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
