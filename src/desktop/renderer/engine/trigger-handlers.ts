// CursorDance 触发器分发层
//
// 从 extension/content-runtime/trigger-handlers.js 迁移而来（任务 2.4）。
// 关键调整：
//   - 去 IIFE，改为 export function createTriggerHandlers(deps)。
//   - 入参从 DOM PointerEvent / WheelEvent 切换为结构化 CursorEvent。
//     桌面端 IPC 投递的事件没有 target/relatedTarget/button 字段，事件分发完全
//     依赖 type + buttons + 坐标。configStore.matchesTriggerZone 在桌面端
//     的实现可以无视 target / event，直接返回 true。
//   - 桌面端裁剪 hover：handlePointerOver / handlePointerOut 不再导出，
//     getActionTimingMs 与 throttleMs 默认值里的 "hover" 分支同步删除。
//     这与 CLAUDE.md「desktop 触发器 5 个：leftClick / rightClick /
//     doubleClick / longPress / wheel」一致。
//   - 时序、节流、连击、runIndex 和输出计划由共享 action state machine 负责；
//     本层只处理桌面能力过滤、配置解析、诊断与输出执行。
//
// 调用方在桌面端是 src/renderer/overlay；扩展端继续由 trigger-handlers.js 注册。
//
// 重构说明：
//   长按/双击状态机 → shared/effect-runtime/gesture-state.ts
//   预览模拟   → preview-simulation.ts

import type {
  ConfigStore,
  CursorEvent,
  CursorOverlayModule,
  DiagnosticsModule,
  EngineState,
  TriggerHandlersModule,
} from "./types";
import type { AudioOutput, EffectSurface } from "@/shared/effect-runtime/contracts";
import { getActionTimingMs } from "@/shared/effect-runtime/action-state";
import {
  createActionTriggerPipeline,
  type ActionTriggerCoords as TriggerCoords,
  type ActionTriggerOptions as TriggerOptions,
} from "@/shared/effect-runtime/action-trigger-pipeline";
import {
  createDoubleClickDetector,
  createLongPressTracker,
  type DoubleClickDetector,
  type GesturePointerEvent,
  type LongPressTracker,
} from "@/shared/effect-runtime/gesture-state";
import { createPreviewSimulation } from "./preview-simulation";

export interface TriggerHandlersDeps {
  window: Window;
  document: Document;
  state: EngineState;
  diagnostics?: DiagnosticsModule;
  configStore: ConfigStore;
  effectSurface: EffectSurface;
  audioOutput: AudioOutput;
  cursorOverlay: CursorOverlayModule;
}

export function createTriggerHandlers(deps: TriggerHandlersDeps): TriggerHandlersModule {
  const {
    window,
    document,
    state,
    diagnostics,
    configStore,
    effectSurface,
    audioOutput,
    cursorOverlay: _cursorOverlay,
  } = deps;
  // cursorOverlay 在扩展端由 handlePointerOver/Out 调用；桌面端 hover 已裁剪，
  // overlay 同步光标的责任移到上层（src/renderer/overlay 直接监听 IPC mousemove）。
  void _cursorOverlay;

  // ── helpers ──────────────────────────────────────────────────────

  function makeCoordsFromEvent(event: CursorEvent): TriggerCoords {
    return {
      x: event.x,
      y: event.y,
      // 桌面 CursorEvent 没有 target；扩展端调用方可在外层包装时塞入。
      target: (event as unknown as { target?: unknown }).target,
      event,
    };
  }

  function makeGestureEvent(event: CursorEvent): GesturePointerEvent {
    return {
      x: event.x,
      y: event.y,
      pointerId: (event as unknown as { pointerId?: number }).pointerId,
      target: (event as unknown as { target?: unknown }).target,
      rawEvent: event,
    };
  }

  // ── triggerAction (核心触发管线) ─────────────────────────────────

  const { triggerAction, scheduleActionTrigger } = createActionTriggerPipeline({
    state,
    diagnostics,
    unsupportedActions: new Set(["hover"]),
    unsupportedReason: "unsupported-on-desktop",
    configStore: {
      isCurrentContextEnabled: () => Boolean(configStore.isCurrentSiteEnabled?.()),
      getActiveScheme: () => configStore.getActiveScheme?.(),
      getActionConfig: (scheme, actionId) => configStore.getActionConfig?.(scheme, actionId),
      getActionTriggerConfig: (config) => configStore.getActionTriggerConfig(config),
      matchesTriggerZone: (target, triggerZone, event, options) => Boolean(
        configStore.matchesTriggerZone?.(target, triggerZone, event, options),
      ),
      resolveCursorStateId: (target) => configStore.resolveCursorStateId?.(target) || "",
      getCursorStateBinding: (scheme, cursorStateId, actionId) => (
        configStore.getCursorStateBinding?.(scheme, cursorStateId, actionId)
        || { actionId, cursorStateId }
      ),
    },
    setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
    renderEffect: (effect) => { effectSurface.createNode(effect); },
    playAudio(audio, resolvedActionId) {
      void audioOutput.play(audio).catch(() => {
        diagnostics?.log("audio.skip", { actionId: resolvedActionId, reason: "output-adapter-error" });
      });
    },
  });

  // ── 子模块：长按状态机 + 双击检测 ────────────────────────────────

  const doubleClickDetector: DoubleClickDetector = createDoubleClickDetector({
    state,
    log: (scope, payload) => diagnostics?.log(scope, payload),
  });

  const longPressTracker: LongPressTracker = createLongPressTracker({
    state,
    timers: {
      setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
      clearTimeout: (timeoutId) => window.clearTimeout(timeoutId as number),
    },
    log: (scope, payload) => diagnostics?.log(scope, payload),
    fireAction(x, y, target, event, scheme, throttleMs, triggerSource) {
      triggerAction("longPress", { x, y, target, event: event as CursorEvent | null }, scheme, {
        throttleMs,
        triggerSource,
      });
    },
    resetDoubleClick() {
      doubleClickDetector.reset();
    },
  });

  // ── 事件处理器 ───────────────────────────────────────────────────

  function handleLeftPointerDown(event: CursorEvent): void {
    const scheme = configStore.getActiveScheme?.();
    const leftClickConfig = configStore.getActionConfig?.(scheme, "leftClick");
    const leftClickTriggerConfig = configStore.getActionTriggerConfig(leftClickConfig);

    const longPressConfig = configStore.getActionConfig?.(scheme, "longPress");
    const longPressTriggerConfig = configStore.getActionTriggerConfig(longPressConfig);
    const coords = makeCoordsFromEvent(event);
    const longPressArmed = longPressConfig && configStore.matchesTriggerZone?.(coords.target, longPressTriggerConfig.triggerZone, event, {
      actionId: "longPress",
      triggerSource: "longpress-arm",
    });

    if (leftClickTriggerConfig.triggerTiming === "按下时" && !longPressArmed) {
      scheduleActionTrigger("leftClick", coords, scheme, getActionTimingMs("leftClick", leftClickConfig), {
        triggerSource: "left-pointer-down",
      });
    }

    // 双击检测（按下时序）
    const doubleClickConfig = configStore.getActionConfig?.(scheme, "doubleClick");
    const doubleClickTriggerConfig = configStore.getActionTriggerConfig(doubleClickConfig);
    const doubleClickInterval = getActionTimingMs("doubleClick", doubleClickConfig);
    if (doubleClickTriggerConfig.triggerTiming === "第二次按下时") {
      const result = doubleClickDetector.checkDown(doubleClickInterval);
      if (result.isDouble) {
        triggerAction("doubleClick", coords, scheme, {
          throttleMs: doubleClickInterval,
          triggerSource: "double-click-down",
        });
        doubleClickDetector.reset();
      } else {
        doubleClickDetector.recordDown();
      }
    } else {
      doubleClickDetector.recordDown();
    }

    // 长按 arm
    if (!longPressArmed) return;
    longPressTracker.arm(makeGestureEvent(event), {
      scheme,
      target: coords.target,
      releaseMode: longPressTriggerConfig.triggerTiming === "松开后触发",
      thresholdMs: getActionTimingMs("longPress", longPressConfig),
    });
  }

  function handlePointerUp(event: CursorEvent): void {
    // 右键/中键抬起：只清理长按状态机，不触发左键/双击逻辑
    if (event.button !== undefined && event.button !== 0) {
      if (longPressTracker.isArmed) {
        longPressTracker.cancel();
      }
      return;
    }

    const scheme = configStore.getActiveScheme?.();
    const longPressWasArmed = longPressTracker.isArmed;
    const longPressFired = longPressTracker.isFiredOrTriggered();

    longPressTracker.finish(makeGestureEvent(event));

    const coords = makeCoordsFromEvent(event);
    if (!longPressFired) {
      const leftClickConfig = configStore.getActionConfig?.(scheme, "leftClick");
      const leftClickTriggerConfig = configStore.getActionTriggerConfig(leftClickConfig);
      if (leftClickTriggerConfig.triggerTiming !== "按下时" || longPressWasArmed) {
        scheduleActionTrigger("leftClick", coords, scheme, getActionTimingMs("leftClick", leftClickConfig), {
          triggerSource: "left-pointer-up",
        });
      }
    }

    // 双击检测（松开时序）
    const doubleClickConfig = configStore.getActionConfig?.(scheme, "doubleClick");
    const doubleClickTriggerConfig = configStore.getActionTriggerConfig(doubleClickConfig);
    const doubleClickInterval = getActionTimingMs("doubleClick", doubleClickConfig);
    if (doubleClickTriggerConfig.triggerTiming !== "第二次按下时") {
      const result = doubleClickDetector.checkUp(doubleClickInterval);
      if (result.isDouble) {
        triggerAction("doubleClick", coords, scheme, {
          throttleMs: doubleClickInterval,
          triggerSource: "double-click-up",
        });
        doubleClickDetector.reset();
      } else {
        doubleClickDetector.recordUp();
      }
    } else {
      doubleClickDetector.recordUp();
    }
  }

  function handlePointerCancel(): void {
    longPressTracker.cancel();
  }

  function handleRightPointerDown(event: CursorEvent): void {
    const scheme = configStore.getActiveScheme?.();
    const actionConfig = configStore.getActionConfig?.(scheme, "rightClick");
    const triggerConfig = configStore.getActionTriggerConfig(actionConfig);
    if (triggerConfig.triggerTiming === "按下时") {
      scheduleActionTrigger("rightClick", makeCoordsFromEvent(event), scheme, getActionTimingMs("rightClick", actionConfig), {
        triggerSource: "right-pointer-down",
      });
    }
  }

  function handleContextMenu(event: CursorEvent): void {
    const scheme = configStore.getActiveScheme?.();
    const actionConfig = configStore.getActionConfig?.(scheme, "rightClick");
    const triggerConfig = configStore.getActionTriggerConfig(actionConfig);
    if (triggerConfig.triggerTiming !== "按下时") {
      scheduleActionTrigger("rightClick", makeCoordsFromEvent(event), scheme, getActionTimingMs("rightClick", actionConfig), {
        triggerSource: "context-menu",
      });
    }
  }

  function handleWheel(event: CursorEvent): void {
    const scheme = configStore.getActiveScheme?.();
    const actionConfig = configStore.getActionConfig?.(scheme, "wheel");
    const triggerConfig = configStore.getActionTriggerConfig(actionConfig);
    const coords = makeCoordsFromEvent(event);
    if (!configStore.matchesTriggerZone?.(coords.target, triggerConfig.triggerZone, event, {
      actionId: "wheel",
      triggerSource: "wheel",
    })) return;
    const timingMs = getActionTimingMs("wheel", actionConfig);
    const now = Date.now();
    const isNewBurst = now - (state.lastWheelEventAt || 0) > timingMs;
    state.lastWheelEventAt = now;
    if (triggerConfig.triggerTiming === "滚动开始时" && !isNewBurst) {
      diagnostics?.log("action.skip", {
        actionId: "wheel",
        triggerSource: "wheel",
        reason: "wheel-burst-suppressed",
        windowMs: timingMs,
      });
      return;
    }
    triggerAction("wheel", coords, scheme, {
      throttleMs: triggerConfig.triggerTiming === "连续滚动中" ? timingMs : 0,
      triggerSource: "wheel",
    });
  }

  // ── 预览模拟 ────────────────────────────────────────────────────

  // preview-simulation 需要 handleLeftPointerDown / handlePointerUp，
  // 但这两个函数在上面才定义。通过可变引用桥接，避免循环依赖。
  const handlerRefs: {
    handleLeftPointerDown: ((event: CursorEvent) => void) | null;
    handlePointerUp: ((event: CursorEvent) => void) | null;
  } = {
    handleLeftPointerDown: null,
    handlePointerUp: null,
  };
  handlerRefs.handleLeftPointerDown = handleLeftPointerDown;
  handlerRefs.handlePointerUp = handlePointerUp;

  const previewSim = createPreviewSimulation({
    window,
    document,
    state,
    configStore,
    longPressTracker,
    doubleClickDetector,
    getActionTimingMs,
    triggerAction(sourceActionId, coords, scheme, options) {
      triggerAction(sourceActionId, coords as TriggerCoords, scheme, options as TriggerOptions);
    },
    handleLeftPointerDown: (event) => handlerRefs.handleLeftPointerDown!(event),
    handlePointerUp: (event) => handlerRefs.handlePointerUp!(event),
  });

  // 公共 API 包装：保留 simulateAction 的 options 参数签名
  function simulateAction(actionId: string, x: number, y: number, scheme: unknown, _options?: { holdMs?: number }): () => void {
    return previewSim.simulateAction(actionId, x, y, scheme);
  }

  return {
    handleLeftPointerDown,
    handleRightPointerDown,
    handlePointerUp,
    handlePointerCancel,
    handleContextMenu,
    handleWheel,
    previewAtViewportCenter: previewSim.previewAtViewportCenter,
    previewAt: previewSim.previewAt,
    simulateAction,
  };
}
