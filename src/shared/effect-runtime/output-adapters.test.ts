import { describe, expect, it, vi } from "vitest";
import type { AudioRuntimeModule } from "./audio-runtime";
import type { EffectHandle } from "./contracts";
import type { VisualEffectsModule } from "./dom-effect-surface";
import { createDomEffectSurface, createWebAudioOutput } from "./output-adapters";

function createEffectHarness() {
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
  return { handle, visualEffects, surface: createDomEffectSurface(visualEffects) };
}

describe("runtime output adapters", () => {
  it("maps effect specs to the DOM visual runtime", () => {
    const { handle, visualEffects, surface } = createEffectHarness();
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
    const { visualEffects, surface } = createEffectHarness();
    surface.clear();
    expect(visualEffects.clearEffects).toHaveBeenCalledOnce();
  });

  it("maps audio specs to the Web Audio runtime", async () => {
    const audioRuntime: AudioRuntimeModule = { playSound: vi.fn(), suspend: vi.fn() };
    const output = createWebAudioOutput(audioRuntime);
    const actionConfig = { sound: true, volume: 80 };

    await output.play({ actionConfig, actionId: "doubleClick", comboIndex: 4 });

    expect(audioRuntime.playSound).toHaveBeenCalledWith(
      actionConfig,
      "doubleClick",
      { comboIndex: 4 },
    );
  });
});
