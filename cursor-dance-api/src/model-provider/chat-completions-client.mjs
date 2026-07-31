import { normalizeAiSchemeProposal } from "../normalize.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompt-builder.mjs";

export function safeJsonParse(text) {
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

export function extractReplyFromPartialJson(text) {
  const match = text.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!match) return null;
  return match[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
}

export function consumeSseChunk(buffer, chunk, flush = false) {
  const lines = `${buffer}${chunk}`.split(/\r?\n/);
  let remainder = lines.pop() || "";
  if (flush && remainder) {
    lines.push(remainder);
    remainder = "";
  }
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter((value) => value && value !== "[DONE]");
  return { data, remainder };
}

export function appendToolCallDeltas(accumulator, toolCalls = []) {
  for (const toolCall of toolCalls) {
    const index = toolCall.index ?? 0;
    const current = accumulator[index] || { id: "", name: "", arguments: "" };
    accumulator[index] = {
      id: toolCall.id || current.id,
      name: current.name + (toolCall.function?.name || ""),
      arguments: current.arguments + (toolCall.function?.arguments || ""),
    };
  }
  return accumulator;
}

export function finalizeToolCalls(accumulator) {
  return Object.values(accumulator).map((toolCall) => ({
    id: toolCall.id,
    name: toolCall.name,
    arguments: safeJsonParse(toolCall.arguments) || {},
  }));
}

async function postJson(url, apiKey, body, signal) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  const text = await response.text();
  const payload = safeJsonParse(text);
  if (!response.ok) {
    throw new Error(payload?.error?.message || text || `Model API responded with ${response.status}`);
  }
  return payload;
}

async function* readSseEvents(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const parsed = consumeSseChunk(buffer, decoder.decode(value, { stream: true }));
      buffer = parsed.remainder;
      for (const data of parsed.data) {
        try {
          yield JSON.parse(data);
        } catch {
          // Ignore malformed provider events and continue consuming the stream.
        }
      }
    }
    const parsed = consumeSseChunk(buffer, decoder.decode(), true);
    for (const data of parsed.data) {
      try {
        yield JSON.parse(data);
      } catch {
        // Ignore a malformed final provider event.
      }
    }
  } finally {
    reader.releaseLock?.();
  }
}

async function fetchSse(url, apiKey, body, signal) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Model API responded with ${response.status}: ${errorText.slice(0, 200)}`);
  }
  return response;
}

function createSchemeMessages(requestState) {
  return [
    {
      role: "system",
      content: buildSystemPrompt(requestState.taskMode, requestState.prompt, requestState.currentConfig),
    },
    { role: "user", content: buildUserPrompt(requestState) },
  ];
}

function normalizeModelPayload(payload, source, requestState) {
  return normalizeAiSchemeProposal({ ...payload, source }, requestState);
}

export async function callChatCompletionsApi({ apiKey, baseUrl, model, requestState, maxOutputTokens, signal }) {
  const payload = await postJson(`${baseUrl}/chat/completions`, apiKey, {
    model,
    messages: createSchemeMessages(requestState),
    response_format: { type: "json_object" },
    ...(maxOutputTokens ? { max_tokens: maxOutputTokens } : {}),
  }, signal);
  const parsed = safeJsonParse(payload?.choices?.[0]?.message?.content);
  if (!parsed) throw new Error("Model returned non-JSON output.");
  return normalizeModelPayload(parsed, "model-chat-completions", requestState);
}

export async function callChatCompletionsApiStreaming({
  apiKey,
  baseUrl,
  model,
  requestState,
  maxOutputTokens,
  onProgress,
  signal,
}) {
  const response = await fetchSse(`${baseUrl}/chat/completions`, apiKey, {
    model,
    messages: createSchemeMessages(requestState),
    ...(maxOutputTokens ? { max_tokens: maxOutputTokens } : {}),
  }, signal);
  let accumulatedContent = "";
  let lastReply = "";
  for await (const event of readSseEvents(response.body)) {
    const delta = event?.choices?.[0]?.delta?.content;
    if (!delta) continue;
    accumulatedContent += delta;
    const reply = extractReplyFromPartialJson(accumulatedContent);
    if (reply && reply !== lastReply) {
      lastReply = reply;
      onProgress?.(reply);
    }
  }
  const parsed = safeJsonParse(accumulatedContent);
  if (!parsed) throw new Error("Model returned non-JSON streaming output.");
  return normalizeModelPayload(parsed, "model-chat-completions-streaming", requestState);
}

export async function callChatCompletionsApiWithTools({
  apiKey,
  baseUrl,
  model,
  messages,
  tools,
  maxOutputTokens,
  signal,
}) {
  const payload = await postJson(`${baseUrl}/chat/completions`, apiKey, {
    model,
    messages,
    tools,
    tool_choice: "auto",
    ...(maxOutputTokens ? { max_tokens: maxOutputTokens } : {}),
  }, signal);
  const choice = payload?.choices?.[0];
  const message = choice?.message;
  if (!message) throw new Error("Model returned empty response.");
  return {
    content: message.content || "",
    toolCalls: (message.tool_calls || []).map((toolCall) => ({
      id: toolCall.id,
      name: toolCall.function?.name,
      arguments: safeJsonParse(toolCall.function?.arguments) || {},
    })),
    finishReason: choice.finish_reason || "stop",
    usage: payload.usage || null,
  };
}

export async function callChatCompletionsApiWithToolsStreaming({
  apiKey,
  baseUrl,
  model,
  messages,
  tools,
  maxOutputTokens,
  onEvent,
  signal,
}) {
  const response = await fetchSse(`${baseUrl}/chat/completions`, apiKey, {
    model,
    messages,
    tools,
    tool_choice: "auto",
    ...(maxOutputTokens ? { max_tokens: maxOutputTokens } : {}),
  }, signal);
  let content = "";
  let usage = null;
  const toolCallDeltas = {};
  for await (const event of readSseEvents(response.body)) {
    const choice = event?.choices?.[0];
    const delta = choice?.delta;
    if (delta?.content) {
      content += delta.content;
      onEvent?.({ type: "content", text: delta.content });
    }
    appendToolCallDeltas(toolCallDeltas, delta?.tool_calls);
    if (choice?.finish_reason) onEvent?.({ type: "finish", reason: choice.finish_reason });
    if (event?.usage) usage = event.usage;
  }
  const toolCalls = finalizeToolCalls(toolCallDeltas);
  return {
    content,
    toolCalls,
    finishReason: toolCalls.length ? "tool_calls" : "stop",
    usage,
  };
}
