export interface GesturePointerEvent {
  x: number;
  y: number;
  pointerId?: number;
  target?: unknown;
  rawEvent?: unknown;
}

export interface LongPressState {
  startedAt: number;
  pointerId?: number;
  x: number;
  y: number;
  target: unknown;
  scheme: unknown;
  triggered: boolean;
  fired: boolean;
  releaseMode: boolean;
  thresholdMs: number;
  timeoutId?: unknown;
}

export interface GestureRuntimeState {
  lastLeftPointerDownAt?: number;
  lastLeftPointerUpAt?: number;
  longPressState?: LongPressState | null;
}

type RuntimeLog = (scope: string, payload: Record<string, unknown>) => void;

export interface DoubleClickDetector {
  checkDown(windowMs: number): { isDouble: boolean };
  recordDown(): void;
  checkUp(windowMs: number): { isDouble: boolean };
  recordUp(): void;
  reset(): void;
}

export function createDoubleClickDetector(deps: {
  state: GestureRuntimeState;
  now?: () => number;
  log?: RuntimeLog;
}): DoubleClickDetector {
  const now = deps.now || Date.now;

  function check(kind: "Down" | "Up", windowMs: number): { isDouble: boolean } {
    const stateKey = kind === "Down" ? "lastLeftPointerDownAt" : "lastLeftPointerUpAt";
    const triggerSource = kind === "Down" ? "double-click-down" : "double-click-up";
    if (now() - (deps.state[stateKey] || 0) <= windowMs) return { isDouble: true };
    deps.log?.("action.arm", { actionId: "doubleClick", triggerSource, windowMs });
    return { isDouble: false };
  }

  return {
    checkDown: (windowMs) => check("Down", windowMs),
    recordDown: () => { deps.state.lastLeftPointerDownAt = now(); },
    checkUp: (windowMs) => check("Up", windowMs),
    recordUp: () => { deps.state.lastLeftPointerUpAt = now(); },
    reset: () => {
      deps.state.lastLeftPointerDownAt = 0;
      deps.state.lastLeftPointerUpAt = 0;
    },
  };
}

export interface LongPressTracker {
  arm(event: GesturePointerEvent, options: {
    scheme: unknown;
    target?: unknown;
    releaseMode: boolean;
    thresholdMs: number;
  }): boolean;
  finish(event: GesturePointerEvent | null): void;
  cancel(): void;
  forceClear(): void;
  readonly isArmed: boolean;
  isFiredOrTriggered(): boolean;
}

export function createLongPressTracker(deps: {
  state: GestureRuntimeState;
  timers: {
    setTimeout(callback: () => void, delayMs: number): unknown;
    clearTimeout(timeoutId: unknown): void;
  };
  now?: () => number;
  log?: RuntimeLog;
  fireAction: (
    x: number,
    y: number,
    target: unknown,
    rawEvent: unknown,
    scheme: unknown,
    throttleMs: number,
    triggerSource: string,
  ) => void;
  resetDoubleClick: () => void;
}): LongPressTracker {
  const now = deps.now || Date.now;

  function clearTimer(state: LongPressState): void {
    if (state.timeoutId !== undefined) deps.timers.clearTimeout(state.timeoutId);
  }

  function arm(event: GesturePointerEvent, options: {
    scheme: unknown;
    target?: unknown;
    releaseMode: boolean;
    thresholdMs: number;
  }): boolean {
    const previous = deps.state.longPressState;
    if (previous) clearTimer(previous);
    const longPressState: LongPressState = {
      startedAt: now(),
      pointerId: event.pointerId,
      x: event.x,
      y: event.y,
      target: options.target ?? event.target,
      scheme: options.scheme,
      triggered: false,
      fired: false,
      releaseMode: options.releaseMode,
      thresholdMs: options.thresholdMs,
    };
    deps.state.longPressState = longPressState;
    deps.log?.("action.arm", {
      actionId: "longPress",
      triggerSource: "longpress-arm",
      thresholdMs: longPressState.thresholdMs,
    });

    longPressState.timeoutId = deps.timers.setTimeout(() => {
      const current = deps.state.longPressState;
      if (current !== longPressState || current.triggered) return;
      current.triggered = true;
      deps.resetDoubleClick();
      if (current.releaseMode || current.fired) return;
      current.fired = true;
      deps.fireAction(
        current.x,
        current.y,
        current.target,
        null,
        current.scheme,
        current.thresholdMs,
        "longpress-timeout",
      );
    }, longPressState.thresholdMs);
    return true;
  }

  function finish(event: GesturePointerEvent | null): void {
    const current = deps.state.longPressState;
    if (!current) return;
    clearTimer(current);
    const duration = now() - current.startedAt;
    if (current.releaseMode && duration >= current.thresholdMs && !current.fired) {
      current.fired = true;
      deps.resetDoubleClick();
      deps.fireAction(
        event?.x ?? current.x,
        event?.y ?? current.y,
        event?.target ?? current.target,
        event?.rawEvent ?? null,
        current.scheme,
        current.thresholdMs,
        "longpress-release",
      );
    }
    deps.state.longPressState = null;
  }

  function cancel(): void {
    const current = deps.state.longPressState;
    if (!current) return;
    clearTimer(current);
    deps.log?.("action.skip", { actionId: "longPress", reason: "longpress-cancelled" });
    deps.state.longPressState = null;
  }

  function forceClear(): void {
    const current = deps.state.longPressState;
    if (!current) return;
    clearTimer(current);
    deps.state.longPressState = null;
  }

  return {
    arm,
    finish,
    cancel,
    forceClear,
    get isArmed() { return deps.state.longPressState != null; },
    isFiredOrTriggered() {
      const current = deps.state.longPressState;
      return Boolean(current && (
        current.triggered
        || (current.releaseMode && now() - current.startedAt >= current.thresholdMs)
      ));
    },
  };
}
