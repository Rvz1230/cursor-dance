import { describe, expect, it, vi } from "vitest";
import type {
  AudioOutput,
  AudioSpec,
  EffectHandle,
  EffectSpec,
  EffectSurface,
} from "@/shared/effect-runtime/contracts";
import { defaultKeyFeedbackConfig } from "./key-feedback-types";
import { createTriggerHandlers } from "./trigger-handlers";
import type { ConfigStore, CursorOverlayModule, EngineState } from "./types";

describe("trigger handlers runtime adapters", () => {
  it("emits ordered effect specs and one audio spec for an action", async () => {
    const actionConfig = {
      triggerTiming: "连续滚动中",
      holdMs: 80,
      textEnabled: true,
      particle: true,
      particleMotionMode: "orbital",
      ripple: true,
      sound: true,
      volume: 80,
      animationEnabled: true,
      imageEnabled: true,
      imageDataUrl: "data:image/png;base64,AA==",
      cursorOverride: "切换到 pointer",
    };
    const configStore: ConfigStore = {
      getActionTextConfig: (config) => config || {},
      getActionRippleConfig: (config) => config || {},
      getActionParticleConfig: (config) => config || {},
      getActionAnimationConfig: (config) => config || {},
      getActionImageConfig: (config) => config || {},
      getActionCursorFeedbackConfig: (config) => config || {},
      getActionAudioConfig: (config) => config || {},
      getActionTriggerConfig: (config) => config || {},
      getMaxActiveEffects: () => 48,
      getKeyFeedbackConfig: () => defaultKeyFeedbackConfig,
      getActiveScheme: () => ({}),
      isCurrentSiteEnabled: () => true,
      getActionConfig: () => actionConfig,
      getCursorStateBinding: (_scheme, stateId, actionId) => ({ stateId, actionId, cursorStateId: stateId }),
      resolveCursorStateId: () => "default",
      matchesTriggerZone: () => true,
    } as ConfigStore;
    const createNode = vi.fn((_spec: EffectSpec): EffectHandle => ({ dispose() {} }));
    const play = vi.fn(async (_spec: AudioSpec): Promise<void> => {});
    const effectSurface: EffectSurface = { createNode, clear: vi.fn() };
    const audioOutput: AudioOutput = { play };
    const state: EngineState = { activeEffects: 0, ready: true };
    const cursorOverlay: CursorOverlayModule = {
      syncStateCursorOverlay: vi.fn(),
      clearStateCursorOverlay: vi.fn(),
    };
    const handlers = createTriggerHandlers({
      window: { setTimeout, clearTimeout } as unknown as Window,
      document: {} as Document,
      state,
      configStore,
      effectSurface,
      audioOutput,
      cursorOverlay,
    });

    handlers.handleWheel({ type: "wheel", x: 10, y: 20, deltaY: 100, timestamp: 1 });
    await Promise.resolve();

    expect(createNode.mock.calls.map(([spec]) => spec.kind)).toEqual([
      "ripple",
      "particle",
      "text",
      "animation",
      "image",
      "cursor",
    ]);
    expect(createNode.mock.calls[1][0]).toMatchObject({
      particleMode: "orbital",
      actionId: "wheel",
      runIndex: 1,
    });
    expect(play).toHaveBeenCalledWith(expect.objectContaining({
      actionId: "wheel",
      comboIndex: 1,
    }));
  });
});
