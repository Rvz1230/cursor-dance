import { sanitizeAiSchemePatch } from "../src/app/pages/theme-workbench/lib/aiSchemeAssistant.js";

const DEFAULT_RESPONSES_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_RESPONSES_MODEL = "gpt-4.1-mini";
const DEFAULT_CHAT_MODEL = "gpt-4.1-mini";

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "patch", "diffSummary"],
  properties: {
    reply: {
      type: "string",
      description: "A concise Chinese explanation of the generated CursorDance configuration changes.",
    },
    patch: {
      type: "object",
      description: "A partial CursorDance action config patch. Only include fields that should change.",
      additionalProperties: true,
    },
    diffSummary: {
      type: "array",
      description: "Short Chinese bullet summaries of the most important config changes.",
      items: { type: "string" },
    },
  },
};

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function buildSystemPrompt() {
  return [
    "你是 CursorDance 的 AI 方案助手。",
    "你的任务是把用户的自然语言需求转换成可执行的鼠标特效配置 patch。",
    "只输出 JSON，不要 Markdown，不要解释 JSON 之外的内容。",
    "patch 只能表达需要修改的字段，不能返回 CSS、HTML、代码或未知字段。",
    "优先保持低干扰、可预览、可撤销；如果用户要求低调，就降低粒子、声音和震动。",
    "所有回复字段使用中文。",
  ].join("\n");
}

function buildUserPrompt({ prompt, actionId, actionLabel, currentConfig }) {
  return [
    `当前动作 ID：${actionId || "leftClick"}`,
    `当前动作名称：${actionLabel || "当前动作"}`,
    "当前配置 JSON：",
    JSON.stringify(currentConfig || {}, null, 2),
    "用户需求：",
    prompt,
    "请返回 JSON：{ \"reply\": string, \"patch\": object, \"diffSummary\": string[] }",
  ].join("\n");
}

function safeJsonParse(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function extractResponsesText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const parts = [];
  for (const output of payload?.output || []) {
    for (const content of output?.content || []) {
      if (typeof content?.text === "string") parts.push(content.text);
      if (typeof content?.output_text === "string") parts.push(content.output_text);
    }
  }
  return parts.join("\n");
}

function normalizeModelPayload(payload, source) {
  const patch = sanitizeAiSchemePatch(payload?.patch);
  return {
    source,
    intent: "generate_or_modify_scheme",
    reply: typeof payload?.reply === "string" && payload.reply.trim()
      ? payload.reply.trim()
      : "我已生成一版可执行配置。",
    patch,
    diffSummary: Array.isArray(payload?.diffSummary)
      ? payload.diffSummary.filter((item) => typeof item === "string" && item.trim()).slice(0, 5)
      : [],
  };
}

async function postJson(url, apiKey, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const payload = safeJsonParse(text);
  if (!response.ok) {
    const message = payload?.error?.message || text || `Model API responded with ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

async function callResponsesApi({ apiKey, baseUrl, model, requestState }) {
  const payload = await postJson(`${trimTrailingSlash(baseUrl)}/responses`, apiKey, {
    model,
    input: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(requestState) },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "cursor_dance_scheme_edit",
        strict: false,
        schema: RESPONSE_SCHEMA,
      },
    },
  });

  const parsed = safeJsonParse(extractResponsesText(payload));
  if (!parsed) throw new Error("Model returned non-JSON output.");
  return normalizeModelPayload(parsed, "model-responses-api");
}

async function callChatCompletionsApi({ apiKey, baseUrl, model, requestState }) {
  const payload = await postJson(`${trimTrailingSlash(baseUrl)}/chat/completions`, apiKey, {
    model,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(requestState) },
    ],
    response_format: { type: "json_object" },
  });

  const content = payload?.choices?.[0]?.message?.content;
  const parsed = safeJsonParse(content);
  if (!parsed) throw new Error("Model returned non-JSON output.");
  return normalizeModelPayload(parsed, "model-chat-completions");
}

export function hasConfiguredModelProvider(env = process.env) {
  return Boolean(env.CURSORDANCE_AI_API_KEY || env.OPENAI_API_KEY);
}

export async function generateSchemePatchWithModel(requestState, env = process.env) {
  const apiKey = env.CURSORDANCE_AI_API_KEY || env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const mode = env.CURSORDANCE_AI_API_MODE || "responses";
  const baseUrl = env.CURSORDANCE_AI_API_BASE_URL || DEFAULT_RESPONSES_BASE_URL;
  const model = env.CURSORDANCE_AI_MODEL || (mode === "chat_completions" ? DEFAULT_CHAT_MODEL : DEFAULT_RESPONSES_MODEL);

  if (mode === "chat_completions") {
    return callChatCompletionsApi({ apiKey, baseUrl, model, requestState });
  }

  return callResponsesApi({ apiKey, baseUrl, model, requestState });
}
