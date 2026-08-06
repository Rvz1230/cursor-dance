import { describe, expect, it, vi } from "vitest";
import { createContentTriggerHandlers } from "./trigger-handlers";

function createFixture() {
  const configs: Record<string, Record<string, unknown> | undefined> = {
    leftClick: { triggerTiming: "按下时", textEnabled: true },
    doubleClick: { triggerTiming: "第二次松开时", holdMs: 320 },
    hover: { triggerTiming: "进入时", textEnabled: true },
  };
  const renderText = vi.fn();
  const syncStateCursorOverlay = vi.fn();
  const runtime = {
    window: { setTimeout, clearTimeout } as unknown as Window,
    document: { body: {}, defaultView: null } as unknown as Document,
    state: {
      ready: true,
      lastWheelEventAt: 0,
      hoverTimeoutId: null,
      hoverTarget: null,
    },
    configStore: {
      isCurrentSiteEnabled: () => true,
      getActiveTheme: () => ({}),
      getConfig: () => ({ themes: [] }),
      getActionConfig: (_theme: unknown, actionId: string) => configs[actionId],
      getActionTriggerConfig: (config: unknown) => (config || {}) as Record<string, unknown>,
      matchesTriggerZone: () => true,
      resolveCursorStateId: () => "default",
      getCursorStateBinding: (_theme: unknown, cursorStateId: string, actionId: string) => ({
        actionId,
        cursorStateId,
      }),
    },
    visualEffects: {
      renderText,
      renderRipple: vi.fn(),
      renderAnimationEffect: vi.fn(),
      renderImageEffect: vi.fn(),
      renderParticles: vi.fn(),
      renderOrbitalParticles: vi.fn(),
      clearOrbitalParticles: vi.fn(),
      clearAllEffects: vi.fn(),
      ensureRoot: vi.fn(),
      renderCursorOverride: vi.fn(),
    },
    audioRuntime: { playSound: vi.fn() },
    cursorOverlay: {
      syncStateCursorOverlay,
      clearStateCursorOverlay: vi.fn(),
    },
  };
  const handlers = createContentTriggerHandlers(
    runtime as unknown as Parameters<typeof createContentTriggerHandlers>[0],
  );
  return { handlers, renderText, syncStateCursorOverlay };
}

function pointerEvent(overrides: Partial<PointerEvent> = {}): PointerEvent {
  return {
    button: 0,
    buttons: 1,
    clientX: 10,
    clientY: 20,
    pointerId: 1,
    target: null,
    relatedTarget: null,
    ...overrides,
  } as PointerEvent;
}

describe("extension trigger handlers adapter", () => {
  it("routes a primary pointer action through the shared trigger pipeline", () => {
    const { handlers, renderText } = createFixture();
    handlers.handleLeftPointerDown(pointerEvent());
    expect(renderText).toHaveBeenCalledWith(10, 20, expect.any(Object), "leftClick", 1);

    handlers.handleLeftPointerDown(pointerEvent({ button: 2 }));
    expect(renderText).toHaveBeenCalledTimes(1);
  });

  it("keeps hover and cursor synchronization in the DOM adapter", () => {
    const { handlers, renderText, syncStateCursorOverlay } = createFixture();
    const event = pointerEvent({ target: {} as EventTarget });
    handlers.handlePointerOver(event);
    expect(syncStateCursorOverlay).toHaveBeenCalledWith(event);
    expect(renderText).toHaveBeenCalledWith(10, 20, expect.any(Object), "hover", 1);
  });
});
