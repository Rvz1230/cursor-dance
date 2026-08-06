import { describe, expect, it } from "vitest";
import { createInitialAiMessages, normalizeConversationState } from "./useAiConversation";

describe("normalizeConversationState", () => {
  it("creates a fresh conversation when storage is empty", () => {
    expect(normalizeConversationState()).toEqual({
      messages: createInitialAiMessages(),
      pendingResult: null,
      lastPrompt: "",
      agentSteps: [],
      agentTotalSteps: 0,
      useAgent: false,
    });
  });

  it("normalizes legacy messages without a display kind", () => {
    expect(normalizeConversationState({
      messages: [{ role: "user", content: "低调一些" }],
      pendingResult: { proposalId: "proposal-1" },
      lastPrompt: "低调一些",
      agentSteps: [{ index: 1 }],
      agentTotalSteps: 2,
      useAgent: true,
      updatedAt: 1,
    })).toMatchObject({
      messages: [{ role: "user", content: "低调一些", kind: "chat" }],
      pendingResult: { proposalId: "proposal-1" },
      lastPrompt: "低调一些",
      agentTotalSteps: 2,
      useAgent: true,
    });
  });

  it("drops malformed persisted proposals", () => {
    expect(normalizeConversationState({
      messages: [],
      pendingResult: "invalid",
      lastPrompt: "",
      agentSteps: [],
      useAgent: false,
      updatedAt: 1,
    }).pendingResult).toBeNull();
  });
});
