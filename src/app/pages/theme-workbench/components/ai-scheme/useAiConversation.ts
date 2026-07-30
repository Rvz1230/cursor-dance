import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteConversation,
  loadConversation,
  saveConversation,
  sweepExpiredConversations,
  type ConversationData,
  type ConversationMessage,
} from "../../lib/storage/ai-conversation";

export interface AiProposal {
  patch?: Record<string, unknown>;
  targets?: unknown[];
  diffSummary?: string[];
  tuningOptions?: string[];
  [key: string]: unknown;
}

export interface AiConversationState {
  messages: ConversationMessage[];
  pendingResult: AiProposal | null;
  lastPrompt: string;
  agentSteps: unknown[];
  agentTotalSteps: number;
  useAgent: boolean;
}

export function createInitialAiMessages(): ConversationMessage[] {
  return [{
    role: "assistant",
    content: "描述你想要的鼠标反馈，我会直接生成或修改当前动作配置。",
    kind: "chat",
  }];
}

export function normalizeConversationState(saved?: ConversationData | null): AiConversationState {
  const pendingResult = saved?.pendingResult;
  return {
    messages: (saved?.messages?.length ? saved.messages : createInitialAiMessages())
      .map((message) => ({ ...message, kind: message.kind || "chat" })),
    pendingResult: pendingResult && typeof pendingResult === "object" && !Array.isArray(pendingResult)
      ? pendingResult as AiProposal
      : null,
    lastPrompt: saved?.lastPrompt ?? "",
    agentSteps: saved?.agentSteps ?? [],
    agentTotalSteps: saved?.agentTotalSteps ?? 0,
    useAgent: saved?.useAgent ?? false,
  };
}

function toPersistedConversation(state: AiConversationState): Omit<ConversationData, "updatedAt"> {
  return {
    messages: state.messages,
    pendingResult: state.pendingResult,
    lastPrompt: state.lastPrompt,
    agentSteps: state.agentSteps,
    agentTotalSteps: state.agentTotalSteps,
    useAgent: state.useAgent,
  };
}

export function useAiConversation(actionId: string) {
  const initial = normalizeConversationState();
  const [messages, setMessages] = useState(initial.messages);
  const [pendingResult, setPendingResult] = useState(initial.pendingResult);
  const [lastPrompt, setLastPrompt] = useState(initial.lastPrompt);
  const [agentSteps, setAgentSteps] = useState(initial.agentSteps);
  const [agentTotalSteps, setAgentTotalSteps] = useState(initial.agentTotalSteps);
  const [useAgent, setUseAgent] = useState(initial.useAgent);
  const [hydratedActionId, setHydratedActionId] = useState<string | null>(null);
  const hydratedActionIdRef = useRef<string | null>(null);
  const activeActionIdRef = useRef<string | null>(null);
  const loadRevisionRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<AiConversationState>(initial);
  stateRef.current = {
    messages,
    pendingResult,
    lastPrompt,
    agentSteps,
    agentTotalSteps,
    useAgent,
  };

  const applyState = useCallback((next: AiConversationState) => {
    stateRef.current = next;
    setMessages(next.messages);
    setPendingResult(next.pendingResult);
    setLastPrompt(next.lastPrompt);
    setAgentSteps(next.agentSteps);
    setAgentTotalSteps(next.agentTotalSteps);
    setUseAgent(next.useAgent);
  }, []);

  useEffect(() => {
    const revision = ++loadRevisionRef.current;
    const previousActionId = activeActionIdRef.current;
    const previousState = stateRef.current;
    const previousWasHydrated = hydratedActionIdRef.current === previousActionId;
    activeActionIdRef.current = actionId;
    hydratedActionIdRef.current = null;
    setHydratedActionId(null);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    applyState(normalizeConversationState());

    async function switchConversation() {
      const savePrevious = previousActionId && previousActionId !== actionId && previousWasHydrated
        ? saveConversation(previousActionId, toPersistedConversation(previousState))
        : Promise.resolve();
      const [, saved] = await Promise.all([savePrevious, loadConversation(actionId)]);
      if (revision !== loadRevisionRef.current) return;
      applyState(normalizeConversationState(saved));
      hydratedActionIdRef.current = actionId;
      setHydratedActionId(actionId);
    }

    void switchConversation();
  }, [actionId, applyState]);

  useEffect(() => {
    void sweepExpiredConversations();
  }, []);

  useEffect(() => {
    if (hydratedActionId !== actionId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void saveConversation(actionId, toPersistedConversation(stateRef.current));
    }, 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };
  }, [actionId, hydratedActionId, messages, pendingResult, lastPrompt, agentSteps, agentTotalSteps, useAgent]);

  useEffect(() => () => {
    loadRevisionRef.current += 1;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const activeActionId = activeActionIdRef.current;
    if (activeActionId && hydratedActionIdRef.current === activeActionId) {
      void saveConversation(activeActionId, toPersistedConversation(stateRef.current));
    }
  }, []);

  function clearConversation() {
    applyState({ ...normalizeConversationState(), useAgent });
    void deleteConversation(actionId);
  }

  return {
    messages,
    setMessages,
    pendingResult,
    setPendingResult,
    lastPrompt,
    setLastPrompt,
    agentSteps,
    setAgentSteps,
    agentTotalSteps,
    setAgentTotalSteps,
    useAgent,
    setUseAgent,
    clearConversation,
  };
}
