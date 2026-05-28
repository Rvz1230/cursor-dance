// 共享 schema — 浏览器 + Node 通用
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
} from "./field-defs.js";

// 字段清洗 — 浏览器 + Node 通用
export {
  clampNumber,
  getAiPatchSanitizeMeta,
  mergeActionConfig,
  normalizeHexColor,
  sanitizeAiSchemePatch,
  sanitizePatchValue,
} from "./sanitize.js";

// 错误消息 — 浏览器 + Node 通用
export { getAiRequestErrorMessage } from "./errors.js";

// 意图修复 — 浏览器 + Node 通用
export { repairPatchForUserIntent } from "./intent-repair.js";

// Diff — 浏览器 + Node 通用
export {
  buildAiSchemeDiffItems,
  describeDiff,
  formatDiffValue,
} from "./diff.js";

// 标准化 — 浏览器 + Node 通用
export {
  buildAiProposalContext,
  getAiProposalNextConfigForAction,
  getAiProposalPatchForAction,
  normalizeAiSchemeProposal,
  validateAiSchemeRequest,
} from "./normalize.js";

// 浏览器客户端 — 仅浏览器使用，Node 端不要 import
// export { requestAiSchemeEdit, requestAiSchemeEditStreaming } from "./client.js";

// Agent 工具定义 — 浏览器 + Node 通用
export { AGENT_TOOLS, AGENT_SYSTEM_PROMPT_EXTENSION, createToolExecutor } from "./agent-tools.js";

// Agent 循环 — Node 端（依赖 model-provider）
export { runAgentLoop } from "./agent-loop.mjs";
