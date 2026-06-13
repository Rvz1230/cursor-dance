import { describe, it, expect } from "vitest";
import { createEffectEngine } from "./entry";

describe("createEffectEngine (placeholder)", () => {
  it("returns the four sub-modules", () => {
    const engine = createEffectEngine({
      window: globalThis as unknown as Window,
      document: {} as Document,
      configStore: {},
    });
    expect(engine).toEqual({
      visualEffects: {},
      cursorOverlay: {},
      audioRuntime: {},
      triggerHandlers: {},
    });
  });
});
