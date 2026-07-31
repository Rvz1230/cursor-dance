import { AI_SCHEMA_VERSION } from "../field-defs.js";

export function getJsonByteLength(value) {
  if (value === undefined || value === null) return 0;
  return Buffer.byteLength(JSON.stringify(value), "utf8");
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

export function logAiMetrics(eventName, metrics, env = process.env) {
  if (env.CURSORDANCE_AI_METRICS_LOG === "0") return;
  console.log(JSON.stringify({
    event: eventName,
    service: "cursor-dance-ai-api",
    ...metrics,
  }));
}
