import type { DesktopAccessibilityState } from "../../shared/desktop-accessibility";

type StopCapture = () => void;

interface AccessibilityControllerDependencies {
  platform?: NodeJS.Platform;
  isTrusted: (prompt: boolean) => boolean;
  startCapture: () => Promise<StopCapture>;
  publish?: (state: DesktopAccessibilityState) => void;
  pollIntervalMs?: number;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}

export interface AccessibilityController {
  getState(): DesktopAccessibilityState;
  refresh(prompt?: boolean): Promise<DesktopAccessibilityState>;
  requestAccess(): Promise<DesktopAccessibilityState>;
  start(): StopCapture;
  stop(): void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function statesEqual(left: DesktopAccessibilityState, right: DesktopAccessibilityState): boolean {
  return left.status === right.status
    && (left.status !== "error" || (right.status === "error" && left.message === right.message));
}

/**
 * 把 macOS TCC 授权和 uiohook 生命周期收敛到一个可重试状态机。
 * refresh 可并发调用，但同一时刻最多只会启动一个原生监听实例。
 */
export function createAccessibilityController(
  dependencies: AccessibilityControllerDependencies,
): AccessibilityController {
  const platform = dependencies.platform ?? process.platform;
  const setIntervalFn = dependencies.setIntervalFn ?? setInterval;
  const clearIntervalFn = dependencies.clearIntervalFn ?? clearInterval;
  const pollIntervalMs = dependencies.pollIntervalMs ?? 1_000;
  let state: DesktopAccessibilityState = platform === "darwin"
    ? { status: "required" }
    : { status: "starting" };
  let stopCapture: StopCapture | null = null;
  let startAttempt: Promise<void> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let lifecycle = 0;
  let stopped = false;

  function publish(next: DesktopAccessibilityState): void {
    if (statesEqual(state, next)) return;
    state = next;
    dependencies.publish?.(state);
  }

  function stopCurrentCapture(): void {
    const stop = stopCapture;
    stopCapture = null;
    if (!stop) return;
    try {
      stop();
    } catch (error) {
      console.error("[CursorDance] failed to stop global input capture:", error);
    }
  }

  async function ensureCapture(): Promise<void> {
    const readyState: DesktopAccessibilityState = platform === "darwin"
      ? { status: "running" }
      : { status: "unsupported" };
    if (stopCapture) {
      publish(readyState);
      return;
    }
    if (startAttempt !== null) {
      await startAttempt;
      return;
    }

    const attemptLifecycle = lifecycle;
    publish({ status: "starting" });
    startAttempt = dependencies.startCapture()
      .then((stop) => {
        if (stopped || attemptLifecycle !== lifecycle) {
          stop();
          return;
        }
        stopCapture = stop;
        publish(readyState);
      })
      .catch((error) => {
        if (!stopped && attemptLifecycle === lifecycle) {
          publish({ status: "error", message: errorMessage(error) });
        }
      })
      .finally(() => {
        startAttempt = null;
      });
    await startAttempt;
  }

  async function refresh(prompt = false): Promise<DesktopAccessibilityState> {
    if (stopped) return state;

    if (platform === "darwin") {
      let trusted = false;
      try {
        trusted = dependencies.isTrusted(prompt);
      } catch (error) {
        publish({ status: "error", message: errorMessage(error) });
        return state;
      }
      if (!trusted) {
        lifecycle += 1;
        stopCurrentCapture();
        publish({ status: "required" });
        return state;
      }
    }

    await ensureCapture();
    return state;
  }

  function stop(): void {
    if (stopped) return;
    stopped = true;
    lifecycle += 1;
    if (pollTimer) {
      clearIntervalFn(pollTimer);
      pollTimer = null;
    }
    stopCurrentCapture();
  }

  return {
    getState: () => state,
    refresh,
    requestAccess: () => refresh(true),
    start() {
      if (stopped) return () => undefined;
      if (!pollTimer) {
        pollTimer = setIntervalFn(() => {
          void refresh();
        }, pollIntervalMs);
      }
      void refresh();
      return stop;
    },
    stop,
  };
}
