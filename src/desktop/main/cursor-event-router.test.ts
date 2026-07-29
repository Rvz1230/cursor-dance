import { describe, expect, it } from "vitest";
import { createCursorEventRouter, type RoutedCursorEvent } from "./cursor-event-router";
import type { NativeCursorEvent } from "./native-events";

const displays = [
  { id: 1, bounds: { x: 0, y: 0, width: 100, height: 100 } },
  { id: 2, bounds: { x: 100, y: 0, width: 100, height: 100 } },
];

function cursorEvent(
  type: NativeCursorEvent["type"],
  x: number,
  y = 20,
): NativeCursorEvent {
  return { type, x, y, buttons: 0, timestamp: x };
}

function createHarness(toDipPoint = (point: { x: number; y: number }) => point) {
  const sent = new Map<number, RoutedCursorEvent[]>(displays.map((display) => [display.id, []]));
  let scheduled: (() => void) | null = null;
  const router = createCursorEventRouter({
    getDisplays: () => displays,
    toDipPoint,
    sendToDisplay: (displayId, event) => sent.get(displayId)?.push(event),
    scheduleFrame: (callback) => {
      scheduled = callback;
      return 1 as unknown as ReturnType<typeof setTimeout>;
    },
    cancelFrame: () => {
      scheduled = null;
    },
  });

  return {
    router,
    sent,
    runFrame() {
      const callback = scheduled;
      scheduled = null;
      callback?.();
    },
    hasScheduledFrame: () => scheduled !== null,
  };
}

describe("cursor event router", () => {
  it("routes immediate events only to the display containing the pointer", () => {
    const harness = createHarness();
    harness.router.route(cursorEvent("mousedown", 20));
    harness.router.route(cursorEvent("mousedown", 120));

    expect(harness.sent.get(1)?.map((event) => event.type)).toEqual(["mousedown", "leave"]);
    expect(harness.sent.get(2)?.map((event) => event.type)).toEqual(["mousedown"]);
  });

  it("coalesces high-frequency mousemove events to the latest event per frame", () => {
    const harness = createHarness();
    for (let x = 1; x <= 90; x += 1) {
      harness.router.route(cursorEvent("mousemove", x));
    }

    expect(harness.hasScheduledFrame()).toBe(true);
    expect(harness.sent.get(1)).toEqual([]);
    harness.runFrame();
    expect(harness.sent.get(1)).toEqual([expect.objectContaining({ type: "mousemove", x: 90 })]);
  });

  it("flushes a pending move before a non-move event to preserve ordering", () => {
    const harness = createHarness();
    harness.router.route(cursorEvent("mousemove", 30));
    harness.router.route(cursorEvent("mousedown", 31));

    expect(harness.sent.get(1)?.map((event) => event.type)).toEqual(["mousemove", "mousedown"]);
    expect(harness.hasScheduledFrame()).toBe(false);
  });

  it("uses half-open display bounds and clears the previous overlay when crossing screens", () => {
    const harness = createHarness();
    harness.router.route(cursorEvent("mousemove", 99));
    harness.runFrame();
    harness.router.route(cursorEvent("mousemove", 100));

    expect(harness.sent.get(1)?.map((event) => event.type)).toEqual(["mousemove", "leave"]);
    harness.runFrame();
    expect(harness.sent.get(2)).toEqual([expect.objectContaining({ type: "mousemove", x: 100 })]);
    expect(harness.router.getActiveDisplayId()).toBe(2);
  });

  it("cancels pending work and sends leave before a display is removed", () => {
    const harness = createHarness();
    harness.router.route(cursorEvent("mousemove", 120));
    harness.router.removeDisplay(2);

    expect(harness.hasScheduledFrame()).toBe(false);
    expect(harness.sent.get(2)?.map((event) => event.type)).toEqual(["leave"]);
    expect(harness.router.getActiveDisplayId()).toBeNull();
  });

  it("converts native physical coordinates to DIP before display lookup and delivery", () => {
    const harness = createHarness(({ x, y }) => ({ x: x / 2, y: y / 2 }));
    harness.router.route(cursorEvent("mousedown", 250, 40));

    expect(harness.sent.get(1)).toEqual([]);
    expect(harness.sent.get(2)).toEqual([
      expect.objectContaining({ type: "mousedown", x: 125, y: 20 }),
    ]);
  });
});
