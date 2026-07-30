import { useCallback, useEffect, useRef, useState } from "react";
import {
  getAiRequestErrorMessage,
  requestAiAgentRun,
  requestAiSchemeEditStreaming,
} from "../../lib/aiSchemeAssistant";

const COOLDOWN_MS = 3000;

export interface AgentTimelineStep {
  index: number;
  thought: string;
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>;
  toolResults: Array<{ name: string; result: unknown }>;
  durationMs: number;
  tokenUsage?: { total_tokens?: number };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function advanceAgentTimeline(
  steps: AgentTimelineStep[],
  eventType: string,
  eventData: Record<string, unknown>,
): AgentTimelineStep[] {
  if (eventType === "step_start") {
    return [
      ...steps,
      {
        index: typeof eventData.step === "number" ? eventData.step : steps.length + 1,
        thought: "",
        toolCalls: [],
        toolResults: [],
        durationMs: 0,
      },
    ];
  }

  const last = steps[steps.length - 1];
  if (!last) return steps;
  const preceding = steps.slice(0, -1);

  if ((eventType === "progress" || eventType === "stream_token") && eventData.text) {
    return [...preceding, { ...last, thought: last.thought + readString(eventData.text) }];
  }
  if (eventType === "tool_call") {
    return [
      ...preceding,
      {
        ...last,
        toolCalls: [
          ...last.toolCalls,
          {
            name: readString(eventData.toolName),
            arguments: isRecord(eventData.arguments) ? eventData.arguments : {},
          },
        ],
      },
    ];
  }
  if (eventType === "tool_result") {
    return [
      ...preceding,
      {
        ...last,
        toolResults: [
          ...last.toolResults,
          { name: readString(eventData.toolName), result: eventData.result },
        ],
      },
    ];
  }
  if (eventType === "step_end") {
    return [
      ...preceding,
      {
        ...last,
        durationMs: typeof eventData.durationMs === "number"
          ? eventData.durationMs
          : last.durationMs,
      },
    ];
  }
  return steps;
}

export function useAiProposalRun({
  actionId,
  actionLabel,
  currentConfig,
  actionConfigs,
  useAgent,
  pendingResult,
  lastPrompt,
  setPendingResult,
  setLastPrompt,
  setMessages,
  setAgentSteps,
  setAgentTotalSteps,
  onClearPreview,
  onClearAiSnapshot,
  notify,
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingReply, setStreamingReply] = useState("");
  const [error, setError] = useState("");
  const [cooldownActive, setCooldownActive] = useState(false);
  const [agentRunning, setAgentRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCooldown = useCallback(() => {
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = null;
    setCooldownActive(false);
  }, []);

  const resetRun = useCallback(() => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    clearCooldown();
    setIsGenerating(false);
    setStreamingReply("");
    setError("");
    setAgentRunning(false);
  }, [clearCooldown]);

  useEffect(() => () => {
    runIdRef.current += 1;
    abortRef.current?.abort();
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
  }, []);

  function startCooldown() {
    clearCooldown();
    setCooldownActive(true);
    cooldownTimerRef.current = setTimeout(() => {
      cooldownTimerRef.current = null;
      setCooldownActive(false);
    }, COOLDOWN_MS);
  }

  async function executePrompt(
    runId: number,
    controller: AbortController,
    trimmedPrompt: string,
    modeOverride: string,
    proposalContext,
  ) {
    try {
      if (useAgent) {
        setAgentSteps([]);
        setAgentRunning(true);
        setStreamingReply("");

        const { result: rawResult } = await requestAiAgentRun({
          prompt: trimmedPrompt,
          currentConfig,
          actionConfigs,
          actionLabel,
          actionId,
          taskMode: modeOverride,
          proposalContext,
          signal: controller.signal,
          onEvent: (eventType, data) => {
            if (runId !== runIdRef.current || controller.signal.aborted) return;
            const eventData = isRecord(data) ? data : {};
            if (eventType === "progress" || eventType === "stream_token") {
              const text = readString(eventData.text) || readString(eventData.reply);
              if (text) setStreamingReply((current) => current + text);
            }
            if (eventType === "step_start" && typeof eventData.totalSteps === "number") {
              setAgentTotalSteps(eventData.totalSteps);
            }
            setAgentSteps((current) => advanceAgentTimeline(current, eventType, eventData));
          },
        });
        if (runId !== runIdRef.current || controller.signal.aborted) return;

        setAgentRunning(false);
        setStreamingReply("");
        const proposal = {
          ...rawResult,
          actionId,
          taskMode: modeOverride,
          source: "agent",
          proposalId: rawResult.proposalId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        };
        setPendingResult(proposal);
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: proposal.reply || "Agent 已完成方案生成。",
            kind: "proposal",
          },
        ]);
        notify?.({
          tone: "info",
          title: "Agent 已生成方案提案",
          description: proposal.scheme?.summary || proposal.diffSummary?.[0] || "请确认后再应用。",
        });
        return;
      }

      setStreamingReply("");
      const { result } = await requestAiSchemeEditStreaming({
        prompt: trimmedPrompt,
        currentConfig,
        actionLabel,
        actionId,
        taskMode: modeOverride,
        proposalContext,
        signal: controller.signal,
        onProgress: (replyText) => {
          if (runId === runIdRef.current && !controller.signal.aborted) {
            setStreamingReply(replyText);
          }
        },
      });
      if (runId !== runIdRef.current || controller.signal.aborted) return;

      setStreamingReply("");
      const proposal = {
        ...result,
        actionId,
        taskMode: modeOverride,
        proposalId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      };
      setPendingResult(proposal);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: proposal.reply, kind: "proposal" },
      ]);
      notify?.({
        tone: "info",
        title: "AI 已生成方案提案",
        description: result.scheme?.summary || result.diffSummary?.[0] || "请确认后再应用。",
      });
    } catch (caughtError) {
      if (runId !== runIdRef.current) return;
      setAgentRunning(false);
      if (!controller.signal.aborted) setError(getAiRequestErrorMessage(caughtError));
    } finally {
      if (runId !== runIdRef.current) return;
      setIsGenerating(false);
      setAgentRunning(false);
      abortRef.current = null;
      startCooldown();
    }
  }

  function startPrompt(nextPrompt: string, modeOverride = "modify_action"): boolean {
    const trimmedPrompt = nextPrompt.trim();
    if (!trimmedPrompt || abortRef.current || cooldownActive) return false;

    const proposalContext = pendingResult;
    setError("");
    setIsGenerating(true);
    onClearPreview?.();
    onClearAiSnapshot?.();
    setLastPrompt(trimmedPrompt);

    const isRegeneration = Boolean(pendingResult) && trimmedPrompt === lastPrompt;
    if (isRegeneration) {
      setPendingResult(null);
      setMessages((current) => {
        const last = current[current.length - 1];
        return last?.role === "assistant" ? current.slice(0, -1) : current;
      });
    } else {
      setMessages((current) => [
        ...current,
        { role: "user", content: trimmedPrompt, kind: "chat" },
      ]);
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;
    void executePrompt(runId, controller, trimmedPrompt, modeOverride, proposalContext);
    return true;
  }

  function cancelGeneration() {
    if (!abortRef.current) return;
    const partialContent = streamingReply;
    abortRef.current.abort();
    abortRef.current = null;
    setAgentRunning(false);
    setIsGenerating(false);
    setStreamingReply("");
    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        content: partialContent.trim() ? partialContent : "已取消本次生成。",
        kind: "chat",
      },
    ]);
  }

  return {
    isGenerating,
    streamingReply,
    error,
    cooldownActive,
    agentRunning,
    startPrompt,
    cancelGeneration,
    resetRun,
  };
}
