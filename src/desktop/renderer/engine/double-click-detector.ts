// 双击检测器
//
// 从 trigger-handlers.ts 抽取，封装 down/up 间隔追踪逻辑。
// 支持两种触发时序：
//   - "第二次按下时"：连续两次 mousedown 间隔 ≤ windowMs 则判定为双击
//   - 其他（"第二次松开时"）：连续两次 mouseup 间隔 ≤ windowMs 则判定为双击

import type { DiagnosticsModule, EngineState } from "./types";

export interface DoubleClickDetectorDeps {
  state: EngineState;
  diagnostics?: DiagnosticsModule;
}

export interface DoubleClickCheckResult {
  isDouble: boolean;
}

export interface DoubleClickDetector {
  /** 检查 pointerDown 时刻是否构成双击（仅 triggerTiming === "第二次按下时" 时调用） */
  checkDown(windowMs: number): DoubleClickCheckResult;

  /** 记录 pointerDown 时刻（无论是否双击都需要更新） */
  recordDown(): void;

  /** 检查 pointerUp 时刻是否构成双击（仅 triggerTiming !== "第二次按下时" 时调用） */
  checkUp(windowMs: number): DoubleClickCheckResult;

  /** 记录 pointerUp 时刻（无论是否双击都需要更新） */
  recordUp(): void;

  /** 重置双击检测时间戳（长按触发后调用，避免误判） */
  reset(): void;
}

export function createDoubleClickDetector(deps: DoubleClickDetectorDeps): DoubleClickDetector {
  const { state, diagnostics } = deps;

  function checkDown(windowMs: number): DoubleClickCheckResult {
    const now = Date.now();
    if (now - (state.lastLeftPointerDownAt || 0) <= windowMs) {
      return { isDouble: true };
    }
    diagnostics?.log("action.arm", {
      actionId: "doubleClick",
      triggerSource: "double-click-down",
      windowMs,
    });
    return { isDouble: false };
  }

  function recordDown(): void {
    state.lastLeftPointerDownAt = Date.now();
  }

  function checkUp(windowMs: number): DoubleClickCheckResult {
    const now = Date.now();
    if (now - (state.lastLeftPointerUpAt || 0) <= windowMs) {
      return { isDouble: true };
    }
    diagnostics?.log("action.arm", {
      actionId: "doubleClick",
      triggerSource: "double-click-up",
      windowMs,
    });
    return { isDouble: false };
  }

  function recordUp(): void {
    state.lastLeftPointerUpAt = Date.now();
  }

  function reset(): void {
    state.lastLeftPointerDownAt = 0;
    state.lastLeftPointerUpAt = 0;
  }

  return {
    checkDown,
    recordDown,
    checkUp,
    recordUp,
    reset,
  };
}
