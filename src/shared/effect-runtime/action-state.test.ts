import { describe, expect, it } from "vitest";
import {
  decideActionExecution,
  getActionOutputSummary,
  getActionTimingMs,
  type ActionExecutionInput,
  type ActionRuntimeState,
} from "./action-state";

function createInput(overrides: Partial<ActionExecutionInput> = {}): ActionExecutionInput {
  return {
    sourceActionId: "leftClick",
    resolvedActionId: "leftClick",
    x: 10,
    y: 20,
    actionConfig: { textEnabled: true, comboWindowMs: 900 },
    sourceTriggerConfig: {},
    now: 10_000,
    ...overrides,
  };
}

describe("shared action state machine", () => {
  it("normalizes timing semantics for every trigger family", () => {
    expect(getActionTimingMs("leftClick", { holdMs: 420 })).toBe(0);
    expect(getActionTimingMs("doubleClick", { holdMs: 420 })).toBe(320);
    expect(getActionTimingMs("wheel", { holdMs: 420 })).toBe(180);
    expect(getActionTimingMs("hover", { holdMs: 420 })).toBe(220);
    expect(getActionTimingMs("longPress", { holdMs: 2_000 })).toBe(900);
  });

  it("does not advance state when the action has no enabled output", () => {
    const state: ActionRuntimeState = {};
    const decision = decideActionExecution(state, createInput({ actionConfig: {} }));

    expect(decision).toMatchObject({ status: "skip", reason: "no-enabled-effects" });
    expect(state).toEqual({});
  });

  it("throttles by source action and advances run/combo state only when fired", () => {
    const state: ActionRuntimeState = {};
    const first = decideActionExecution(state, createInput());
    const throttled = decideActionExecution(state, createInput({ now: 10_020 }));
    const forced = decideActionExecution(state, createInput({ now: 10_020, force: true }));

    expect(first).toMatchObject({ status: "fire", runIndex: 1, comboIndex: 1 });
    expect(throttled).toMatchObject({ status: "skip", reason: "throttled", elapsedMs: 20, throttleMs: 40 });
    expect(forced).toMatchObject({ status: "fire", runIndex: 2, comboIndex: 2 });
  });

  it("resets combo state after the configured window", () => {
    const state: ActionRuntimeState = {};
    decideActionExecution(state, createInput({ actionConfig: { textEnabled: true, comboWindowMs: 120 } }));
    const decision = decideActionExecution(state, createInput({
      actionConfig: { textEnabled: true, comboWindowMs: 120 },
      now: 10_121,
    }));

    expect(decision).toMatchObject({ status: "fire", runIndex: 2, comboIndex: 1, comboWindowMs: 120 });
  });

  it("builds only enabled outputs in stable render order", () => {
    const actionConfig = {
      textEnabled: true,
      particle: true,
      particleMotionMode: "orbital",
      ripple: true,
      sound: true,
      imageEnabled: true,
      imageAssetId: "sha256:asset",
      cursorOverride: "切换到 pointer",
    };
    const outputs = getActionOutputSummary(actionConfig);
    const decision = decideActionExecution({}, createInput({ actionConfig }));

    expect(outputs.imageEnabled).toBe(true);
    expect(decision.status).toBe("fire");
    if (decision.status !== "fire") return;
    expect(decision.outputPlan.effects.map((effect) => effect.kind)).toEqual([
      "ripple",
      "particle",
      "text",
      "image",
      "cursor",
    ]);
    expect(decision.outputPlan.effects[1]).toMatchObject({ particleMode: "orbital", runIndex: 1 });
    expect(decision.outputPlan.audio).toMatchObject({ actionId: "leftClick", comboIndex: 1, runIndex: 1 });
  });
});
