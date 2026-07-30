import { describe, expect, it } from "vitest";
import {
  createPreviewSimulationState,
  getLongPressProgress,
} from "./usePreviewEngineHost";

describe("preview engine simulation", () => {
  it("creates action-specific simulation state", () => {
    expect(createPreviewSimulationState("leftClick", 500, 1000)).toEqual({ type: "idle" });
    expect(createPreviewSimulationState("doubleClick", 500, 1000)).toEqual({ type: "doubleClick-waiting" });
    expect(createPreviewSimulationState("longPress", 800, 1000)).toEqual({
      type: "longPress-holding",
      startedAt: 1000,
      thresholdMs: 800,
    });
  });

  it("uses the default long-press threshold and clamps progress", () => {
    const state = createPreviewSimulationState("longPress", undefined, 1000);
    expect(state).toMatchObject({ thresholdMs: 420 });
    if (state.type !== "longPress-holding") throw new Error("expected long-press state");
    expect(getLongPressProgress(state, 1210)).toBe(50);
    expect(getLongPressProgress(state, 2000)).toBe(100);
  });
});
