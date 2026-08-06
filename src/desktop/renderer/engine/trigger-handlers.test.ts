import { describe, expect, it, vi } from "vitest";
import type {
  AudioOutput,
  AudioSpec,
  EffectHandle,
  EffectSpec,
  EffectSurface,
} from "@/shared/effect-runtime/contracts";
import { defaultKeyFeedbackConfig } from "@/shared/config/key-feedback";
import { createTriggerHandlers } from "./trigger-handlers";
import type { ConfigStore, EngineState } from "./types";

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
      getActiveTheme: () => ({}),
      isCurrentSiteEnabled: () => true,
      getActionConfig: () => actionConfig,
      getCursorStateBinding: (_theme, stateId, actionId) => ({ stateId, actionId, cursorStateId: stateId }),
      resolveCursorStateId: () => "default",
      matchesTriggerZone: () => true,
    } as ConfigStore;
    const createNode = vi.fn((_spec: EffectSpec): EffectHandle => ({ dispose() {} }));
    const play = vi.fn(async (_spec: AudioSpec): Promise<void> => {});
    const effectSurface: EffectSurface = { createNode, clear: vi.fn() };
    const audioOutput: AudioOutput = { play };
    const state: EngineState = { activeEffects: 0, ready: true };
    const handlers = createTriggerHandlers({
      window: { setTimeout, clearTimeout } as unknown as Window,
      state,
      configStore,
      effectSurface,
      audioOutput,
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

  it("falls back to a click when an armed long press is released early", () => {
    const actionConfigs: Record<string, Record<string, unknown>> = {
      leftClick: { triggerTiming: "按下时", holdMs: 0, textEnabled: true },
      longPress: { triggerTiming: "按住达到时长", holdMs: 420, textEnabled: true },
      doubleClick: { triggerTiming: "第二次松开时", holdMs: 320, textEnabled: true },
    };
    const configStore = {
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
      getActiveTheme: () => ({}),
      isCurrentSiteEnabled: () => true,
      getActionConfig: (_theme, actionId) => actionConfigs[actionId],
      getCursorStateBinding: (_theme, stateId, actionId) => ({ stateId, actionId, cursorStateId: stateId }),
      resolveCursorStateId: () => "default",
      matchesTriggerZone: () => true,
    } as ConfigStore;
    const createNode = vi.fn((_spec: EffectSpec): EffectHandle => ({ dispose() {} }));
    const handlers = createTriggerHandlers({
      window: { setTimeout, clearTimeout } as unknown as Window,
      state: { activeEffects: 0, ready: true },
      configStore,
      effectSurface: { createNode, clear: vi.fn() },
      audioOutput: { play: vi.fn(async () => {}) },
    });

    handlers.handleLeftPointerDown({ type: "mousedown", x: 10, y: 20, button: 0, timestamp: 1 });
    expect(createNode).not.toHaveBeenCalled();
    handlers.handlePointerUp({ type: "mouseup", x: 10, y: 20, button: 0, timestamp: 2 });

    expect(createNode).toHaveBeenCalledOnce();
    expect(createNode).toHaveBeenCalledWith(expect.objectContaining({ kind: "text", actionId: "leftClick" }));
  });

  it("resets gesture state and cancels delayed actions", () => {
    vi.useFakeTimers();
    try {
      const actionConfigs: Record<string, Record<string, unknown>> = {
        leftClick: { triggerTiming: "按下时", holdMs: 0, textEnabled: true },
        rightClick: { triggerTiming: "按下时", holdMs: 120, textEnabled: true },
        longPress: { triggerTiming: "按住达到时长", holdMs: 420, textEnabled: true },
        doubleClick: { triggerTiming: "第二次松开时", holdMs: 320, textEnabled: true },
      };
      const configStore = {
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
        getActiveTheme: () => ({}),
        isCurrentSiteEnabled: () => true,
        getActionConfig: (_theme, actionId) => actionConfigs[actionId],
        getCursorStateBinding: (_theme, stateId, actionId) => ({ stateId, actionId, cursorStateId: stateId }),
        resolveCursorStateId: () => "default",
        matchesTriggerZone: () => true,
      } as ConfigStore;
      const createNode = vi.fn((_spec: EffectSpec): EffectHandle => ({ dispose() {} }));
      const state: EngineState = { activeEffects: 0, ready: true, lastWheelEventAt: 100 };
      const handlers = createTriggerHandlers({
        window: { setTimeout, clearTimeout } as unknown as Window,
        state,
        configStore,
        effectSurface: { createNode, clear: vi.fn() },
        audioOutput: { play: vi.fn(async () => {}) },
      });

      handlers.handleRightPointerDown({ type: "mousedown", x: 10, y: 20, button: 2, timestamp: 1 });
      handlers.handleLeftPointerDown({ type: "mousedown", x: 10, y: 20, button: 0, timestamp: 2 });
      expect(state.longPressState).toBeTruthy();
      expect(state.lastLeftPointerDownAt).toBeGreaterThan(0);

      handlers.reset();
      vi.runAllTimers();

      expect(createNode).not.toHaveBeenCalled();
      expect(state.longPressState).toBeNull();
      expect(state.lastLeftPointerDownAt).toBe(0);
      expect(state.lastLeftPointerUpAt).toBe(0);
      expect(state.lastWheelEventAt).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
