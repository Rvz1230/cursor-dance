import {
  createActionTriggerPipeline,
  type ActionTriggerState,
} from "@/shared/effect-runtime/action-trigger-pipeline";
import { getActionTimingMs } from "@/shared/effect-runtime/action-state";
import {
  createDoubleClickDetector,
  createLongPressTracker,
  type GestureRuntimeState,
} from "@/shared/effect-runtime/gesture-state";
import type { VisualEffectsModule } from "@/shared/effect-runtime/dom-effect-surface";

export interface ContentTriggerState extends ActionTriggerState, GestureRuntimeState {
  lastWheelEventAt: number;
  hoverTimeoutId: number | null;
  hoverTarget: EventTarget | null;
}

interface ContentConfigStore {
  isCurrentSiteEnabled(): boolean;
  getActiveTheme(): unknown;
  getConfig(): { themes: readonly unknown[]; activeThemeId?: string };
  getActionConfig(theme: unknown, actionId: string): Record<string, unknown> | null | undefined;
  getActionTriggerConfig(config: unknown): Record<string, unknown>;
  getMaxActiveEffects(): number;
  matchesTriggerZone(
    target: unknown,
    triggerZone: unknown,
    event: unknown,
    options: { actionId: string; triggerSource: string },
  ): boolean;
  resolveCursorStateId(target: unknown): string;
  getCursorStateBinding(
    theme: unknown,
    cursorStateId: string,
    actionId: string,
  ): { actionId: string; cursorStateId: string; inheritedFromDefault?: boolean };
}

interface ContentTriggerRuntime {
  window: Window;
  document: Document;
  state: ContentTriggerState;
  diagnostics?: {
    log(scope: string, payload?: Record<string, unknown>): void;
    describeTarget?(target: unknown): unknown;
  };
  configStore: ContentConfigStore;
  visualEffects: VisualEffectsModule;
  audioRuntime: {
    playSound(
      actionConfig: Readonly<Record<string, unknown>>,
      actionId: string,
      context: { comboIndex?: number; comboWindowMs?: number; runIndex?: number },
    ): void;
  };
  cursorOverlay: {
    syncStateCursorOverlay(event: Pick<PointerEvent, "clientX" | "clientY" | "target">): void;
    clearStateCursorOverlay(): void;
  };
}

export interface ContentTriggerHandlers {
  handleLeftPointerDown(event: PointerEvent): void;
  handleRightPointerDown(event: PointerEvent): void;
  handlePointerUp(event: PointerEvent): void;
  handlePointerCancel(): void;
  handleContextMenu(event: MouseEvent): void;
  handleWheel(event: WheelEvent): void;
  handlePointerOver(event: PointerEvent): void;
  handlePointerOut(event: PointerEvent): void;
  previewAtViewportCenter(themeId?: string, previewTheme?: unknown, actionId?: string): void;
  reset(): void;
}

function makeCoordsFromEvent(event: MouseEvent) {
  return { x: event.clientX, y: event.clientY, target: event.target, event };
}

function makeGestureEvent(event: PointerEvent) {
  return {
    x: event.clientX,
    y: event.clientY,
    pointerId: event.pointerId,
    target: event.target,
    rawEvent: event,
  };
}

export function createContentTriggerHandlers(runtime: ContentTriggerRuntime): ContentTriggerHandlers {
  const {
    window,
    document,
    state,
    diagnostics,
    configStore,
    visualEffects,
    audioRuntime,
    cursorOverlay,
  } = runtime;

  const { triggerAction, scheduleActionTrigger, clearPendingTriggers } = createActionTriggerPipeline({
    state,
    diagnostics,
    configStore: {
      isCurrentContextEnabled: () => configStore.isCurrentSiteEnabled(),
      getActiveTheme: () => configStore.getActiveTheme(),
      getActionConfig: (theme, actionId) => configStore.getActionConfig(theme, actionId) ?? undefined,
      getActionTriggerConfig: (config) => configStore.getActionTriggerConfig(config),
      getMaxActiveEffects: () => configStore.getMaxActiveEffects(),
      matchesTriggerZone: (target, triggerZone, event, options) => (
        configStore.matchesTriggerZone(target, triggerZone, event, options)
      ),
      resolveCursorStateId: (target) => configStore.resolveCursorStateId(target),
      getCursorStateBinding: (theme, cursorStateId, actionId) => (
        configStore.getCursorStateBinding(theme, cursorStateId, actionId)
      ),
    },
    setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimeout: (timeoutId) => window.clearTimeout(timeoutId as number),
    renderEffect(effect) {
      if (effect.kind === "ripple") visualEffects.renderRipple(effect.x, effect.y, effect.actionConfig);
      else if (effect.kind === "particle" && effect.particleMode === "orbital") {
        visualEffects.renderOrbitalParticles(
          effect.x,
          effect.y,
          effect.actionConfig,
          effect.runIndex || 0,
          effect.actionId,
        );
      } else if (effect.kind === "particle") {
        visualEffects.renderParticles(effect.x, effect.y, effect.actionConfig, effect.runIndex || 0);
      } else if (effect.kind === "text") {
        visualEffects.renderText(
          effect.x,
          effect.y,
          effect.actionConfig,
          effect.actionId || "leftClick",
          effect.runIndex || 0,
        );
      } else if (effect.kind === "animation") {
        visualEffects.renderAnimationEffect(effect.x, effect.y, effect.actionConfig);
      } else if (effect.kind === "image") {
        visualEffects.renderImageEffect(effect.x, effect.y, effect.actionConfig);
      } else if (effect.kind === "cursor") {
        visualEffects.renderCursorOverride(effect.x, effect.y, effect.actionConfig);
      }
    },
    playAudio(audio) {
      audioRuntime.playSound(audio.actionConfig, audio.actionId, {
        comboIndex: audio.comboIndex,
        comboWindowMs: audio.comboWindowMs,
        runIndex: audio.runIndex,
      });
    },
  });

  const doubleClickDetector = createDoubleClickDetector({
    state,
    log: (scope, payload) => diagnostics?.log(scope, payload),
  });
  const longPressTracker = createLongPressTracker({
    state,
    timers: {
      setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
      clearTimeout: (timeoutId) => window.clearTimeout(timeoutId as number),
    },
    log: (scope, payload) => diagnostics?.log(scope, payload),
    fireAction(x, y, target, event, theme, throttleMs, triggerSource) {
      triggerAction("longPress", { x, y, target, event }, theme, { throttleMs, triggerSource });
    },
    resetDoubleClick: () => doubleClickDetector.reset(),
  });

  function handleLeftPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const theme = configStore.getActiveTheme();
    const leftClickConfig = configStore.getActionConfig(theme, "leftClick");
    const leftClickTriggerConfig = configStore.getActionTriggerConfig(leftClickConfig);
    const longPressConfig = configStore.getActionConfig(theme, "longPress");
    const longPressTriggerConfig = configStore.getActionTriggerConfig(longPressConfig);
    const longPressArmed = Boolean(longPressConfig && configStore.matchesTriggerZone(
      event.target,
      longPressTriggerConfig.triggerZone,
      event,
      { actionId: "longPress", triggerSource: "longpress-arm" },
    ));

    if (leftClickTriggerConfig.triggerTiming === "按下时" && !longPressArmed) {
      scheduleActionTrigger(
        "leftClick",
        makeCoordsFromEvent(event),
        theme,
        getActionTimingMs("leftClick", leftClickConfig),
        { triggerSource: "left-pointer-down" },
      );
    }

    const doubleClickConfig = configStore.getActionConfig(theme, "doubleClick");
    const doubleClickTriggerConfig = configStore.getActionTriggerConfig(doubleClickConfig);
    const doubleClickInterval = getActionTimingMs("doubleClick", doubleClickConfig);
    if (doubleClickTriggerConfig.triggerTiming === "第二次按下时") {
      if (doubleClickDetector.checkDown(doubleClickInterval).isDouble) {
        triggerAction("doubleClick", makeCoordsFromEvent(event), theme, {
          throttleMs: doubleClickInterval,
          triggerSource: "double-click-down",
        });
        doubleClickDetector.reset();
      } else doubleClickDetector.recordDown();
    } else doubleClickDetector.recordDown();

    if (!longPressArmed) return;
    longPressTracker.arm(makeGestureEvent(event), {
      theme,
      releaseMode: longPressTriggerConfig.triggerTiming === "松开后触发",
      thresholdMs: getActionTimingMs("longPress", longPressConfig),
    });
  }

  function handlePointerUp(event: PointerEvent): void {
    if (event.button !== 0) {
      if (longPressTracker.isArmed) longPressTracker.cancel();
      return;
    }
    const theme = configStore.getActiveTheme();
    const longPressWasArmed = longPressTracker.isArmed;
    const longPressFired = longPressTracker.isFiredOrTriggered();
    longPressTracker.finish(makeGestureEvent(event));

    if (!longPressFired) {
      const leftClickConfig = configStore.getActionConfig(theme, "leftClick");
      const leftClickTriggerConfig = configStore.getActionTriggerConfig(leftClickConfig);
      if (leftClickTriggerConfig.triggerTiming !== "按下时" || longPressWasArmed) {
        scheduleActionTrigger(
          "leftClick",
          makeCoordsFromEvent(event),
          theme,
          getActionTimingMs("leftClick", leftClickConfig),
          { triggerSource: "left-pointer-up" },
        );
      }
    }

    const doubleClickConfig = configStore.getActionConfig(theme, "doubleClick");
    const doubleClickTriggerConfig = configStore.getActionTriggerConfig(doubleClickConfig);
    const doubleClickInterval = getActionTimingMs("doubleClick", doubleClickConfig);
    if (doubleClickTriggerConfig.triggerTiming !== "第二次按下时") {
      if (doubleClickDetector.checkUp(doubleClickInterval).isDouble) {
        triggerAction("doubleClick", makeCoordsFromEvent(event), theme, {
          throttleMs: doubleClickInterval,
          triggerSource: "double-click-up",
        });
        doubleClickDetector.reset();
      } else doubleClickDetector.recordUp();
    } else doubleClickDetector.recordUp();
  }

  function handlePointerCancel(): void {
    longPressTracker.cancel();
  }

  function reset(): void {
    longPressTracker.forceClear();
    doubleClickDetector.reset();
    clearPendingTriggers();
    if (state.hoverTimeoutId !== null) window.clearTimeout(state.hoverTimeoutId);
    state.hoverTimeoutId = null;
    state.hoverTarget = null;
    state.lastWheelEventAt = 0;
    state.lastTriggerAtByAction = {};
    state.actionRunCounts = {};
    state.actionComboStates = {};
    visualEffects.clearOrbitalParticles();
  }

  function handleRightPointerDown(event: PointerEvent): void {
    if (event.button !== 2) return;
    const theme = configStore.getActiveTheme();
    const actionConfig = configStore.getActionConfig(theme, "rightClick");
    const triggerConfig = configStore.getActionTriggerConfig(actionConfig);
    if (triggerConfig.triggerTiming === "按下时") {
      scheduleActionTrigger(
        "rightClick",
        makeCoordsFromEvent(event),
        theme,
        getActionTimingMs("rightClick", actionConfig),
        { triggerSource: "right-pointer-down" },
      );
    }
  }

  function handleContextMenu(event: MouseEvent): void {
    const theme = configStore.getActiveTheme();
    const actionConfig = configStore.getActionConfig(theme, "rightClick");
    const triggerConfig = configStore.getActionTriggerConfig(actionConfig);
    if (triggerConfig.triggerTiming !== "按下时") {
      scheduleActionTrigger(
        "rightClick",
        makeCoordsFromEvent(event),
        theme,
        getActionTimingMs("rightClick", actionConfig),
        { triggerSource: "context-menu" },
      );
    }
  }

  function handleWheel(event: WheelEvent): void {
    const theme = configStore.getActiveTheme();
    const actionConfig = configStore.getActionConfig(theme, "wheel");
    const triggerConfig = configStore.getActionTriggerConfig(actionConfig);
    if (!configStore.matchesTriggerZone(event.target, triggerConfig.triggerZone, event, {
      actionId: "wheel",
      triggerSource: "wheel",
    })) return;
    const timingMs = getActionTimingMs("wheel", actionConfig);
    const now = Date.now();
    const isNewBurst = now - state.lastWheelEventAt > timingMs;
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
    triggerAction("wheel", makeCoordsFromEvent(event), theme, {
      throttleMs: triggerConfig.triggerTiming === "连续滚动中" ? timingMs : 0,
      triggerSource: "wheel",
    });
  }

  function handlePointerOver(event: PointerEvent): void {
    cursorOverlay.syncStateCursorOverlay(event);
    const theme = configStore.getActiveTheme();
    const actionConfig = configStore.getActionConfig(theme, "hover");
    const triggerConfig = configStore.getActionTriggerConfig(actionConfig);
    if (!actionConfig || !configStore.matchesTriggerZone(event.target, triggerConfig.triggerZone, event, {
      actionId: "hover",
      triggerSource: "hover-arm",
    })) return;

    if (state.hoverTimeoutId !== null) window.clearTimeout(state.hoverTimeoutId);
    state.hoverTarget = event.target;
    if (triggerConfig.triggerTiming === "进入时") {
      triggerAction("hover", makeCoordsFromEvent(event), theme, {
        throttleMs: 120,
        triggerSource: "hover-enter",
      });
      return;
    }
    const hoverDelay = getActionTimingMs("hover", actionConfig);
    state.hoverTimeoutId = window.setTimeout(() => {
      if (state.hoverTarget !== event.target) return;
      triggerAction("hover", makeCoordsFromEvent(event), theme, {
        throttleMs: hoverDelay,
        triggerSource: "hover-delay",
      });
    }, hoverDelay);
  }

  function handlePointerOut(event: PointerEvent): void {
    if (!event.relatedTarget) cursorOverlay.clearStateCursorOverlay();
    if (!state.hoverTarget) return;
    const ElementCtor = document.defaultView?.Element;
    const targetContainsHoverTarget = Boolean(
      ElementCtor
      && event.target instanceof ElementCtor
      && state.hoverTarget instanceof ElementCtor
      && event.target.contains(state.hoverTarget),
    );
    if (event.target === state.hoverTarget || targetContainsHoverTarget) {
      if (state.hoverTimeoutId !== null) window.clearTimeout(state.hoverTimeoutId);
      state.hoverTimeoutId = null;
      state.hoverTarget = null;
      visualEffects.clearOrbitalParticles();
    }
  }

  function previewAtViewportCenter(
    themeId?: string,
    previewTheme?: unknown,
    actionId?: string,
  ): void {
    if (!configStore.isCurrentSiteEnabled()) return;
    const config = configStore.getConfig();
    const selectedThemeId = themeId || config.activeThemeId;
    const resolvedActionId = actionId || "leftClick";
    const resolvedTheme = previewTheme
      || config.themes.find((theme) => (
        typeof theme === "object"
        && theme !== null
        && "id" in theme
        && theme.id === selectedThemeId
      ))
      || configStore.getActiveTheme();
    triggerAction(resolvedActionId, {
      x: Math.round(window.innerWidth / 2),
      y: Math.round(window.innerHeight / 2),
      target: document.body,
      event: undefined,
    }, resolvedTheme, {
      force: true,
      resolvedActionId,
      throttleMs: 0,
      triggerSource: "preview-center",
    });
  }

  return {
    handleLeftPointerDown,
    handleRightPointerDown,
    handlePointerUp,
    handlePointerCancel,
    handleContextMenu,
    handleWheel,
    handlePointerOver,
    handlePointerOut,
    previewAtViewportCenter,
    reset,
  };
}
