import {
  AI_SCHEMA_VERSION,
  getAiPatchSanitizeMeta,
  normalizeAiSchemeProposal,
  sanitizeAiSchemePatch,
  validateAiSchemeRequest,
} from "../../src/app/pages/theme-workbench/lib/aiSchemeAssistant.js";
import {
  generateSchemePatchWithModel,
  hasConfiguredModelProvider,
} from "../../scripts/ai-model-provider.mjs";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const MAX_REQUEST_BYTES = 50 * 1024;
const DEFAULT_MAX_PROMPT_CHARS = 1200;
const DEFAULT_MAX_CURRENT_CONFIG_BYTES = 24 * 1024;
const DEFAULT_MAX_PROPOSAL_CONTEXT_BYTES = 8 * 1024;

function getJsonByteLength(value) {
  if (value === undefined || value === null) return 0;
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

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

export function getAiRequestMetrics(payload = {}, requestState = null, extra = {}) {
  const prompt = typeof payload?.prompt === "string" ? payload.prompt : "";
  const currentConfig = payload?.currentConfig && typeof payload.currentConfig === "object" ? payload.currentConfig : {};
  const proposalContext = payload?.proposalContext && typeof payload.proposalContext === "object" ? payload.proposalContext : null;

  return {
    mode: requestState?.value?.taskMode || payload?.taskMode || "modify_action",
    schemaVersion: requestState?.value?.schemaVersion || payload?.schemaVersion || AI_SCHEMA_VERSION,
    extensionVersion: requestState?.value?.extensionVersion || payload?.extensionVersion || "",
    promptChars: prompt.trim().length,
    currentConfigBytes: getJsonByteLength(currentConfig),
    proposalContextBytes: getJsonByteLength(proposalContext),
    rawBodyBytes: extra.rawBodyLength || 0,
    targetCount: Array.isArray(extra.targets) ? extra.targets.length : extra.targetCount || 0,
    droppedFieldCount: extra.droppedFieldCount || 0,
    durationMs: extra.durationMs || 0,
    status: extra.status || 0,
    errorCode: extra.errorCode || "",
  };
}

function shouldLogAiMetrics(env = process.env) {
  return env.CURSORDANCE_AI_METRICS_LOG !== "0";
}

function logAiMetrics(eventName, metrics, env = process.env) {
  if (!shouldLogAiMetrics(env)) return;
  console.log(JSON.stringify({
    event: eventName,
    service: "cursor-dance-ai-api",
    ...metrics,
  }));
}

export function getAiServiceHealth(env = process.env) {
  return {
    ok: true,
    service: "cursor-dance-ai-api",
    modelProviderConfigured: hasConfiguredModelProvider(env),
    mode: env.CURSORDANCE_AI_API_MODE || "responses",
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
  const limits = getAiRequestLimits(env);
  if (rawBodyLength > limits.maxRequestBytes) {
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

export function serializeAiProposal(proposal) {
  return {
    proposalId: proposal.proposalId,
    schemaVersion: proposal.schemaVersion || AI_SCHEMA_VERSION,
    source: proposal.source || "api",
    mode: proposal.mode,
    intent: proposal.intent,
    scheme: proposal.scheme,
    target: proposal.target,
    targets: proposal.targets,
    riskLevel: proposal.riskLevel,
    warnings: proposal.warnings,
    reply: proposal.reply,
    patch: proposal.patch,
    sanitizeMeta: proposal.sanitizeMeta,
    diffSummary: proposal.diffSummary,
    tuningOptions: proposal.tuningOptions,
  };
}

export async function createAiSchemeProposal(payload, { env = process.env } = {}) {
  const startedAt = Date.now();
  const requestState = validateAiSchemeRequest(payload);
  const limits = getAiRequestLimits(env);
  const limitErrors = [];
  const promptChars = typeof payload?.prompt === "string" ? payload.prompt.trim().length : 0;
  const currentConfigBytes = getJsonByteLength(payload?.currentConfig);
  const proposalContextBytes = getJsonByteLength(payload?.proposalContext);

  if (promptChars > limits.maxPromptChars) limitErrors.push("prompt is too long");
  if (currentConfigBytes > limits.maxCurrentConfigBytes) limitErrors.push("currentConfig is too large");
  if (proposalContextBytes > limits.maxProposalContextBytes) limitErrors.push("proposalContext is too large");

  if (!requestState.ok) {
    const status = 400;
    logAiMetrics("ai_scheme_proposal", getAiRequestMetrics(payload, requestState, {
      status,
      errorCode: "invalid_request",
      durationMs: Date.now() - startedAt,
    }), env);
    return {
      status,
      body: {
        error: "Invalid AI scheme request",
        code: "invalid_request",
        details: requestState.errors,
        schemaVersion: AI_SCHEMA_VERSION,
      },
    };
  }

  if (limitErrors.length) {
    const status = limitErrors.some((error) => error.includes("large")) ? 413 : 400;
    logAiMetrics("ai_scheme_proposal", getAiRequestMetrics(payload, requestState, {
      status,
      errorCode: "invalid_request",
      durationMs: Date.now() - startedAt,
    }), env);
    return {
      status,
      body: {
        error: "AI scheme request exceeds configured limits",
        code: "invalid_request",
        details: limitErrors,
        schemaVersion: AI_SCHEMA_VERSION,
      },
    };
  }

  if (!hasConfiguredModelProvider(env)) {
    const status = 503;
    logAiMetrics("ai_scheme_proposal", getAiRequestMetrics(payload, requestState, {
      status,
      errorCode: "provider_failed",
      durationMs: Date.now() - startedAt,
    }), env);
    return {
      status,
      body: {
        error: "AI model provider is not configured",
        code: "provider_failed",
        details: "Set CURSORDANCE_AI_API_KEY or OPENAI_API_KEY before starting the AI API service.",
        schemaVersion: AI_SCHEMA_VERSION,
      },
    };
  }

  let result;
  try {
    result = await generateSchemePatchWithModel(requestState.value, env);
  } catch (error) {
    const status = 502;
    logAiMetrics("ai_scheme_proposal", getAiRequestMetrics(payload, requestState, {
      status,
      errorCode: "provider_failed",
      durationMs: Date.now() - startedAt,
    }), env);
    return {
      status,
      body: {
        error: "AI model provider failed",
        code: "provider_failed",
        details: error instanceof Error ? error.message : "Unknown model provider error.",
        schemaVersion: AI_SCHEMA_VERSION,
      },
    };
  }

  const sanitizedPatch = sanitizeAiSchemePatch(result.patch);
  const proposal = normalizeAiSchemeProposal(
    {
      ...result,
      schemaVersion: requestState.value.schemaVersion || AI_SCHEMA_VERSION,
      patch: sanitizedPatch,
      sanitizeMeta: getAiPatchSanitizeMeta(result.patch, sanitizedPatch),
    },
    requestState.value
  );

  logAiMetrics("ai_scheme_proposal", getAiRequestMetrics(payload, requestState, {
    status: 200,
    targetCount: proposal.targets?.length || 0,
    droppedFieldCount: proposal.sanitizeMeta?.droppedFieldCount || 0,
    durationMs: Date.now() - startedAt,
  }), env);

  return {
    status: 200,
    body: serializeAiProposal(proposal),
  };
}
