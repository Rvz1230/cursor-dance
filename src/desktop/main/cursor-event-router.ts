import type { NativeCursorEvent } from "./native-events";

export interface DisplayBounds {
  id: number;
  bounds: { x: number; y: number; width: number; height: number };
}

export type RoutedCursorEvent = NativeCursorEvent | (
  Omit<NativeCursorEvent, "type"> & { type: "leave" }
);

type FrameHandle = ReturnType<typeof setTimeout>;

export interface CursorEventRouter {
  route(event: NativeCursorEvent): void;
  flushPendingMove(): void;
  removeDisplay(displayId: number): void;
  getActiveDisplayId(): number | null;
  stop(): void;
}

function containsPoint(display: DisplayBounds, x: number, y: number): boolean {
  const { bounds } = display;
  return x >= bounds.x
    && y >= bounds.y
    && x < bounds.x + bounds.width
    && y < bounds.y + bounds.height;
}

export function createCursorEventRouter({
  getDisplays,
  toDipPoint,
  sendToDisplay,
  scheduleFrame = (callback) => setTimeout(callback, 16),
  cancelFrame = clearTimeout,
}: {
  getDisplays: () => DisplayBounds[];
  toDipPoint: (point: { x: number; y: number }) => { x: number; y: number };
  sendToDisplay: (displayId: number, event: RoutedCursorEvent) => void;
  scheduleFrame?: (callback: () => void) => FrameHandle;
  cancelFrame?: (handle: FrameHandle) => void;
}): CursorEventRouter {
  let activeDisplayId: number | null = null;
  let pendingMove: { displayId: number; event: NativeCursorEvent } | null = null;
  let pendingFrame: FrameHandle | null = null;
  let lastEvent: NativeCursorEvent | null = null;

  function cancelPendingMove(): void {
    if (pendingFrame) cancelFrame(pendingFrame);
    pendingFrame = null;
    pendingMove = null;
  }

  function flushPendingMove(): void {
    if (pendingFrame) cancelFrame(pendingFrame);
    pendingFrame = null;
    const pending = pendingMove;
    pendingMove = null;
    if (!pending || pending.displayId !== activeDisplayId) return;
    sendToDisplay(pending.displayId, pending.event);
  }

  function sendLeave(displayId: number, event: NativeCursorEvent | null): void {
    sendToDisplay(displayId, {
      type: "leave",
      x: event?.x ?? 0,
      y: event?.y ?? 0,
      buttons: event?.buttons,
      timestamp: event?.timestamp ?? Date.now(),
    });
  }

  function transitionTo(displayId: number | null, event: NativeCursorEvent): void {
    if (displayId === activeDisplayId) return;
    cancelPendingMove();
    if (activeDisplayId !== null) sendLeave(activeDisplayId, event);
    activeDisplayId = displayId;
  }

  function route(rawEvent: NativeCursorEvent): void {
    const point = toDipPoint(rawEvent);
    const event = { ...rawEvent, x: point.x, y: point.y };
    lastEvent = event;
    const target = getDisplays().find((display) => containsPoint(display, event.x, event.y));
    transitionTo(target?.id ?? null, event);
    if (!target) return;

    if (event.type === "mousemove") {
      pendingMove = { displayId: target.id, event };
      if (!pendingFrame) {
        pendingFrame = scheduleFrame(() => {
          pendingFrame = null;
          const queued = pendingMove;
          pendingMove = null;
          if (queued && queued.displayId === activeDisplayId) {
            sendToDisplay(queued.displayId, queued.event);
          }
        });
      }
      return;
    }

    // Preserve input ordering when a click/wheel arrives before the next frame.
    flushPendingMove();
    sendToDisplay(target.id, event);
  }

  function removeDisplay(displayId: number): void {
    if (pendingMove?.displayId === displayId) cancelPendingMove();
    if (activeDisplayId === displayId) {
      sendLeave(displayId, lastEvent);
      activeDisplayId = null;
    }
  }

  function stop(): void {
    cancelPendingMove();
    activeDisplayId = null;
    lastEvent = null;
  }

  return {
    route,
    flushPendingMove,
    removeDisplay,
    getActiveDisplayId: () => activeDisplayId,
    stop,
  };
}
