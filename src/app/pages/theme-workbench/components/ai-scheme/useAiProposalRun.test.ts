import { describe, expect, it } from "vitest";
import { advanceAgentTimeline, type AgentTimelineStep } from "./useAiProposalRun";

function createStep(): AgentTimelineStep {
  return {
    index: 1,
    thought: "",
    toolCalls: [],
    toolResults: [],
    durationMs: 0,
  };
}

describe("advanceAgentTimeline", () => {
  it("creates a step and accumulates streamed thought text", () => {
    const started = advanceAgentTimeline([], "step_start", { step: 1 });
    const streamed = advanceAgentTimeline(started, "stream_token", { text: "分析需求" });

    expect(streamed).toEqual([{ ...createStep(), thought: "分析需求" }]);
  });

  it("records tool calls, results, and duration on the active step", () => {
    const called = advanceAgentTimeline([createStep()], "tool_call", {
      toolName: "apply_config_patch",
      arguments: { actionId: "leftClick" },
    });
    const completed = advanceAgentTimeline(called, "tool_result", {
      toolName: "apply_config_patch",
      result: { ok: true },
    });
    const ended = advanceAgentTimeline(completed, "step_end", { durationMs: 42 });

    expect(ended[0]).toMatchObject({
      durationMs: 42,
      toolCalls: [{ name: "apply_config_patch", arguments: { actionId: "leftClick" } }],
      toolResults: [{ name: "apply_config_patch", result: { ok: true } }],
    });
  });

  it("ignores incremental events before a step exists", () => {
    expect(advanceAgentTimeline([], "tool_call", { toolName: "rollback" })).toEqual([]);
  });
});
