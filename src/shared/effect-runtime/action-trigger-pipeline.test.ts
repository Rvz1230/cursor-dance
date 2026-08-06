import { describe, expect, it, vi } from "vitest";
import { createActionTriggerPipeline } from "./action-trigger-pipeline";

function createFixture(overrides: { ready?: boolean; enabled?: boolean } = {}) {
  const actionConfig = { textEnabled: true, triggerTiming: "按下时" };
  const renderEffect = vi.fn();
  const playAudio = vi.fn();
  const log = vi.fn();
  const pipeline = createActionTriggerPipeline({
    state: { ready: overrides.ready ?? true },
    configStore: {
      isCurrentContextEnabled: () => overrides.enabled ?? true,
      getActiveTheme: () => ({}),
      getActionConfig: () => actionConfig,
      getActionTriggerConfig: (config) => config as Record<string, unknown>,
      matchesTriggerZone: () => true,
      resolveCursorStateId: () => "default",
      getCursorStateBinding: (_theme, cursorStateId, actionId) => ({ cursorStateId, actionId }),
    },
    diagnostics: { log },
    now: () => 1_000,
    setTimeout,
    clearTimeout,
    renderEffect,
    playAudio,
  });
  return { log, pipeline, playAudio, renderEffect };
}

describe("shared action trigger pipeline", () => {
  it("resolves an action and emits its output plan", () => {
    const { pipeline, renderEffect } = createFixture();
    pipeline.triggerAction("leftClick", { x: 10, y: 20, target: null, event: null });
    expect(renderEffect).toHaveBeenCalledWith(expect.objectContaining({
      kind: "text",
      actionId: "leftClick",
      x: 10,
      y: 20,
    }));
  });

  it("stops before configuration resolution when runtime is unavailable", () => {
    const notReady = createFixture({ ready: false });
    notReady.pipeline.triggerAction("leftClick", { x: 0, y: 0, target: null, event: null });
    expect(notReady.renderEffect).not.toHaveBeenCalled();
    expect(notReady.log).toHaveBeenCalledWith("action.skip", expect.objectContaining({ reason: "not-ready" }));

    const disabled = createFixture({ enabled: false });
    disabled.pipeline.triggerAction("leftClick", { x: 0, y: 0, target: null, event: null });
    expect(disabled.renderEffect).not.toHaveBeenCalled();
    expect(disabled.log).toHaveBeenCalledWith("action.skip", expect.objectContaining({ reason: "site-disabled" }));
  });

  it("cancels every delayed trigger before it can execute", () => {
    vi.useFakeTimers();
    try {
      const { pipeline, renderEffect } = createFixture();
      const coords = { x: 10, y: 20, target: null, event: null };

      pipeline.scheduleActionTrigger("leftClick", coords, {}, 100);
      pipeline.scheduleActionTrigger("rightClick", coords, {}, 200);
      pipeline.clearPendingTriggers();
      vi.advanceTimersByTime(500);

      expect(renderEffect).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
