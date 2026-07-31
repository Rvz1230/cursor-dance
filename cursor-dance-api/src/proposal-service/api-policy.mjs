import { AI_SCHEMA_VERSION } from "../field-defs.js";
import { hasConfiguredModelProvider } from "../model-provider.mjs";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const MAX_REQUEST_BYTES = 50 * 1024;
const DEFAULT_MAX_PROMPT_CHARS = 1200;
const DEFAULT_MAX_CURRENT_CONFIG_BYTES = 24 * 1024;
const DEFAULT_MAX_PROPOSAL_CONTEXT_BYTES = 8 * 1024;

function getPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getAiRequestLimits(env = process.env) {
  return {
    maxRequestBytes: getPositiveInteger(env.CURSORDANCE_AI_MAX_REQUEST_BYTES, MAX_REQUEST_BYTES),
    maxPromptChars: getPositiveInteger(env.CURSORDANCE_AI_MAX_PROMPT_CHARS, DEFAULT_MAX_PROMPT_CHARS),
    maxCurrentConfigBytes: getPositiveInteger(env.CURSORDANCE_AI_MAX_CURRENT_CONFIG_BYTES, DEFAULT_MAX_CURRENT_CONFIG_BYTES),
    maxProposalContextBytes: getPositiveInteger(env.CURSORDANCE_AI_MAX_PROPOSAL_CONTEXT_BYTES, DEFAULT_MAX_PROPOSAL_CONTEXT_BYTES),
  };
}

export function getAiServiceHealth(env = process.env) {
  return {
    ok: true,
    service: "cursor-dance-ai-api",
    modelProviderConfigured: hasConfiguredModelProvider(env),
    mode: env.CURSORDANCE_AI_API_MODE || "chat_completions",
    model: env.CURSORDANCE_AI_MODEL || null,
    limits: getAiRequestLimits(env),
  };
}

export function getAllowedOrigins(env = process.env) {
  const configuredOrigins = String(env.CURSORDANCE_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return configuredOrigins.length ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;
}

export function buildCorsHeaders({ origin = "", env = process.env } = {}) {
  const allowedOrigins = getAllowedOrigins(env);
  const allowOrigin = allowedOrigins.includes("*")
    ? "*"
    : allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-CursorDance-Client",
    "Access-Control-Max-Age": "86400",
  };
}

export function validateAiApiAccess({ headers = {}, rawBodyLength = 0, env = process.env } = {}) {
  if (rawBodyLength > getAiRequestLimits(env).maxRequestBytes) {
    return {
      ok: false,
      status: 413,
      body: { error: "Request body is too large", code: "invalid_request", schemaVersion: AI_SCHEMA_VERSION },
    };
  }

  const expectedToken = env.CURSORDANCE_AI_API_ACCESS_TOKEN;
  if (!expectedToken) return { ok: true };

  const providedToken = headers.authorization?.replace(/^Bearer\s+/i, "") || headers["x-cursordance-client"];
  if (providedToken !== expectedToken) {
    return {
      ok: false,
      status: 401,
      body: { error: "Unauthorized AI API request", code: "permission_denied", schemaVersion: AI_SCHEMA_VERSION },
    };
  }

  return { ok: true };
}
