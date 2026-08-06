import { describe, expect, it, vi } from "vitest";
import {
  createDoubleClickDetector,
  createLongPressTracker,
  type GestureRuntimeState,
} from "./gesture-state";

describe("shared gesture state", () => {
  it("tracks down/up double-click windows independently", () => {
    let now = 1_000;
    const state: GestureRuntimeState = {};
    const detector = createDoubleClickDetector({ state, now: () => now });

    expect(detector.checkDown(300).isDouble).toBe(false);
    detector.recordDown();
    now = 1_250;
    expect(detector.checkDown(300).isDouble).toBe(true);
    expect(detector.checkUp(300).isDouble).toBe(false);
    detector.recordUp();
    now = 1_500;
    expect(detector.checkUp(300).isDouble).toBe(true);
    detector.reset();
    expect(state).toMatchObject({ lastLeftPointerDownAt: 0, lastLeftPointerUpAt: 0 });
  });

  it("fires timeout-mode long press once and resets double-click state", () => {
    let timeoutCallback: (() => void) | undefined;
    const state: GestureRuntimeState = {};
    const fireAction = vi.fn();
    const resetDoubleClick = vi.fn();
    const tracker = createLongPressTracker({
      state,
      now: () => 1_000,
      timers: {
        setTimeout(callback) { timeoutCallback = callback; return 1; },
        clearTimeout: vi.fn(),
      },
      fireAction,
      resetDoubleClick,
    });

    tracker.arm({ x: 10, y: 20, target: "target" }, {
      theme: "theme",
      releaseMode: false,
      thresholdMs: 420,
    });
    timeoutCallback?.();
    timeoutCallback?.();

    expect(resetDoubleClick).toHaveBeenCalledOnce();
    expect(fireAction).toHaveBeenCalledOnce();
    expect(fireAction).toHaveBeenCalledWith(10, 20, "target", null, "theme", 420, "longpress-timeout");
    expect(tracker.isFiredOrTriggered()).toBe(true);
  });

  it("fires release-mode long press at release coordinates and clears state", () => {
    let now = 1_000;
    const state: GestureRuntimeState = {};
    const fireAction = vi.fn();
    const tracker = createLongPressTracker({
      state,
      now: () => now,
      timers: { setTimeout: () => 1, clearTimeout: vi.fn() },
      fireAction,
      resetDoubleClick: vi.fn(),
    });

    tracker.arm({ x: 10, y: 20 }, { theme: "theme", releaseMode: true, thresholdMs: 300 });
    now = 1_320;
    tracker.finish({ x: 30, y: 40, target: "release-target", rawEvent: "raw" });

    expect(fireAction).toHaveBeenCalledWith(30, 40, "release-target", "raw", "theme", 300, "longpress-release");
    expect(state.longPressState).toBeNull();
  });

  it("clears the previous timer when re-armed", () => {
    const clearTimeout = vi.fn();
    const timeoutCallbacks: Array<() => void> = [];
    let timeoutId = 0;
    const fireAction = vi.fn();
    const tracker = createLongPressTracker({
      state: {},
      timers: {
        setTimeout(callback) {
          timeoutCallbacks.push(callback);
          return ++timeoutId;
        },
        clearTimeout,
      },
      fireAction,
      resetDoubleClick: vi.fn(),
    });

    tracker.arm({ x: 1, y: 2 }, { theme: null, releaseMode: false, thresholdMs: 300 });
    tracker.arm({ x: 3, y: 4 }, { theme: null, releaseMode: false, thresholdMs: 300 });

    expect(clearTimeout).toHaveBeenCalledWith(1);
    timeoutCallbacks[0]?.();
    expect(fireAction).not.toHaveBeenCalled();
    timeoutCallbacks[1]?.();
    expect(fireAction).toHaveBeenCalledOnce();
  });
});
