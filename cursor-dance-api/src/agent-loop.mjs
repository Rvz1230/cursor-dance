import { generateAgentResponse } from "./model-provider.mjs";
import { AGENT_TOOLS, AGENT_SYSTEM_PROMPT_EXTENSION, createToolExecutor } from "./agent-tools.js";
import { sanitizeAiSchemePatch, getAiPatchSanitizeMeta } from "./sanitize.js";
import { normalizeAiSchemeProposal, validateAiSchemeRequest } from "./normalize.js";
import { repairPatchForUserIntent } from "./intent-repair.js";

const DEFAULT_MAX_STEPS = 5;

function buildAgentSystemPrompt() {
  return [
    "你是 CursorDance 的 AI 方案设计师，兼具资深 UED 和可执行配置工程师能力。",
    "",
    AGENT_SYSTEM_PROMPT_EXTENSION,
    "",
    "可用动作 ID：leftClick（左键点击）、rightClick（右键点击）、doubleClick（双击）、longPress（长按）、wheel（滚轮）、hover（悬停）。",
    "",
    "重要：你必须在 2-3 步内完成所有操作并调用 finalize_proposal。不要在多个步骤间反复读取配置而不做修改。",
    "当所有配置修改完成并确认效果后，立即调用 finalize_proposal 输出最终方案。",
  ].join("\n");
}

function buildAgentUserPrompt({ prompt, actionId, actionLabel, currentConfig }) {
  return [
    `当前动作 ID：${actionId || "leftClick"}`,
    `当前动作名称：${actionLabel || "当前动作"}`,
    "当前配置 JSON：",
    JSON.stringify(currentConfig || {}, null, 2),
    "",
    "用户需求：",
    prompt,
  ].join("\n");
}

function emitEvent(emitter, event, data) {
  if (typeof emitter === "function") {
    emitter(event, data);
  }
}

function toolCallsToMessages(toolCalls) {
  return toolCalls.map((tc) => ({
    id: tc.id,
    type: "function",
    function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
  }));
}

export async function runAgentLoop({
  prompt,
  actionId = "leftClick",
  actionLabel = "左键点击",
  currentConfig = {},
  taskMode = "modify_action",
  schemaVersion,
  extensionVersion,
  env = process.env,
  maxSteps = DEFAULT_MAX_STEPS,
  onEvent,
}) {
  const steps = [];
  const startedAt = Date.now();
  let totalTokens = 0;

  const initialConfigs = {};
  initialConfigs[actionId] = JSON.parse(JSON.stringify(currentConfig));
  const executor = createToolExecutor(initialConfigs);

  const messages = [
    { role: "system", content: buildAgentSystemPrompt() },
    { role: "user", content: buildAgentUserPrompt({ prompt, actionId, actionLabel, currentConfig }) },
  ];

  let finished = false;
  let finalProposalArgs = null;

  for (let stepIndex = 0; stepIndex < maxSteps && !finished; stepIndex++) {
    const stepStartedAt = Date.now();

    emitEvent(onEvent, "step_start", { step: stepIndex + 1, totalSteps: maxSteps });

    let response;
    try {
      response = await generateAgentResponse({
        messages,
        tools: AGENT_TOOLS,
        env,
        onEvent: (event) => {
          if (event.type === "content") {
            emitEvent(onEvent, "stream_token", { step: stepIndex + 1, text: event.text });
          }
        },
      });
    } catch (error) {
      emitEvent(onEvent, "error", {
        error: "Agent model call failed",
        details: error instanceof Error ? error.message : "Unknown error.",
        step: stepIndex + 1,
      });
      steps.push({
        index: stepIndex + 1,
        thought: `模型调用失败: ${error instanceof Error ? error.message : "未知错误"}`,
        toolCalls: [],
        toolResults: [],
        durationMs: Date.now() - stepStartedAt,
      });
      break;
    }

    if (response.usage) {
      totalTokens += response.usage.total_tokens || 0;
    }

    // Append assistant message with tool_calls if present
    const assistantMessage = { role: "assistant", content: response.content || null };
    if (response.toolCalls?.length) {
      assistantMessage.tool_calls = toolCallsToMessages(response.toolCalls);
    }
    messages.push(assistantMessage);

    const step = {
      index: stepIndex + 1,
      thought: response.content || "",
      toolCalls: [],
      toolResults: [],
      durationMs: Date.now() - stepStartedAt,
      tokenUsage: response.usage || null,
    };

    if (response.toolCalls?.length) {
      for (const tc of response.toolCalls) {
        emitEvent(onEvent, "tool_call", {
          step: stepIndex + 1,
          toolName: tc.name,
          arguments: tc.arguments,
        });

        // finalize_proposal is the terminal tool
        if (tc.name === "finalize_proposal") {
          finalProposalArgs = tc.arguments;
          finished = true;

          emitEvent(onEvent, "tool_result", {
            step: stepIndex + 1,
            toolName: tc.name,
            result: { ok: true, summary: "方案已生成" },
          });

          step.toolCalls.push({ name: tc.name, arguments: tc.arguments });
          step.toolResults.push({ name: tc.name, result: { ok: true, summary: "方案已生成" } });

          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ ok: true, summary: "方案已生成，Agent 完成。" }),
          });
          break;
        }

        // Execute regular tools
        let toolResult;
        try {
          toolResult = executor.execute(tc.name, tc.arguments, {
            prompt,
            actionId,
            actionLabel,
            currentConfig,
          });
        } catch (err) {
          toolResult = { ok: false, error: err instanceof Error ? err.message : "Tool execution error" };
        }

        emitEvent(onEvent, "tool_result", {
          step: stepIndex + 1,
          toolName: tc.name,
          result: toolResult,
        });

        step.toolCalls.push({ name: tc.name, arguments: tc.arguments });
        step.toolResults.push({ name: tc.name, result: toolResult });

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(toolResult),
        });
      }
    } else if (response.finishReason === "stop" || response.content) {
      // Model returned content without tool calls — treat as final
      finished = true;
      // If the model outputs JSON directly, try to parse it
      if (!finalProposalArgs) {
        try {
          const parsed = JSON.parse(response.content?.trim() || "{}");
          if (parsed.scheme || parsed.reply) {
            finalProposalArgs = parsed;
          }
        } catch {
          // Not JSON, the content is just the thought
        }
      }
    }

    emitEvent(onEvent, "step_end", {
      step: stepIndex + 1,
      hasToolCalls: response.toolCalls?.length > 0,
      toolCount: response.toolCalls?.length || 0,
      durationMs: step.durationMs,
    });

    steps.push(step);
  }

  if (!finished && !finalProposalArgs) {
    emitEvent(onEvent, "error", {
      error: "Agent reached maximum steps without finalizing a proposal.",
      steps: steps.length,
    });
    return {
      ok: false,
      error: "Agent reached maximum steps without finalizing a proposal.",
      steps,
      totalTokens,
      durationMs: Date.now() - startedAt,
    };
  }

  // Graceful fallback: if agent didn't call finalize_proposal, build proposal from accumulated config changes
  const rawProposal = finalProposalArgs || {};
  const usedFallback = !finalProposalArgs;

  // Collect all modified configs from executor for targets
  const agentConfigs = executor.getConfigs();
  const targets = Object.entries(agentConfigs)
    .filter(([agentActionId, config]) => {
      const base = (agentActionId === actionId ? currentConfig : {}) || {};
      const diff = Object.keys(config).filter(
        (key) => JSON.stringify(base[key]) !== JSON.stringify(config[key])
      );
      return diff.length > 0;
    })
    .map(([agentActionId, config]) => {
      const base = (agentActionId === actionId ? currentConfig : {}) || {};
      const patch = {};
      for (const key of Object.keys(config)) {
        if (JSON.stringify(base[key]) !== JSON.stringify(config[key])) {
          patch[key] = config[key];
        }
      }
      const sanitized = sanitizeAiSchemePatch(patch);
      return {
        type: "action",
        actionId: agentActionId,
        label: agentActionId === actionId ? (actionLabel || "当前动作") : agentActionId,
        patch: sanitized,
        sanitizeMeta: getAiPatchSanitizeMeta(patch, sanitized),
      };
    });

  // Apply safety pipeline
  const requestState = {
    prompt,
    actionId,
    actionLabel,
    currentConfig,
    taskMode,
    schemaVersion,
    extensionVersion,
  };

  const proposal = normalizeAiSchemeProposal(
    {
      mode: rawProposal.mode || taskMode,
      scheme: rawProposal.scheme || {
        name: usedFallback ? "Agent 自动生成方案" : (rawProposal.scheme?.name || "AI 方案"),
        summary: usedFallback
          ? `基于 "${prompt.slice(0, 40)}" 自动调整了 ${targets.length} 个动作。`
          : (rawProposal.scheme?.summary || "基于当前配置生成的 AI 方案。"),
        styleTags: rawProposal.scheme?.styleTags || [],
        rationale: rawProposal.scheme?.rationale || "",
      },
      reply: rawProposal.reply || (usedFallback
        ? `已根据"${prompt.slice(0, 30)}"调整了 ${targets.length} 个动作的配置，请确认效果。`
        : "已根据你的需求完成配置调整。"),
      riskLevel: rawProposal.riskLevel || "low",
      warnings: rawProposal.warnings || (usedFallback ? ["Agent 未调用 finalize_proposal，使用自动生成的方案。"] : []),
      tuningOptions: rawProposal.tuningOptions || [],
      targets: targets.length > 0 ? targets : [{ type: "action", actionId, label: actionLabel, patch: {} }],
      source: "agent",
    },
    { ...requestState, taskMode: rawProposal.mode || taskMode }
  );

  emitEvent(onEvent, "result", {
    proposal,
    steps: steps.length,
    totalTokens,
    durationMs: Date.now() - startedAt,
  });

  return {
    ok: true,
    proposal,
    steps,
    totalTokens,
    durationMs: Date.now() - startedAt,
  };
}
