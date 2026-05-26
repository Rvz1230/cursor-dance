import {
  buildCorsHeaders,
  createAiSchemeProposal,
  validateAiApiAccess,
} from "../../server/ai/proposal-service.mjs";

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

export default async function handler(request, response) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  const cors = buildCorsHeaders({ origin: request.headers.origin || "" });
  Object.entries(cors).forEach(([k, v]) => response.setHeader(k, v));

  if (request.method === "OPTIONS") { response.status(204).end(); return; }
  if (request.method !== "POST") { response.status(405).json({ error: "Method not allowed" }); return; }

  let payload, rawBodyLength;
  try {
    const p = await readRequestBody(request);
    payload = p.body; rawBodyLength = p.rawBodyLength;
  } catch { response.status(400).json({ error: "Invalid JSON body" }); return; }

  const access = validateAiApiAccess({ headers: request.headers, rawBodyLength });
  if (!access.ok) { response.status(access.status).json(access.body); return; }

  const result = await createAiSchemeProposal(payload);
  response.status(result.status).json(result.body);
}
