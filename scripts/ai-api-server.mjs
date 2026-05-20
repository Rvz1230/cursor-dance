import { createServer } from "node:http";
import { loadLocalEnv } from "./load-local-env.mjs";
import {
  buildCorsHeaders,
  createAiSchemeProposal,
  getAiServiceHealth,
  validateAiApiAccess,
} from "../server/ai/proposal-service.mjs";

loadLocalEnv();

const PORT = Number.parseInt(process.env.CURSORDANCE_AI_API_PORT || "8787", 10);
const HOST = process.env.CURSORDANCE_AI_API_HOST || "127.0.0.1";

function sendJson(request, response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...buildCorsHeaders({ origin: request.headers.origin || "" }),
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  if (!buffer.length) return { body: {}, rawBodyLength: 0 };
  return { body: JSON.parse(buffer.toString("utf8")), rawBodyLength: buffer.byteLength };
}

async function handleAiSchemeRequest(request, response) {
  let payload;
  let rawBodyLength = 0;
  try {
    const parsedRequest = await readJsonBody(request);
    payload = parsedRequest.body;
    rawBodyLength = parsedRequest.rawBodyLength;
  } catch {
    sendJson(request, response, 400, { error: "Invalid JSON body" });
    return;
  }

  const access = validateAiApiAccess({ headers: request.headers, rawBodyLength });
  if (!access.ok) {
    sendJson(request, response, access.status, access.body);
    return;
  }

  const result = await createAiSchemeProposal(payload);
  sendJson(request, response, result.status, result.body);
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(request, response, 204, {});
    return;
  }

  if (request.method === "GET" && request.url === "/api/health") {
    sendJson(request, response, 200, getAiServiceHealth());
    return;
  }

  if (
    request.method === "POST"
    && (
      request.url === "/api/ai/modify-scheme"
      || request.url === "/api/ai/generate-scheme"
      || request.url === "/api/ai/scheme-proposals"
    )
  ) {
    await handleAiSchemeRequest(request, response);
    return;
  }

  sendJson(request, response, 404, { error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`CursorDance AI API listening on http://${HOST}:${PORT}`);
});
