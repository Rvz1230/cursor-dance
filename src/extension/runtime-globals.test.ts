import { describe, expect, it } from "vitest";
import { configHelpers } from "./runtime-globals";

describe("extension shared runtime globals", () => {
  it("publishes effect-core helpers required by the legacy config adapter", () => {
    expect(globalThis.CursorDanceConfigHelpers).toBe(configHelpers);
    expect(typeof configHelpers.computeParticleSpecs).toBe("function");
    expect(typeof configHelpers.resolveActionTextConfigFromEffect).toBe("function");
  });
});
