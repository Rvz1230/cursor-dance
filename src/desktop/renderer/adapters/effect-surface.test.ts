import { describe, expect, it, vi } from "vitest";
import type { EffectHandle } from "@/shared/effect-runtime/contracts";
import type { VisualEffectsModule } from "../engine/types";
import { createDesktopEffectSurface } from "./effect-surface";

function createHarness() {
  const handle: EffectHandle = { dispose: vi.fn() };
  const visualEffects = {
    renderText: vi.fn(() => handle),
    renderRipple: vi.fn(() => handle),
    renderParticles: vi.fn(() => handle),
    renderOrbitalParticles: vi.fn(() => handle),
    renderAnimationEffect: vi.fn(() => handle),
    renderImageEffect: vi.fn(() => handle),
    renderCursorOverride: vi.fn(() => handle),
    clearEffects: vi.fn(),
  } as unknown as VisualEffectsModule;
  return { handle, visualEffects, surface: createDesktopEffectSurface(visualEffects) };
}

describe("desktop effect surface", () => {
  it("maps shared effect specs to the desktop visual runtime", () => {
    const { handle, visualEffects, surface } = createHarness();
    const actionConfig = { particle: true };

    expect(surface.createNode({
      kind: "text",
      x: 10,
      y: 20,
      actionConfig,
      actionId: "leftClick",
      runIndex: 3,
    })).toBe(handle);
    expect(visualEffects.renderText).toHaveBeenCalledWith(10, 20, actionConfig, "leftClick", 3);

    surface.createNode({
      kind: "particle",
      x: 30,
      y: 40,
      actionConfig,
      actionId: "wheel",
      runIndex: 2,
      particleMode: "orbital",
    });
    expect(visualEffects.renderOrbitalParticles).toHaveBeenCalledWith(30, 40, actionConfig, 2, "wheel");

    surface.createNode({ kind: "particle", x: 1, y: 2, actionConfig, particleMode: "burst" });
    expect(visualEffects.renderParticles).toHaveBeenCalledWith(1, 2, actionConfig, 1);
  });

  it("delegates complete cleanup to the visual runtime", () => {
    const { visualEffects, surface } = createHarness();
    surface.clear();
    expect(visualEffects.clearEffects).toHaveBeenCalledOnce();
  });
});
