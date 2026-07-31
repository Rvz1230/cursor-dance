import {
  callChatCompletionsApi,
  callChatCompletionsApiStreaming,
  callChatCompletionsApiWithTools,
  callChatCompletionsApiWithToolsStreaming,
} from "./model-provider/chat-completions-client.mjs";

const DEFAULT_BASE_URL = "https://api.deepseek.com/v1";
const DEFAULT_MODEL = "deepseek-v4-flash";

function getOptionalPositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getApiConfig(env = process.env) {
  return {
    apiKey: env.CURSORDANCE_AI_API_KEY || env.OPENAI_API_KEY,
    baseUrl: String(env.CURSORDANCE_AI_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    model: env.CURSORDANCE_AI_MODEL || DEFAULT_MODEL,
    maxOutputTokens: getOptionalPositiveInteger(env.CURSORDANCE_AI_MAX_OUTPUT_TOKENS),
  };
}

export function hasConfiguredModelProvider(env = process.env) {
  return Boolean(env.CURSORDANCE_AI_API_KEY || env.OPENAI_API_KEY);
}

export async function generateAgentResponse({ messages, tools, env = process.env, onEvent, signal }) {
  const config = getApiConfig(env);
  if (!config.apiKey) throw new Error("AI model provider is not configured");
  const request = { ...config, messages, tools, onEvent, signal };
  return onEvent
    ? callChatCompletionsApiWithToolsStreaming(request)
    : callChatCompletionsApiWithTools(request);
}

export async function generateSchemePatchWithModel(requestState, env = process.env, signal) {
  const config = getApiConfig(env);
  if (!config.apiKey) return null;
  return callChatCompletionsApi({ ...config, requestState, signal });
}

export async function generateSchemePatchWithModelStreaming(requestState, env = process.env, onProgress, signal) {
  const config = getApiConfig(env);
  if (!config.apiKey) return null;
  return callChatCompletionsApiStreaming({ ...config, requestState, onProgress, signal });
}
