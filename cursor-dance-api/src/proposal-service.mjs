import {
  AI_SCHEMA_VERSION,
} from "./field-defs.js";
import {
  getAiPatchSanitizeMeta,
  sanitizeAiSchemePatch,
} from "./sanitize.js";
import {
  normalizeAiSchemeProposal,
  validateAiSchemeRequest,
} from "./normalize.js";
import {
  generateSchemePatchWithModel,
  generateSchemePatchWithModelStreaming,
  hasConfiguredModelProvider,
} from "./model-provider.mjs";
import { runAgentLoop } from "./agent-loop.mjs";
import { getAiRequestLimits } from "./proposal-service/api-policy.mjs";
import {
  getAiRequestMetrics,
  getJsonByteLength,
  logAiMetrics,
} from "./proposal-service/request-metrics.mjs";

export {
  buildCorsHeaders,
  getAiRequestLimits,
  getAiServiceHealth,
  getAllowedOrigins,
  validateAiApiAccess,
} from "./proposal-service/api-policy.mjs";
export { getAiRequestMetrics } from "./proposal-service/request-metrics.mjs";

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

export function validateAiStreamingRequest(
  payload,
  { env = process.env, requestLabel = "AI scheme" } = {},
) {
  const requestState = validateAiSchemeRequest(payload);
  if (!requestState.ok) {
    return {
      ok: false,
      result: {
        status: 400,
        body: {
          error: `Invalid ${requestLabel} request`,
          code: "invalid_request",
          details: requestState.errors,
          schemaVersion: AI_SCHEMA_VERSION,
        },
      },
    };
  }
  if (!hasConfiguredModelProvider(env)) {
    return {
      ok: false,
      result: {
        status: 503,
        body: {
          error: "AI model provider is not configured",
          code: "provider_failed",
          schemaVersion: AI_SCHEMA_VERSION,
        },
      },
    };
  }
  return { ok: true, requestState: requestState.value };
}

export async function createAiSchemeProposalStreaming(
  payload,
  { env = process.env, onProgress, signal } = {},
) {
  const prepared = validateAiStreamingRequest(payload, { env, requestLabel: "AI scheme" });
  if (!prepared.ok) return prepared.result;

  try {
    const result = await generateSchemePatchWithModelStreaming(
      prepared.requestState,
      env,
      onProgress,
      signal,
    );
    const sanitizedPatch = sanitizeAiSchemePatch(result.patch);
    const proposal = normalizeAiSchemeProposal(
      {
        ...result,
        patch: sanitizedPatch,
        sanitizeMeta: getAiPatchSanitizeMeta(result.patch, sanitizedPatch),
      },
      prepared.requestState,
    );
    return { status: 200, body: serializeAiProposal(proposal) };
  } catch (error) {
    return {
      status: 502,
      body: {
        error: "AI model provider streaming failed",
        code: "provider_failed",
        details: error instanceof Error ? error.message : "Unknown error.",
        schemaVersion: AI_SCHEMA_VERSION,
      },
    };
  }
}

export async function createAiAgentProposal(
  payload,
  { env = process.env, onEvent, signal } = {},
) {
  const prepared = validateAiStreamingRequest(payload, { env, requestLabel: "AI agent" });
  if (!prepared.ok) return prepared.result;

  try {
    const result = await runAgentLoop({
      ...prepared.requestState,
      env,
      onEvent,
      signal,
    });
    if (!result.ok) {
      return {
        status: 502,
        body: {
          error: result.error || "Agent loop failed",
          code: "provider_failed",
          steps: result.steps?.length || 0,
          schemaVersion: AI_SCHEMA_VERSION,
        },
      };
    }
    return {
      status: 200,
      body: {
        proposal: serializeAiProposal(result.proposal),
        steps: result.steps,
        totalTokens: result.totalTokens,
        totalCacheHitTokens: result.totalCacheHitTokens,
        totalCacheMissTokens: result.totalCacheMissTokens,
        durationMs: result.durationMs,
      },
    };
  } catch (error) {
    return {
      status: 502,
      body: {
        error: "Agent run failed",
        code: "provider_failed",
        details: error instanceof Error ? error.message : "Unknown error.",
        schemaVersion: AI_SCHEMA_VERSION,
      },
    };
  }
}
