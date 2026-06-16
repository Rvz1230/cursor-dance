// 长按状态机
//
// 封装 arm / fire / cancel / release 四阶段定时逻辑，
// 从 trigger-handlers.ts 抽取以降低单文件复杂度。
//
// 调用方需注入 fireAction（触发长按效果）和 resetDoubleClick（重置双击检测时间戳）
// 两个回调，使状态机与上层 triggerAction / 双击检测解耦。

import type { CursorEvent, EngineState, LongPressState, DiagnosticsModule } from "./types";

export interface LongPressTrackerDeps {
  window: Window;
  state: EngineState;
  diagnostics?: DiagnosticsModule;
  /** 长按触发时调用，执行 triggerAction("longPress", ...) */
  fireAction: (
    x: number,
    y: number,
    target: unknown,
    event: CursorEvent | null,
    scheme: unknown,
    throttleMs: number,
    triggerSource: string,
  ) => void;
  /** 长按已触发后重置双击检测时间戳 */
  resetDoubleClick: () => void;
}

export interface LongPressTracker {
  /**
   * 在 leftPointerDown 时尝试 arm 长按定时器。
   * 返回 true 表示长按已 arm（上层需据此决定是否跳过 leftClick）。
   */
  arm(event: CursorEvent, opts: {
    scheme: unknown;
    target: unknown;
    releaseMode: boolean;
    thresholdMs: number;
  }): boolean;

  /** pointerUp 时收尾：releaseMode 且超时则触发；清除定时器。 */
  finish(event: CursorEvent | null): void;

  /** pointerCancel 时取消。 */
  cancel(): void;

  /** 当前是否已 arm 且未完成。 */
  readonly isArmed: boolean;

  /** 当前长按状态是否已触发（超时或 release 模式下持续时间达标）。 */
  isFiredOrTriggered(event: CursorEvent | null): boolean;

  /** 强制清理（simulateAction 重置时使用）。 */
  forceClear(): void;
}

export function createLongPressTracker(deps: LongPressTrackerDeps): LongPressTracker {
  const { window, state, diagnostics, fireAction, resetDoubleClick } = deps;

  function arm(event: CursorEvent, opts: {
    scheme: unknown;
    target: unknown;
    releaseMode: boolean;
    thresholdMs: number;
  }): boolean {
    const lp: NonNullable<EngineState["longPressState"]> = {
      startedAt: Date.now(),
      pointerId: (event as unknown as { pointerId?: number }).pointerId,
      x: event.x,
      y: event.y,
      target: opts.target,
      scheme: opts.scheme,
      triggered: false,
      fired: false,
      releaseMode: opts.releaseMode,
      thresholdMs: opts.thresholdMs,
    };
    state.longPressState = lp;
    diagnostics?.log("action.arm", {
      actionId: "longPress",
      triggerSource: "longpress-arm",
      thresholdMs: lp.thresholdMs,
    });

    lp.timeoutId = window.setTimeout(() => {
      if (!state.longPressState) return;
      state.longPressState.triggered = true;
      // 长按已触发，重置双击检测时间戳，避免下次单击被误判为双击
      resetDoubleClick();
      if (!state.longPressState.releaseMode && !state.longPressState.fired) {
        state.longPressState.fired = true;
        fireAction(
          state.longPressState.x,
          state.longPressState.y,
          state.longPressState.target,
          null,
          state.longPressState.scheme,
          state.longPressState.thresholdMs,
          "longpress-timeout",
        );
      }
    }, lp.thresholdMs);

    return true;
  }

  function finish(event: CursorEvent | null): void {
    if (!state.longPressState) return;
    if (state.longPressState.timeoutId !== undefined) {
      window.clearTimeout(state.longPressState.timeoutId);
    }
    const duration = Date.now() - state.longPressState.startedAt;
    if (state.longPressState.releaseMode && duration >= state.longPressState.thresholdMs && !state.longPressState.fired) {
      state.longPressState.fired = true;
      // 长按松开触发，重置双击检测时间戳
      resetDoubleClick();
      fireAction(
        event?.x ?? state.longPressState.x,
        event?.y ?? state.longPressState.y,
        (event as unknown as { target?: unknown })?.target ?? state.longPressState.target,
        event,
        state.longPressState.scheme,
        state.longPressState.thresholdMs,
        "longpress-release",
      );
    }
    state.longPressState = null;
  }

  function cancel(): void {
    if (!state.longPressState) return;
    if (state.longPressState.timeoutId !== undefined) {
      window.clearTimeout(state.longPressState.timeoutId);
    }
    diagnostics?.log("action.skip", {
      actionId: "longPress",
      reason: "longpress-cancelled",
    });
    state.longPressState = null;
  }

  function forceClear(): void {
    if (state.longPressState) {
      if (state.longPressState.timeoutId !== undefined) window.clearTimeout(state.longPressState.timeoutId);
      state.longPressState = null;
    }
  }

  return {
    arm,
    finish,
    cancel,
    forceClear,
    get isArmed(): boolean {
      return state.longPressState != null;
    },
    isFiredOrTriggered(event: CursorEvent | null): boolean {
      const lpState = state.longPressState;
      if (!lpState) return false;
      return (
        lpState.triggered ||
        (lpState.releaseMode && (Date.now() - lpState.startedAt) >= lpState.thresholdMs)
      );
    },
  };
}
