import { normalizeAiSchemeProposal } from "./normalize.js";
import { AGENT_TOOLS, AGENT_SYSTEM_PROMPT_EXTENSION } from "./agent-tools.js";

const DEFAULT_BASE_URL = "https://api.deepseek.com/v1";
const DEFAULT_MODEL = "deepseek-chat";
const DEFAULT_MODE = "chat_completions";
const MAX_AGENT_ITERATIONS = 5;

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

// Layered prompt modules: each module's rules are only included when relevant
// to the user's request, reducing noise and saving tokens.
const FIELD_MODULES = {
  text: {
    keywords: ["飘字", "数字", "文字", "文案", "文本", "计数", "连击", "combo", "+1", "加一", "内容", "模板", "候选"],
    rules: [
      "飘字类型 textKind 可选：数字飘字、文本飘字。",
      "数字飘字必须设置：textEnabled=true, textKind=\"数字飘字\", textStyle, textMode。",
      "数字 +1 默认模式必须设置：textEnabled=true, textKind=\"数字飘字\", textStyle=\"阿拉伯数字 (1, 2, 3)\", textMode=\"默认模式 (+1)\", textContent=\"+1\", textTemplate=\"${number}\", textTags=[], comboEnabled=false，除非用户明确要求连击累加。",
      "数字模板模式必须设置：textEnabled=true, textKind=\"数字飘字\", textMode=\"模板模式\", textTemplate 必须包含 \"${number}\"。",
      "文本飘字必须设置：textEnabled=true, textKind=\"文本飘字\", textContent 为主文案, textTags 为候选文案数组, comboEnabled=false。",
      "不要把 textContent 改成 '+1' 却遗漏 textKind；如果用户说数字、+1、加一、默认模式，必须切换 textKind 和 textMode。",
    ],
  },
  particle: {
    keywords: ["粒子", "颗粒", "火花", "星光", "碎屑", "钻石", "心形", "方块", "三角", "喷发", "扩散"],
    rules: [
      "粒子字段：particle, particleCount, particleSpread, particleStyle, particleDirection, particleColorMode, particleDuration, particleSize, particleOpacity。"
    ],
  },
  ripple: {
    keywords: ["波纹", "水波", "涟漪", "环", "脉冲", "回声", "面波"],
    rules: [
      "波纹字段：ripple, rippleSize, rippleDuration, rippleStyle, rippleEasing, rippleLineWidth, rippleOpacity。"
    ],
  },
  audio: {
    keywords: ["声音", "音效", "静音", "音量", "播放", "混音", "木鱼", "听", "响"],
    rules: [
      "音效字段：sound, volume, soundFile, soundTriggerMode, soundBlendMode。用户说不要声音时必须设置 sound=false, volume=0。"
    ],
  },
  cursor: {
    keywords: ["光标", "鼠标", "震动", "大小", "指针", "尺寸"],
    rules: [
      "光标反馈字段：shake, cursorOverride, cursorSize。"
    ],
  },
  animation: {
    keywords: ["动画", "弹跳", "旋转", "聚焦", "斜切", "轨道", "螺旋", "闪耀", "徽记"],
    rules: [
      "动画字段：animationEnabled, animationStyle, animationDuration, animationScale, animationOpacity, animationOffsetX, animationOffsetY。"
    ],
  },
  image: {
    keywords: ["图片", "图像", "贴图", "图标", "表情", "emoji", "gif"],
    rules: [
      "图像字段：imageEnabled, imageDataUrl, imageDuration, imageSize, imageOpacity, imageOffsetX, imageOffsetY。"
    ],
  },
};

function selectPromptModules(prompt = "", currentConfig = {}) {
  if (!prompt || !prompt.trim()) return Object.keys(FIELD_MODULES);

  const active = new Set();

  // Detect from user prompt keywords
  for (const [name, mod] of Object.entries(FIELD_MODULES)) {
    if (mod.keywords.some((kw) => prompt.includes(kw))) {
      active.add(name);
    }
  }

  // Always include modules for effects that are currently enabled,
  // because the user might want to modify or disable them implicitly
  if (currentConfig?.textEnabled) active.add("text");
  if (currentConfig?.particle) active.add("particle");
  if (currentConfig?.ripple) active.add("ripple");
  if (currentConfig?.sound) active.add("audio");
  if (currentConfig?.animationEnabled) active.add("animation");
  if (currentConfig?.imageEnabled) active.add("image");

  // Cursor is always relevant
  active.add("cursor");

  // If nothing was detected, include all modules (safe fallback)
  return active.size > 0 ? [...active] : Object.keys(FIELD_MODULES);
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function getOptionalPositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildSystemPrompt(taskMode = "modify_action", prompt = "", currentConfig = {}) {
  const modeRules = MODE_RULES[taskMode] || MODE_RULES.modify_action;
  const activeModules = selectPromptModules(prompt, currentConfig);
  const fieldRules = activeModules.flatMap((name) => FIELD_MODULES[name]?.rules || []);

  return [
    "你是 CursorDance 的 AI 方案设计师，兼具资深 UED 和可执行配置工程师能力。",
    "你的任务不是机械改字段，而是理解用户场景，生成可预览、可解释、可微调的鼠标反馈方案。",
    "只输出 JSON，不要 Markdown，不要解释 JSON 之外的内容。",
    "返回的是方案提案 proposal，不是最终写入结果。",
    "重要：你只能处理与鼠标点击效果、光标反馈、页面交互视觉特效相关的需求。",
    "如果用户的需求与这些完全无关（例如问天气、写代码、闲聊、写诗、翻译等），必须礼貌拒绝：",
    "targets 返回空数组 []，reply 中说明你只能处理 CursorDance 鼠标反馈配置，",
    "tuningOptions 给出 3 个与鼠标反馈相关的引导性示例，riskLevel 设为 \"low\"。",
    "mode 取值为 modify_action 或 tune_proposal。",
    "scheme 描述方案名称、摘要、风格标签和设计理由。",
    "targets 是需要修改的动作列表。target.type 当前只能是 action。",
    "patch 只能表达需要修改的字段，不能返回 CSS、HTML、JS、代码或未知字段。",
    "你必须按 CursorDance 的配置字段操作，字段名和值必须完全匹配下面的配置字典。",
    ...fieldRules,
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
    JSON.stringify(currentConfig || {}),
    proposalContext ? "上一版 proposal 精简上下文 JSON：" : "",
    proposalContext ? JSON.stringify(proposalContext) : "",
    "用户需求：",
    prompt,
    "请返回 JSON（重要：reply 字段放在最前面，让用户尽早看到回复内容）：{ \"reply\": string, \"mode\": string, \"scheme\": { \"name\": string, \"summary\": string, \"styleTags\": string[], \"rationale\": string }, \"targets\": [{ \"type\": \"action\", \"actionId\": string, \"label\": string, \"patch\": object }], \"diffSummary\": string[], \"riskLevel\": \"low\" | \"medium\" | \"high\", \"warnings\": string[], \"tuningOptions\": string[] }",
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

function extractReplyFromPartialJson(text) {
  const match = text.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!match) return null;
  return match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
}

function normalizeModelPayload(payload, source, requestState) {
  return normalizeAiSchemeProposal({ ...payload, source }, requestState);
}

function buildAgentSystemPrompt(taskMode = "modify_action", prompt = "", currentConfig = {}) {
  return [
    buildSystemPrompt(taskMode, prompt, currentConfig),
    AGENT_SYSTEM_PROMPT_EXTENSION,
  ].join("\n");
}

function buildAgentMessages({ prompt, actionId, actionLabel, currentConfig, taskMode, proposalContext, extensionVersion, schemaVersion }) {
  return [
    { role: "system", content: buildAgentSystemPrompt(taskMode, prompt, currentConfig) },
    { role: "user", content: buildUserPrompt({ prompt, actionId, actionLabel, currentConfig, taskMode, proposalContext, extensionVersion, schemaVersion }) },
  ];
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

function getApiConfig(env = process.env) {
  const mode = env.CURSORDANCE_AI_API_MODE || DEFAULT_MODE;
  const apiKey = env.CURSORDANCE_AI_API_KEY || env.OPENAI_API_KEY;
  const baseUrl = env.CURSORDANCE_AI_API_BASE_URL || DEFAULT_BASE_URL;
  const model = env.CURSORDANCE_AI_MODEL || DEFAULT_MODEL;
  const maxOutputTokens = getOptionalPositiveInteger(env.CURSORDANCE_AI_MAX_OUTPUT_TOKENS);

  return { mode, apiKey, baseUrl, model, maxOutputTokens };
}

async function callChatCompletionsApi({ apiKey, baseUrl, model, requestState, maxOutputTokens }) {
  const payload = await postJson(`${trimTrailingSlash(baseUrl)}/chat/completions`, apiKey, {
    model,
    messages: [
      { role: "system", content: buildSystemPrompt(requestState.taskMode, requestState.prompt, requestState.currentConfig) },
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

async function callChatCompletionsApiStreaming({ apiKey, baseUrl, model, requestState, maxOutputTokens, onProgress }) {
  const response = await fetch(`${trimTrailingSlash(baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt(requestState.taskMode, requestState.prompt, requestState.currentConfig) },
        { role: "user", content: buildUserPrompt(requestState) },
      ],
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

async function callChatCompletionsApiWithTools({ apiKey, baseUrl, model, messages, tools, maxOutputTokens }) {
  const payload = await postJson(`${trimTrailingSlash(baseUrl)}/chat/completions`, apiKey, {
    model,
    messages,
    tools,
    tool_choice: "auto",
    ...(maxOutputTokens ? { max_tokens: maxOutputTokens } : {}),
  });

  const choice = payload?.choices?.[0];
  const message = choice?.message;
  if (!message) throw new Error("Model returned empty response.");

  const toolCalls = message.tool_calls?.map((tc) => ({
    id: tc.id,
    name: tc.function?.name,
    arguments: safeJsonParse(tc.function?.arguments) || {},
  })) || [];

  return {
    content: message.content || "",
    toolCalls,
    finishReason: choice.finish_reason || "stop",
    usage: payload.usage || null,
  };
}

async function callChatCompletionsApiWithToolsStreaming({ apiKey, baseUrl, model, messages, tools, maxOutputTokens, onEvent }) {
  const response = await fetch(`${trimTrailingSlash(baseUrl)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: "auto",
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
  const toolCallsAcc = {};
  let streamUsage = null;

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
          const delta = event?.choices?.[0]?.delta;
          if (!delta) {
            // Capture usage from non-delta chunks (typically the last chunk)
            if (event?.usage) {
              streamUsage = event.usage;
            }
            continue;
          }

          if (delta.content) {
            accumulatedContent += delta.content;
            onEvent?.({ type: "content", text: delta.content });
          }

          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallsAcc[idx]) {
                toolCallsAcc[idx] = { id: tc.id || "", name: "", arguments: "" };
              }
              if (tc.id) toolCallsAcc[idx].id = tc.id;
              if (tc.function?.name) toolCallsAcc[idx].name += tc.function.name;
              if (tc.function?.arguments) toolCallsAcc[idx].arguments += tc.function.arguments;
            }
          }

          if (event?.choices?.[0]?.finish_reason) {
            onEvent?.({ type: "finish", reason: event.choices[0].finish_reason });
            // Usage may also be in the finish chunk alongside delta
            if (event?.usage) {
              streamUsage = event.usage;
            }
          }
        } catch {
          // Skip unparseable SSE data
        }
      }
    }
  } finally {
    reader.releaseLock?.();
  }

  const toolCalls = Object.values(toolCallsAcc).map((tc) => ({
    id: tc.id,
    name: tc.name,
    arguments: safeJsonParse(tc.arguments) || {},
  }));

  return {
    content: accumulatedContent,
    toolCalls,
    finishReason: toolCalls.length > 0 ? "tool_calls" : "stop",
    usage: streamUsage,
  };
}

export function buildAgentMessagesFromState(requestState) {
  return buildAgentMessages(requestState);
}

export { buildAgentSystemPrompt };

export async function generateAgentResponse({ messages, tools, env = process.env, onEvent }) {
  const { apiKey, baseUrl, model, maxOutputTokens } = getApiConfig(env);
  if (!apiKey) throw new Error("AI model provider is not configured");

  if (onEvent) {
    return callChatCompletionsApiWithToolsStreaming({
      apiKey, baseUrl, model, messages, tools, maxOutputTokens, onEvent,
    });
  }
  return callChatCompletionsApiWithTools({ apiKey, baseUrl, model, messages, tools, maxOutputTokens });
}

export async function generateSchemePatchWithModel(requestState, env = process.env) {
  const { apiKey, baseUrl, model, maxOutputTokens } = getApiConfig(env);
  if (!apiKey) return null;

  const modelRequestState = {
    ...requestState,
    maxOutputTokens: env.CURSORDANCE_AI_MAX_OUTPUT_TOKENS || requestState.maxOutputTokens,
  };

  return callChatCompletionsApi({ apiKey, baseUrl, model, requestState: modelRequestState, maxOutputTokens });
}

export async function generateSchemePatchWithModelStreaming(requestState, env = process.env, onProgress) {
  const { apiKey, baseUrl, model, maxOutputTokens } = getApiConfig(env);
  if (!apiKey) return null;

  const modelRequestState = {
    ...requestState,
    maxOutputTokens: env.CURSORDANCE_AI_MAX_OUTPUT_TOKENS || requestState.maxOutputTokens,
  };

  return callChatCompletionsApiStreaming({ apiKey, baseUrl, model, requestState: modelRequestState, maxOutputTokens, onProgress });
}
