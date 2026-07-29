import { describe, expect, it } from "vitest";
import { configHelpers, effectRuntime } from "./runtime-globals";

describe("extension shared runtime globals", () => {
  it("publishes effect-core helpers and the action state machine", () => {
    expect(globalThis.CursorDanceConfigHelpers).toBe(configHelpers);
    expect(globalThis.CursorDanceEffectRuntime).toBe(effectRuntime);
    expect(typeof configHelpers.computeParticleSpecs).toBe("function");
    expect(typeof configHelpers.resolveActionTextConfigFromEffect).toBe("function");
    expect(typeof effectRuntime.decideActionExecution).toBe("function");
    expect(effectRuntime.getActionTimingMs("hover", { holdMs: 420 })).toBe(220);
  });
});
