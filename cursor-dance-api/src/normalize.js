import {
  AI_SCHEMA_VERSION,
  AI_TASK_MODES,
  MAX_PROPOSAL_CONTEXT_BYTES,
  VALID_PROPOSAL_MODES,
} from "./field-defs.js";
import { sanitizeAiSchemePatch, getAiPatchSanitizeMeta, mergeActionConfig } from "./sanitize.js";
import { repairPatchForUserIntent } from "./intent-repair.js";
import { buildAiSchemeDiffItems, describeDiff } from "./diff.js";

function createProposalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `proposal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function validateAiSchemeRequest(payload) {
  const errors = [];
  const prompt = typeof payload?.prompt === "string" ? payload.prompt.trim() : "";
  const actionId = typeof payload?.actionId === "string" ? payload.actionId : "leftClick";
  const actionLabel = typeof payload?.actionLabel === "string" ? payload.actionLabel : "";
  const taskMode = Object.prototype.hasOwnProperty.call(AI_TASK_MODES, payload?.taskMode)
    ? payload.taskMode
    : "modify_action";
  const currentConfig =
    payload?.currentConfig && typeof payload.currentConfig === "object" && !Array.isArray(payload.currentConfig)
      ? payload.currentConfig
      : {};
  const allConfigs =
    payload?.allConfigs && typeof payload.allConfigs === "object" && !Array.isArray(payload.allConfigs)
      ? payload.allConfigs
      : null;
  const proposalContext =
    payload?.proposalContext && typeof payload.proposalContext === "object" && !Array.isArray(payload.proposalContext)
      ? payload.proposalContext
      : null;
  const extensionVersion = typeof payload?.extensionVersion === "string" ? payload.extensionVersion.slice(0, 32) : "";
  const schemaVersion = typeof payload?.schemaVersion === "string" ? payload.schemaVersion.slice(0, 32) : "";

  if (!prompt) errors.push("prompt is required");
  if (prompt.length > 1200) errors.push("prompt is too long");
  if (proposalContext && JSON.stringify(proposalContext).length > MAX_PROPOSAL_CONTEXT_BYTES) {
    errors.push("proposalContext is too large");
  }

  return {
    ok: errors.length === 0,
    errors,
    value: {
      prompt,
      actionId,
      actionLabel,
      taskMode,
      currentConfig,
      allConfigs,
      proposalContext,
      extensionVersion,
      schemaVersion,
    },
  };
}

function normalizeAiSchemeInfo(scheme = {}, requestState = {}) {
  const modeLabel = AI_TASK_MODES[requestState.taskMode] || "AI 方案";
  return {
    name: typeof scheme?.name === "string" && scheme.name.trim() ? scheme.name.trim().slice(0, 48) : modeLabel,
    summary: typeof scheme?.summary === "string" && scheme.summary.trim() ? scheme.summary.trim().slice(0, 160) : "基于当前配置生成的 AI 方案。",
    styleTags: Array.isArray(scheme?.styleTags)
      ? scheme.styleTags.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()).slice(0, 6)
      : [],
    rationale: typeof scheme?.rationale === "string" && scheme.rationale.trim() ? scheme.rationale.trim().slice(0, 500) : "",
  };
}

function normalizeAiSchemeTarget(target = {}, requestState = {}) {
  const rawPatch = target.patch && typeof target.patch === "object" ? target.patch : {};
  const patch = repairPatchForUserIntent(sanitizeAiSchemePatch(rawPatch), requestState);
  return {
    type: target.type || "action",
    actionId: typeof target.actionId === "string" && target.actionId ? target.actionId : requestState.actionId || "leftClick",
    label: typeof target.label === "string" && target.label ? target.label : requestState.actionLabel || "当前动作",
    patch,
    sanitizeMeta: getAiPatchSanitizeMeta(rawPatch, patch),
  };
}

function normalizeAiSchemeTargets(payload = {}, requestState = {}) {
  const rawTargets = Array.isArray(payload.targets) && payload.targets.length
    ? payload.targets
    : [{
        type: payload.target?.type || "action",
        actionId: payload.target?.actionId || requestState.actionId,
        label: payload.target?.label || requestState.actionLabel,
        patch: payload.patch,
      }];
  return rawTargets
    .map((target) => normalizeAiSchemeTarget(target, requestState))
    .filter((target) => target.type === "action");
}

function getPrimaryTarget(targets, requestState = {}) {
  return targets.find((target) => target.actionId === requestState.actionId) || targets[0] || normalizeAiSchemeTarget({}, requestState);
}

function normalizeProposalMode(payload = {}, requestState = {}) {
  const candidate = payload.mode || payload.intent || requestState.taskMode || "modify_action";
  if (candidate === "generate_action") return "generate_theme";
  return VALID_PROPOSAL_MODES.has(candidate) ? candidate : "modify_action";
}

export function getAiProposalPatchForAction(proposal, actionId) {
  const target = proposal?.targets?.find((item) => item.type === "action" && item.actionId === actionId);
  return target?.patch || null;
}

export function getAiProposalNextConfigForAction(proposal, actionId, currentConfig = {}) {
  const patch = getAiProposalPatchForAction(proposal, actionId);
  return patch ? mergeActionConfig(currentConfig, patch) : null;
}

export function buildAiProposalContext(proposal) {
  if (!proposal) return null;
  const context = {
    proposalId: proposal.proposalId,
    schemaVersion: proposal.schemaVersion || AI_SCHEMA_VERSION,
    mode: proposal.mode,
    scheme: proposal.scheme
      ? {
          name: proposal.scheme.name,
          summary: proposal.scheme.summary,
          styleTags: proposal.scheme.styleTags,
        }
      : undefined,
    targets: Array.isArray(proposal.targets)
      ? proposal.targets.slice(0, 6).map((target) => ({
          type: target.type,
          actionId: target.actionId,
          label: target.label,
          patch: sanitizeAiSchemePatch(target.patch),
        }))
      : [],
    diffSummary: Array.isArray(proposal.diffSummary) ? proposal.diffSummary.slice(0, 5) : [],
  };

  return JSON.stringify(context).length <= MAX_PROPOSAL_CONTEXT_BYTES ? context : {
    proposalId: context.proposalId,
    schemaVersion: context.schemaVersion,
    mode: context.mode,
    targets: context.targets.slice(0, 3),
  };
}

export function normalizeAiSchemeProposal(payload = {}, requestState = {}) {
  const targets = normalizeAiSchemeTargets(payload, requestState);
  const primaryTarget = getPrimaryTarget(targets, requestState);
  const patch = primaryTarget.patch;
  const currentConfig = requestState.currentConfig || {};
  const mode = normalizeProposalMode(payload, requestState);
  const riskLevel = ["low", "medium", "high"].includes(payload.riskLevel) ? payload.riskLevel : "low";
  const warnings = Array.isArray(payload.warnings)
    ? payload.warnings.filter((item) => typeof item === "string" && item.trim()).slice(0, 5)
    : [];

  return {
    proposalId: typeof payload.proposalId === "string" && payload.proposalId ? payload.proposalId : createProposalId(),
    schemaVersion: typeof payload.schemaVersion === "string" && payload.schemaVersion ? payload.schemaVersion : requestState.schemaVersion || AI_SCHEMA_VERSION,
    mode,
    intent: payload.intent || mode,
    scheme: normalizeAiSchemeInfo(payload.scheme, requestState),
    target: {
      type: primaryTarget.type,
      actionId: primaryTarget.actionId,
      label: primaryTarget.label,
    },
    targets,
    riskLevel,
    warnings,
    source: payload.source || "api",
    reply: typeof payload.reply === "string" && payload.reply.trim() ? payload.reply.trim() : "我已生成一版可执行配置。",
    patch,
    sanitizeMeta: payload.sanitizeMeta || primaryTarget.sanitizeMeta,
    nextConfig: mergeActionConfig(currentConfig, patch),
    diffItems: buildAiSchemeDiffItems(currentConfig, patch),
    diffSummary: Array.isArray(payload.diffSummary)
      ? payload.diffSummary.filter((item) => typeof item === "string" && item.trim()).slice(0, 5)
      : describeDiff(patch),
    tuningOptions: Array.isArray(payload.tuningOptions)
      ? payload.tuningOptions.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()).slice(0, 6)
      : [],
  };
}
