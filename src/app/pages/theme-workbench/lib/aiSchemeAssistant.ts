// 浏览器与桌面共享 schema/normalize；传输层按运行环境选择：
// 浏览器继续走 standalone HTTP API，Electron Workbench 走 typed IPC。
import {
  AI_EXTENSION_VERSION,
  AI_SCHEMA_VERSION,
} from "../../../../../cursor-dance-api/src/field-defs";
import {
  buildAiProposalContext,
  normalizeAiSchemeProposal,
} from "../../../../../cursor-dance-api/src/normalize";
import {
  requestAiAgentRun as requestRemoteAiAgentRun,
  requestAiSchemeEdit as requestRemoteAiSchemeEdit,
  requestAiSchemeEditStreaming as requestRemoteAiSchemeEditStreaming,
} from "../../../../../cursor-dance-api/src/client";

type AiClientError = Error & { status?: number; code?: string };

export {
  AI_EXTENSION_VERSION,
  AI_SCHEMA_VERSION,
  AI_SCHEME_PATCH_FIELDS,
  AI_TASK_MODES,
  ARRAY_FIELDS,
  BOOLEAN_FIELDS,
  DEFAULT_API_ENDPOINT,
  ENUM_OPTIONS,
  FIELD_LABELS,
  MAX_PROPOSAL_CONTEXT_BYTES,
  NUMERIC_LIMITS,
  STRING_FIELDS,
  VALID_PROPOSAL_MODES,
} from "../../../../../cursor-dance-api/src/field-defs";

export {
  clampNumber,
  getAiPatchSanitizeMeta,
  mergeActionConfig,
  normalizeHexColor,
  sanitizeAiSchemePatch,
  sanitizePatchValue,
} from "../../../../../cursor-dance-api/src/sanitize";

export { getAiRequestErrorMessage } from "../../../../../cursor-dance-api/src/errors";

export { repairPatchForUserIntent } from "../../../../../cursor-dance-api/src/intent-repair";

export {
  buildAiSchemeDiffItems,
  formatDiffValue,
} from "../../../../../cursor-dance-api/src/diff";

export {
  buildAiProposalContext,
  getAiProposalNextConfigForAction,
  getAiProposalPatchForAction,
  normalizeAiSchemeProposal,
  validateAiSchemeRequest,
} from "../../../../../cursor-dance-api/src/normalize";

export {
  AGENT_TOOLS,
  describeAgentToolCall,
} from "../../../../../cursor-dance-api/src/agent-tools";

function getDesktopAiBridge() {
  return typeof window !== "undefined" ? window.cursorDanceAi : undefined;
}

function buildTransportPayload(options) {
  return {
    prompt: options.prompt,
    currentConfig: options.currentConfig,
    allConfigs: options.actionConfigs || undefined,
    proposalContext: buildAiProposalContext(options.proposalContext),
    actionLabel: options.actionLabel,
    actionId: options.actionId,
    taskMode: options.taskMode,
    extensionVersion: AI_EXTENSION_VERSION,
    schemaVersion: AI_SCHEMA_VERSION,
  };
}

function createTransportError(response) {
  const body = response?.body || {};
  const message = typeof body.error === "string" ? body.error : `AI service responded with ${response?.status || 500}`;
  const details = typeof body.details === "string" ? body.details : "";
  const error = new Error(details ? `${message}: ${details}` : message) as AiClientError;
  error.status = response?.status || 500;
  error.code = typeof body.code === "string" ? body.code : "api_failed";
  return error;
}

function normalizeTransportProposal(proposal, options) {
  return normalizeAiSchemeProposal(
    proposal,
    {
      currentConfig: options.currentConfig,
      actionLabel: options.actionLabel,
      actionId: options.actionId,
      taskMode: options.taskMode,
      schemaVersion: proposal?.schemaVersion || AI_SCHEMA_VERSION,
    },
  );
}

function makeRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `request-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function runDesktopStreamingRequest(bridge, method, options) {
  const requestId = makeRequestId();
  const signal = options.signal;
  const timeoutMs = method === "runAgent" ? 60_000 : 18_000;
  if (signal?.aborted) {
    const error = new Error("AI 请求已取消。") as AiClientError;
    error.code = "abort";
    throw error;
  }
  let rejectCancelled;
  let cancelCode = null;
  const cancelled = new Promise((_, reject) => {
    rejectCancelled = reject;
  });
  const cancel = (code = "abort") => {
    if (cancelCode) return;
    cancelCode = code;
    const error = new Error(
      code === "timeout" ? "AI 请求超时，请稍后重试。" : "AI 请求已取消。",
    ) as AiClientError;
    error.code = code;
    void bridge.cancelRequest(requestId).catch(() => undefined);
    rejectCancelled(error);
  };
  const onAbort = () => cancel("abort");
  signal?.addEventListener("abort", onAbort, { once: true });
  const timeoutId = setTimeout(() => cancel("timeout"), timeoutMs);
  const unsubscribe = bridge.onRequestEvent((event) => {
    if (event.requestId !== requestId || signal?.aborted || cancelCode === "timeout") return;
    if (method === "runAgent") {
      options.onEvent?.(event.type, event.data);
    } else if (event.type === "progress") {
      const data = event.data && typeof event.data === "object"
        ? event.data as Record<string, unknown>
        : {};
      options.onProgress?.(typeof data.reply === "string" ? data.reply : "");
    }
  });

  try {
    const response = await Promise.race([
      bridge[method]({ requestId, payload: buildTransportPayload(options) }),
      cancelled,
    ]);
    if (response.status !== 200) throw createTransportError(response);
    if (method === "runAgent") {
      const proposal = normalizeTransportProposal(response.body.proposal, options);
      return {
        result: {
          ...proposal,
          steps: response.body.steps,
          totalTokens: response.body.totalTokens,
          totalCacheHitTokens: response.body.totalCacheHitTokens,
          totalCacheMissTokens: response.body.totalCacheMissTokens,
          durationMs: response.body.durationMs,
        },
        abort: () => cancel("abort"),
      };
    }
    return {
      result: normalizeTransportProposal(response.body, options),
      abort: () => cancel("abort"),
    };
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onAbort);
    unsubscribe();
  }
}

export async function requestAiSchemeEdit(options) {
  const bridge = getDesktopAiBridge();
  if (!bridge) return requestRemoteAiSchemeEdit(options);
  const response = await bridge.createProposal(buildTransportPayload(options));
  if (response.status !== 200) throw createTransportError(response);
  return normalizeTransportProposal(response.body, options);
}

export async function requestAiSchemeEditStreaming(options) {
  const bridge = getDesktopAiBridge();
  if (!bridge) return requestRemoteAiSchemeEditStreaming(options);
  return runDesktopStreamingRequest(bridge, "createProposalStream", options);
}

export async function requestAiAgentRun(options) {
  const bridge = getDesktopAiBridge();
  if (!bridge) return requestRemoteAiAgentRun(options);
  return runDesktopStreamingRequest(bridge, "runAgent", options);
}
