import { describe, expect, it } from "vitest";
import { createVisualEffects } from "@/shared/effect-runtime/dom-effect-surface";
import { contentVisualEffectsFactory } from "./visual-effects";

describe("extension visual effects registration", () => {
  it("registers the shared DOM effect surface", () => {
    expect(contentVisualEffectsFactory).toBe(createVisualEffects);
    expect(globalThis.CursorDanceContentModules?.createVisualEffects).toBe(createVisualEffects);
  });
});
