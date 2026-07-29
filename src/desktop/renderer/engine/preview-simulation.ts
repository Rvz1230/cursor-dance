// 预览模拟
//
// 从 trigger-handlers.ts 抽取，仅由 Workbench 预览面板使用，
// 不参与 overlay 窗口的实时触发路径。
//
// simulateAction 通过真实状态机（handleLeftPointerDown / handlePointerUp）
// 触发 doubleClick / longPress；其他动作直接走 triggerAction force 模式。
// previewAt / previewAtViewportCenter 是上层入口。

import type { ConfigStore, CursorEvent, EngineState } from "./types";
import type {
  DoubleClickDetector,
  LongPressTracker,
} from "@/shared/effect-runtime/gesture-state";

export interface PreviewSimulationDeps {
  window: Window;
  document: Document;
  state: EngineState;
  configStore: ConfigStore;
  longPressTracker: LongPressTracker;
  doubleClickDetector: DoubleClickDetector;
  /** 获取动作时序（getActionTimingMs） */
  getActionTimingMs: (actionId: string, actionConfig: Record<string, unknown> | undefined) => number;
  /** 直接触发动作（triggerAction force 模式） */
  triggerAction: (
    sourceActionId: string,
    coords: { x: number; y: number; target: unknown; event: unknown },
    scheme: unknown,
    options: { force?: boolean; resolvedActionId?: string; throttleMs?: number; triggerSource?: string },
  ) => void;
  /** 状态机的 handleLeftPointerDown（simulateAction 需要它走真实状态机） */
  handleLeftPointerDown: (event: CursorEvent) => void;
  /** 状态机的 handlePointerUp（simulateAction 需要它走真实状态机） */
  handlePointerUp: (event: CursorEvent) => void;
}

export interface PreviewSimulation {
  simulateAction(actionId: string, x: number, y: number, scheme: unknown): () => void;
  previewAt(x: number, y: number, schemeId?: string, previewScheme?: unknown, actionId?: string): void;
  previewAtViewportCenter(schemeId?: string, previewScheme?: unknown, actionId?: string): void;
}

export function createPreviewSimulation(deps: PreviewSimulationDeps): PreviewSimulation {
  const {
    window,
    document,
    configStore,
    longPressTracker,
    doubleClickDetector,
    getActionTimingMs,
    triggerAction,
    handleLeftPointerDown,
    handlePointerUp,
  } = deps;

  function simulateAction(actionId: string, x: number, y: number, scheme: unknown): () => void {
    // 重置状态机时间戳，确保模拟在干净状态下运行
    doubleClickDetector.reset();
    longPressTracker.forceClear();

    const mkEvt = (type: string): CursorEvent => ({
      type,
      x,
      y,
      buttons: 1,
      button: 0,
      timestamp: Date.now(),
    });

    const pendingTimeouts: number[] = [];
    const noop = (): void => {};

    if (actionId === "doubleClick") {
      handleLeftPointerDown(mkEvt("mousedown"));
      handlePointerUp(mkEvt("mouseup"));
      const dblConfig = configStore.getActionConfig?.(scheme, "doubleClick");
      const interval = getActionTimingMs("doubleClick", dblConfig);
      const tid = window.setTimeout(() => {
        handleLeftPointerDown(mkEvt("mousedown"));
        handlePointerUp(mkEvt("mouseup"));
      }, Math.min(interval / 2, 80));
      pendingTimeouts.push(tid);
      return () => { for (const id of pendingTimeouts) window.clearTimeout(id); };
    }

    if (actionId === "longPress") {
      const lpConfig = configStore.getActionConfig?.(scheme, "longPress");
      const threshold = getActionTimingMs("longPress", lpConfig);
      handleLeftPointerDown(mkEvt("mousedown"));
      const tid = window.setTimeout(() => {
        handlePointerUp(mkEvt("mouseup"));
      }, threshold + 20);
      pendingTimeouts.push(tid);
      return () => { for (const id of pendingTimeouts) window.clearTimeout(id); };
    }

    // 其他动作走原来的 force-trigger
    triggerAction(actionId, { x, y, target: document.body, event: null }, scheme, {
      force: true,
      resolvedActionId: actionId,
      throttleMs: 0,
      triggerSource: "preview-center",
    });
    return noop;
  }

  let pendingSimCleanup: (() => void) | null = null;

  function previewAt(x: number, y: number, schemeId?: string, previewScheme?: unknown, actionId?: string): void {
    if (!configStore.isCurrentSiteEnabled?.()) return;
    const config = configStore.getConfig?.();
    const resolvedScheme = previewScheme
      || (config?.themes.find((theme) => theme.id === (schemeId || config.activeThemeId)))
      || configStore.getActiveScheme?.();
    const resolvedActionId = actionId || "leftClick";

    // 取消上一次模拟残留的 timeout，避免快速切换动作时泄漏
    if (pendingSimCleanup) { pendingSimCleanup(); pendingSimCleanup = null; }

    // 多步动作走状态机模拟
    if (resolvedActionId === "doubleClick" || resolvedActionId === "longPress") {
      pendingSimCleanup = simulateAction(resolvedActionId, x, y, resolvedScheme);
      return;
    }

    triggerAction(resolvedActionId, { x, y, target: document.body, event: null }, resolvedScheme, {
      force: true,
      resolvedActionId,
      throttleMs: 0,
      triggerSource: "preview-center",
    });
  }

  function previewAtViewportCenter(schemeId?: string, previewScheme?: unknown, actionId?: string): void {
    const x = Math.round(window.innerWidth / 2);
    const y = Math.round(window.innerHeight / 2);
    previewAt(x, y, schemeId, previewScheme, actionId);
  }

  return {
    simulateAction,
    previewAt,
    previewAtViewportCenter,
  };
}
