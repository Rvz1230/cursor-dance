import { normalizeAiSchemeProposal } from "../src/app/pages/theme-workbench/lib/aiSchemeAssistant.js";

const DEFAULT_RESPONSES_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_RESPONSES_MODEL = "gpt-4.1-mini";
const DEFAULT_CHAT_MODEL = "gpt-4.1-mini";

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["mode", "scheme", "targets", "reply", "diffSummary", "riskLevel", "warnings", "tuningOptions"],
  properties: {
    mode: {
      type: "string",
      description: "One of modify_action or tune_proposal.",
    },
    intent: {
      type: "string",
      description: "Backward-compatible intent. Prefer the same value as mode.",
    },
    scheme: {
      type: "object",
      additionalProperties: false,
      required: ["name", "summary", "styleTags", "rationale"],
      properties: {
        name: { type: "string" },
        summary: { type: "string" },
        styleTags: { type: "array", items: { type: "string" } },
        rationale: { type: "string" },
      },
    },
    target: {
      type: "object",
      additionalProperties: false,
      required: ["type", "actionId", "label"],
      properties: {
        type: { type: "string" },
        actionId: { type: "string" },
        label: { type: "string" },
      },
    },
    targets: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "actionId", "label", "patch"],
        properties: {
          type: { type: "string" },
          actionId: { type: "string" },
          label: { type: "string" },
          patch: {
            type: "object",
            description: "A partial CursorDance action config patch. Only include fields that should change.",
            additionalProperties: true,
          },
        },
      },
    },
    reply: {
      type: "string",
      description: "A concise Chinese explanation of the proposed CursorDance scheme.",
    },
    patch: {
      type: "object",
      description: "Backward-compatible primary action patch. Prefer targets[].patch.",
      additionalProperties: true,
    },
    diffSummary: {
      type: "array",
      description: "Short Chinese bullet summaries of the most important config changes.",
      items: { type: "string" },
    },
    riskLevel: {
      type: "string",
      description: "low, medium, or high. Use high for destructive or broad changes.",
    },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
    tuningOptions: {
      type: "array",
      items: { type: "string" },
    },
  },
};

const MODE_RULES = {
  modify_action: [
    "只修改当前动作，targets 默认只返回当前 actionId。",
    "必须返回可执行 patch；如果用户意图明确但字段缺失，要补齐必要字段。",
  ],
  tune_proposal: [
    "当前是微调模式：必须基于 proposalContext 做增量微调。",
    "只返回本次需要调整的字段，不要完全重写上一版方案。",
  ],
};

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function getOptionalPositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildSystemPrompt(taskMode = "modify_action") {
  const modeRules = MODE_RULES[taskMode] || MODE_RULES.modify_action;
  return [
    "你是 CursorDance 的 AI 方案设计师，兼具资深 UED 和可执行配置工程师能力。",
    "你的任务不是机械改字段，而是理解用户场景，生成可预览、可解释、可微调的鼠标反馈方案。",
    "只输出 JSON，不要 Markdown，不要解释 JSON 之外的内容。",
    "返回的是方案提案 proposal，不是最终写入结果。",
    "mode 取值为 modify_action 或 tune_proposal。",
    "scheme 描述方案名称、摘要、风格标签和设计理由。",
    "targets 是需要修改的动作列表。target.type 当前只能是 action。",
    "patch 只能表达需要修改的字段，不能返回 CSS、HTML、JS、代码或未知字段。",
    "你必须按 CursorDance 的配置字段操作，字段名和值必须完全匹配下面的配置字典。",
    "飘字类型 textKind 可选：数字飘字、文本飘字。",
    "数字飘字必须设置：textEnabled=true, textKind=\"数字飘字\", textStyle, textMode。",
    "数字 +1 默认模式必须设置：textEnabled=true, textKind=\"数字飘字\", textStyle=\"阿拉伯数字 (1, 2, 3)\", textMode=\"默认模式 (+1)\", textContent=\"+1\", textTemplate=\"${number}\", textTags=[], comboEnabled=false，除非用户明确要求连击累加。",
    "数字模板模式必须设置：textEnabled=true, textKind=\"数字飘字\", textMode=\"模板模式\", textTemplate 必须包含 \"${number}\"。",
    "文本飘字必须设置：textEnabled=true, textKind=\"文本飘字\", textContent 为主文案, textTags 为候选文案数组, comboEnabled=false。",
    "不要把 textContent 改成 '+1' 却遗漏 textKind；如果用户说数字、+1、加一、默认模式，必须切换 textKind 和 textMode。",
    "音效字段：sound, volume, soundFile, soundTriggerMode, soundBlendMode。用户说不要声音时必须设置 sound=false, volume=0。",
    "粒子字段：particle, particleCount, particleSpread, particleStyle, particleDirection, particleColorMode, particleDuration, particleSize, particleOpacity。",
    "波纹字段：ripple, rippleSize, rippleDuration, rippleStyle, rippleEasing, rippleLineWidth, rippleOpacity。",
    "光标反馈字段：shake, cursorOverride, cursorSize。",
    ...modeRules,
    "riskLevel 必须是 low、medium 或 high。",
    "优先保持低干扰、可预览、可撤销；如果用户要求低调，就降低粒子、声音、震动和持续时间。",
    "tuningOptions 给出 3 到 6 个用户下一步可点击的短选项。",
    "所有回复字段使用中文。",
  ].join("\n");
}

function buildUserPrompt({ prompt, actionId, actionLabel, currentConfig, taskMode, proposalContext, extensionVersion, schemaVersion }) {
  return [
    `扩展版本：${extensionVersion || "unknown"}`,
    `Schema 版本：${schemaVersion || "unknown"}`,
    `任务模式：${taskMode || "modify_action"}`,
    `当前动作 ID：${actionId || "leftClick"}`,
    `当前动作名称：${actionLabel || "当前动作"}`,
    "可用动作 ID：leftClick, rightClick, doubleClick, longPress, wheel, hover",
    "当前配置 JSON：",
    JSON.stringify(currentConfig || {}, null, 2),
    "当前配置卡片语义：",
    JSON.stringify({
      textCard: {
        textEnabled: currentConfig?.textEnabled,
        textKind: currentConfig?.textKind,
        textStyle: currentConfig?.textStyle,
        textMode: currentConfig?.textMode,
        textTemplate: currentConfig?.textTemplate,
        textContent: currentConfig?.textContent,
        textTags: currentConfig?.textTags,
        comboEnabled: currentConfig?.comboEnabled,
      },
      particleCard: {
        particle: currentConfig?.particle,
        particleCount: currentConfig?.particleCount,
        particleStyle: currentConfig?.particleStyle,
      },
      rippleCard: {
        ripple: currentConfig?.ripple,
        rippleSize: currentConfig?.rippleSize,
      },
      audioCard: {
        sound: currentConfig?.sound,
        volume: currentConfig?.volume,
        soundFile: currentConfig?.soundFile,
      },
    }, null, 2),
    proposalContext ? "上一版 proposal 精简上下文 JSON：" : "",
    proposalContext ? JSON.stringify(proposalContext, null, 2) : "",
    "用户需求：",
    prompt,
    "请返回 JSON：{ \"mode\": string, \"scheme\": { \"name\": string, \"summary\": string, \"styleTags\": string[], \"rationale\": string }, \"targets\": [{ \"type\": \"action\", \"actionId\": string, \"label\": string, \"patch\": object }], \"reply\": string, \"diffSummary\": string[], \"riskLevel\": \"low\" | \"medium\" | \"high\", \"warnings\": string[], \"tuningOptions\": string[] }",
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

function normalizeModelPayload(payload, source, requestState) {
  return normalizeAiSchemeProposal({
    ...payload,
    source,
  }, requestState);
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
  const maxOutputTokens = getOptionalPositiveInteger(requestState.maxOutputTokens);
  const payload = await postJson(`${trimTrailingSlash(baseUrl)}/responses`, apiKey, {
    model,
    input: [
      { role: "system", content: buildSystemPrompt(requestState.taskMode) },
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
    ...(maxOutputTokens ? { max_output_tokens: maxOutputTokens } : {}),
  });

  const parsed = safeJsonParse(extractResponsesText(payload));
  if (!parsed) throw new Error("Model returned non-JSON output.");
  return normalizeModelPayload(parsed, "model-responses-api", requestState);
}

function extractReplyFromPartialJson(text) {
  const match = text.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!match) return null;
  return match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
}

async function callResponsesApiStreaming({ apiKey, baseUrl, model, requestState, onProgress }) {
  const maxOutputTokens = getOptionalPositiveInteger(requestState.maxOutputTokens);
  const response = await fetch(`${trimTrailingSlash(baseUrl)}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: buildSystemPrompt(requestState.taskMode) },
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
      stream: true,
      ...(maxOutputTokens ? { max_output_tokens: maxOutputTokens } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Model API responded with ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulatedDeltas = "";
  let rawBuffer = "";
  let lastReply = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      rawBuffer += decoder.decode(value, { stream: true });
      const lines = rawBuffer.split("\n");
      rawBuffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data || data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);
          if (event.type === "response.output_text.delta" && event.delta) {
            accumulatedDeltas += event.delta;
            const reply = extractReplyFromPartialJson(accumulatedDeltas);
            if (reply && reply !== lastReply) {
              lastReply = reply;
              onProgress?.(reply);
            }
          }
        } catch {
          // Skip unparseable SSE data lines gracefully
        }
      }
    }
  } finally {
    reader.releaseLock?.();
  }

  const parsed = safeJsonParse(accumulatedDeltas);
  if (!parsed) throw new Error("Model returned non-JSON streaming output.");
  return normalizeModelPayload(parsed, "model-responses-api-streaming", requestState);
}

async function callChatCompletionsApi({ apiKey, baseUrl, model, requestState }) {
  const maxOutputTokens = getOptionalPositiveInteger(requestState.maxOutputTokens);
  const payload = await postJson(`${trimTrailingSlash(baseUrl)}/chat/completions`, apiKey, {
    model,
    messages: [
      { role: "system", content: buildSystemPrompt(requestState.taskMode) },
      { role: "user", content: buildUserPrompt(requestState) },
    ],
    response_format: { type: "json_object" },
    ...(maxOutputTokens ? { max_tokens: maxOutputTokens } : {}),
  });

  const content = payload?.choices?.[0]?.message?.content;
  const parsed = safeJsonParse(content);
  if (!parsed) throw new Error("Model returned non-JSON output.");
  return normalizeModelPayload(parsed, "model-chat-completions", requestState);
}

async function callChatCompletionsApiStreaming({ apiKey, baseUrl, model, requestState, onProgress }) {
  const maxOutputTokens = getOptionalPositiveInteger(requestState.maxOutputTokens);
  const response = await fetch(`${trimTrailingSlash(baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt(requestState.taskMode) },
        { role: "user", content: buildUserPrompt(requestState) },
      ],
      response_format: { type: "json_object" },
      stream: true,
      ...(maxOutputTokens ? { max_tokens: maxOutputTokens } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Model API responded with ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulatedContent = "";
  let rawBuffer = "";
  let lastReply = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      rawBuffer += decoder.decode(value, { stream: true });
      const lines = rawBuffer.split("\n");
      rawBuffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data || data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);
          const delta = event?.choices?.[0]?.delta?.content;
          if (delta) {
            accumulatedContent += delta;
            const reply = extractReplyFromPartialJson(accumulatedContent);
            if (reply && reply !== lastReply) {
              lastReply = reply;
              onProgress?.(reply);
            }
          }
        } catch {
          // Skip unparseable SSE data lines gracefully
        }
      }
    }
  } finally {
    reader.releaseLock?.();
  }

  const parsed = safeJsonParse(accumulatedContent);
  if (!parsed) throw new Error("Model returned non-JSON streaming output.");
  return normalizeModelPayload(parsed, "model-chat-completions-streaming", requestState);
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
  const modelRequestState = {
    ...requestState,
    maxOutputTokens: env.CURSORDANCE_AI_MAX_OUTPUT_TOKENS || requestState.maxOutputTokens,
  };

  if (mode === "chat_completions") {
    return callChatCompletionsApi({ apiKey, baseUrl, model, requestState: modelRequestState });
  }

  return callResponsesApi({ apiKey, baseUrl, model, requestState: modelRequestState });
}

export async function generateSchemePatchWithModelStreaming(requestState, env = process.env, onProgress) {
  const apiKey = env.CURSORDANCE_AI_API_KEY || env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const mode = env.CURSORDANCE_AI_API_MODE || "responses";
  const baseUrl = env.CURSORDANCE_AI_API_BASE_URL || DEFAULT_RESPONSES_BASE_URL;
  const model = env.CURSORDANCE_AI_MODEL || (mode === "chat_completions" ? DEFAULT_CHAT_MODEL : DEFAULT_RESPONSES_MODEL);
  const modelRequestState = {
    ...requestState,
    maxOutputTokens: env.CURSORDANCE_AI_MAX_OUTPUT_TOKENS || requestState.maxOutputTokens,
  };

  if (mode === "chat_completions") {
    return callChatCompletionsApiStreaming({ apiKey, baseUrl, model, requestState: modelRequestState, onProgress });
  }

  return callResponsesApiStreaming({ apiKey, baseUrl, model, requestState: modelRequestState, onProgress });
}
