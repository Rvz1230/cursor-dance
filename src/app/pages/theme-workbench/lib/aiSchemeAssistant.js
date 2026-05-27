// 向后兼容：所有导出来自 cursor-dance-api/src/
// 浏览器 + Node 通用模块
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
} from "../../../../../cursor-dance-api/src/field-defs.js";

export {
  clampNumber,
  getAiPatchSanitizeMeta,
  mergeActionConfig,
  normalizeHexColor,
  sanitizeAiSchemePatch,
  sanitizePatchValue,
} from "../../../../../cursor-dance-api/src/sanitize.js";

export { getAiRequestErrorMessage } from "../../../../../cursor-dance-api/src/errors.js";

export { repairPatchForUserIntent } from "../../../../../cursor-dance-api/src/intent-repair.js";

export {
  buildAiSchemeDiffItems,
  formatDiffValue,
} from "../../../../../cursor-dance-api/src/diff.js";

export {
  buildAiProposalContext,
  getAiProposalNextConfigForAction,
  getAiProposalPatchForAction,
  normalizeAiSchemeProposal,
  validateAiSchemeRequest,
} from "../../../../../cursor-dance-api/src/normalize.js";

export {
  requestAiSchemeEdit,
  requestAiSchemeEditStreaming,
  requestAiAgentRun,
} from "../../../../../cursor-dance-api/src/client.js";

export {
  AGENT_TOOLS,
  describeAgentToolCall,
} from "../../../../../cursor-dance-api/src/agent-tools.js";
