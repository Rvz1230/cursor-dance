import { AI_EXTENSION_VERSION, AI_SCHEMA_VERSION, DEFAULT_API_ENDPOINT } from "./field-defs.js";
import { getAiRequestErrorMessage } from "./errors.js";
import { normalizeAiSchemeProposal, buildAiProposalContext } from "./normalize.js";

function getAiTimeoutMs() {
  const envValue = globalThis.VITE_CURSORDANCE_AI_TIMEOUT_MS;
  const parsed = Number.parseInt(envValue, 10);
  return Number.isFinite(parsed) && parsed >= 3000 ? parsed : 12000;
}

function combineSignals(...signals) {
  const filtered = signals.filter(Boolean);
  if (filtered.length <= 1) return filtered[0] || null;

  const controller = new AbortController();
  for (const signal of filtered) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

function isRetryableError(error) {
  if (error?.code === "timeout") return true;
  if (error?.code === "network") return true;
  const status = error?.status;
  return status === 502 || status === 503 || status === 504;
}

async function makeAiSchemeRequest({ endpoint, headers, body, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorMessage = `AI API responded with ${response.status}`;
      let errorCode = response.status === 401 || response.status === 403 ? "permission_denied" : "api_failed";
      try {
        const errorPayload = await response.json();
        if (typeof errorPayload?.error === "string" && errorPayload.error.trim()) {
          errorMessage = errorPayload.error.trim();
        }
        if (typeof errorPayload?.details === "string" && errorPayload.details.trim()) {
          errorMessage = `${errorMessage}: ${errorPayload.details.trim()}`;
        }
        if (typeof errorPayload?.code === "string" && errorPayload.code.trim()) {
          errorCode = errorPayload.code.trim();
        }
      } catch {
        // Keep the original status-based error when the backend does not return JSON.
      }
      const requestError = new Error(errorMessage);
      requestError.status = response.status;
      requestError.code = errorCode;
      throw requestError;
    }

    return await response.json();
  } catch (error) {
    if (error?.status) throw error;
    if (error?.name === "AbortError") {
      const timeoutError = new Error("AI 请求超时，请确认模型服务可用后重试。");
      timeoutError.code = "timeout";
      throw timeoutError;
    }
    if (error instanceof TypeError) {
      const networkError = new Error("后端未连接，请确认 AI API 服务已启动。");
      networkError.code = "network";
      throw networkError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function requestRemoteAiSchemeEdit({ prompt, currentConfig, actionLabel, actionId, taskMode, proposalContext }) {
  const timeoutMs = getAiTimeoutMs();
  const endpoint = globalThis.VITE_CURSORDANCE_AI_API_ENDPOINT || DEFAULT_API_ENDPOINT;
  const accessToken = globalThis.VITE_CURSORDANCE_AI_API_ACCESS_TOKEN || "";
  const headers = {
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
  const body = {
    prompt,
    currentConfig,
    proposalContext: buildAiProposalContext(proposalContext),
    actionLabel,
    actionId,
    taskMode,
    extensionVersion: AI_EXTENSION_VERSION,
    schemaVersion: AI_SCHEMA_VERSION,
  };
  const requestState = { currentConfig, actionLabel, actionId, taskMode };

  try {
    const payload = await makeAiSchemeRequest({ endpoint, headers, body, timeoutMs });
    return normalizeAiSchemeProposal(
      { ...payload, source: payload.source || "api" },
      { ...requestState, schemaVersion: payload.schemaVersion || AI_SCHEMA_VERSION }
    );
  } catch (error) {
    if (!isRetryableError(error)) throw error;

    try {
      const payload = await makeAiSchemeRequest({ endpoint, headers, body, timeoutMs: Math.min(timeoutMs * 1.5, 30000) });
      return normalizeAiSchemeProposal(
        { ...payload, source: payload.source || "api" },
        { ...requestState, schemaVersion: payload.schemaVersion || AI_SCHEMA_VERSION }
      );
    } catch (retryError) {
      throw retryError;
    }
  }
}

export async function requestAiSchemeEdit({ prompt, currentConfig, actionLabel, actionId, taskMode, proposalContext }) {
  return requestRemoteAiSchemeEdit({ prompt, currentConfig, actionLabel, actionId, taskMode, proposalContext });
}

async function parseSseStream(response, onProgress, signal) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEventType = "message";

  function checkAborted() {
    if (signal?.aborted) {
      const cancelError = new Error("AI 请求已取消。");
      cancelError.code = "abort";
      throw cancelError;
    }
  }

  try {
    while (true) {
      checkAborted();
      const { done, value } = await reader.read();
      if (done) throw new Error("Unexpected end of SSE stream without result.");

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEventType = line.slice(7).trim();
          continue;
        }
        if (!line.startsWith("data: ")) continue;
        const rawData = line.slice(6).trim();
        if (!rawData) continue;

        try {
          const data = JSON.parse(rawData);
          if (currentEventType === "progress" && data.reply) {
            onProgress?.(data.reply);
          } else if (currentEventType === "result") {
            return data;
          } else if (currentEventType === "error") {
            throw new Error(data.error || data.details || "Stream error");
          }
        } catch (err) {
          if (err instanceof SyntaxError) continue;
          throw err;
        }
      }
    }
  } finally {
    reader.releaseLock?.();
  }
}

export async function requestAiSchemeEditStreaming({ prompt, currentConfig, actionLabel, actionId, taskMode, proposalContext, onProgress, signal: externalSignal }) {
  const streamEndpoint = globalThis.VITE_CURSORDANCE_AI_API_STREAM_ENDPOINT;
  const baseEndpoint = globalThis.VITE_CURSORDANCE_AI_API_ENDPOINT || DEFAULT_API_ENDPOINT;
  const endpoint = streamEndpoint || baseEndpoint.replace(/\/+$/, "") + "/stream";
  const accessToken = globalThis.VITE_CURSORDANCE_AI_API_ACCESS_TOKEN || "";
  const controller = new AbortController();
  const timeoutMs = getAiTimeoutMs();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = combineSignals(controller.signal, externalSignal);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        prompt,
        currentConfig,
        proposalContext: buildAiProposalContext(proposalContext),
        actionLabel,
        actionId,
        taskMode,
        extensionVersion: AI_EXTENSION_VERSION,
        schemaVersion: AI_SCHEMA_VERSION,
      }),
      signal,
    });

    if (!response.ok) {
      let errorMessage = `AI API responded with ${response.status}`;
      try {
        const errorPayload = await response.json();
        errorMessage = errorPayload?.error || errorMessage;
      } catch { /* keep status-based message */ }
      throw new Error(errorMessage);
    }

    const result = await parseSseStream(response, onProgress, signal);
    return { result, abort: () => controller.abort() };
  } catch (error) {
    if (error?.name === "AbortError") {
      const cancelError = new Error("AI 请求已取消。");
      cancelError.code = "abort";
      throw cancelError;
    }
    if (error instanceof TypeError && error.message.includes("fetch")) {
      const networkError = new Error("后端未连接，请确认 AI API 服务已启动。");
      networkError.code = "network";
      throw networkError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function requestAiAgentRun({ prompt, currentConfig, actionConfigs, actionLabel, actionId, taskMode, proposalContext, onEvent, signal: externalSignal }) {
  const agentEndpoint = globalThis.VITE_CURSORDANCE_AI_AGENT_ENDPOINT;
  const baseEndpoint = globalThis.VITE_CURSORDANCE_AI_API_ENDPOINT || DEFAULT_API_ENDPOINT;
  const endpoint = agentEndpoint || baseEndpoint.replace(/\/[^/]+$/, "") + "/agent/run";
  const accessToken = globalThis.VITE_CURSORDANCE_AI_API_ACCESS_TOKEN || "";
  const controller = new AbortController();
  const timeoutMs = Math.max(getAiTimeoutMs() * 3, 60000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = combineSignals(controller.signal, externalSignal);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        prompt,
        currentConfig,
        allConfigs: actionConfigs || undefined,
        proposalContext: buildAiProposalContext(proposalContext),
        actionLabel,
        actionId,
        taskMode,
        extensionVersion: AI_EXTENSION_VERSION,
        schemaVersion: AI_SCHEMA_VERSION,
      }),
      signal,
    });

    if (!response.ok) {
      let errorMessage = `AI API responded with ${response.status}`;
      try {
        const errorPayload = await response.json();
        errorMessage = errorPayload?.error || errorMessage;
      } catch { /* keep status-based message */ }
      throw new Error(errorMessage);
    }

    const result = await parseAgentSseStream(response, onEvent, signal);
    return { result, abort: () => controller.abort() };
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("AI Agent 请求超时，请稍后重试。");
      timeoutError.code = "timeout";
      throw timeoutError;
    }
    if (error instanceof TypeError && error.message.includes("fetch")) {
      const networkError = new Error("后端未连接，请确认 AI API 服务已启动。");
      networkError.code = "network";
      throw networkError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function parseAgentSseStream(response, onEvent, signal) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEventType = "message";
  let finalResult = null;

  function checkAborted() {
    if (signal?.aborted) {
      const cancelError = new Error("AI 请求已取消。");
      cancelError.code = "abort";
      throw cancelError;
    }
  }

  try {
    while (true) {
      checkAborted();
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEventType = line.slice(7).trim();
          continue;
        }
        if (!line.startsWith("data: ")) continue;
        const rawData = line.slice(6).trim();
        if (!rawData) continue;

        try {
          const data = JSON.parse(rawData);
          onEvent?.(currentEventType, data);

          if (currentEventType === "result" && data.proposal) {
            finalResult = data.proposal;
            if (data.totalTokens != null) {
              finalResult.totalTokens = data.totalTokens;
            }
            if (data.durationMs != null) {
              finalResult.durationMs = data.durationMs;
            }
          }
          if (currentEventType === "error") {
            throw new Error(data.error || data.details || "Agent run error");
          }
        } catch (err) {
          if (err instanceof SyntaxError) continue;
          throw err;
        }
      }
    }
  } finally {
    reader.releaseLock?.();
  }

  if (!finalResult) throw new Error("Agent run ended without result.");
  return finalResult;
}
