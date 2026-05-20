import {
  buildCorsHeaders,
  getAiServiceHealth,
} from "../server/ai/proposal-service.mjs";

export default function handler(request, response) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  const corsHeaders = buildCorsHeaders({ origin: request.headers.origin || "" });
  Object.entries(corsHeaders).forEach(([key, value]) => response.setHeader(key, value));

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  response.status(200).json(getAiServiceHealth());
}
