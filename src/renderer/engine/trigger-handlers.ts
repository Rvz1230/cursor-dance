// CursorDance 触发器分发层
//
// 从 public/content-runtime/trigger-handlers.js 迁移而来（任务 2.4）。
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
//   - 渲染管线（visualEffects.* + audioRuntime.playSound）调用顺序、参数、
//     节流 / 连击 / runIndex 计算逻辑全部原样保留。
//
// 调用方在桌面端是 src/renderer/overlay；扩展端继续由 trigger-handlers.js 注册。

import type {
  AudioRuntimeModule,
  ConfigStore,
  CursorEvent,
  CursorOverlayModule,
  DiagnosticsModule,
  EngineState,
  TriggerHandlersModule,
  VisualEffectsModule,
} from "./types";

export interface TriggerHandlersDeps {
  window: Window;
  document: Document;
  state: EngineState;
  diagnostics?: DiagnosticsModule;
  configStore: ConfigStore;
  visualEffects: VisualEffectsModule;
  audioRuntime: AudioRuntimeModule;
  cursorOverlay: CursorOverlayModule;
}

interface TriggerCoords {
  x: number;
  y: number;
  /** 桌面端无 DOM target，扩展端是 EventTarget；仅透传给 configStore.* 与 diagnostics.describeTarget */
  target: unknown;
  /** 原始事件，仅 matchesTriggerZone 需要；桌面端为 CursorEvent */
  event: unknown;
}

interface TriggerOptions {
  triggerSource?: string;
  resolvedActionId?: string;
  throttleMs?: number;
  force?: boolean;
}

export function createTriggerHandlers(deps: TriggerHandlersDeps): TriggerHandlersModule {
  const {
    window,
    document,
    state,
    diagnostics,
    configStore,
    visualEffects,
    audioRuntime,
    cursorOverlay: _cursorOverlay,
  } = deps;
  // cursorOverlay 在扩展端由 handlePointerOver/Out 调用；桌面端 hover 已裁剪，
  // overlay 同步光标的责任移到上层（src/renderer/overlay 直接监听 IPC mousemove）。
  void _cursorOverlay;

  function getActionTimingMs(actionId: string, actionConfig: Record<string, unknown> | undefined): number {
    const rawValue = Number(actionConfig?.holdMs);
    const value = Number.isFinite(rawValue) ? rawValue : 0;

    if (actionId === "leftClick" || actionId === "rightClick") {
      return value === 420 ? 0 : Math.max(0, Math.min(320, value));
    }
    if (actionId === "doubleClick") {
      return value === 420 ? 320 : Math.max(180, Math.min(520, value || 320));
    }
    if (actionId === "wheel") {
      return value === 420 ? 180 : Math.max(80, Math.min(520, value || 180));
    }
    if (actionId === "longPress") {
      return Math.max(120, Math.min(900, value || 420));
    }
    return Math.max(0, value);
  }

  function getComboWindowMs(actionConfig: Record<string, unknown> | undefined): number {
    const rawValue = Number(actionConfig?.comboWindowMs);
    return Number.isFinite(rawValue)
      ? Math.max(120, Math.min(3000, rawValue))
      : 900;
  }

  function makeCoordsFromEvent(event: CursorEvent): TriggerCoords {
    return {
      x: event.x,
      y: event.y,
      // 桌面 CursorEvent 没有 target；扩展端调用方可在外层包装时塞入。
      target: (event as unknown as { target?: unknown }).target,
      event,
    };
  }

  function getTriggerSource(options: TriggerOptions): string {
    return options.triggerSource || "unknown";
  }

  function ensureMaps(): void {
    state.lastTriggerAtByAction = state.lastTriggerAtByAction || {};
    state.actionRunCounts = state.actionRunCounts || {};
    state.actionComboStates = state.actionComboStates || {};
  }

  function triggerAction(
    sourceActionId: string,
    coords: TriggerCoords,
    scheme: unknown,
    options: TriggerOptions = {},
  ): void {
    const triggerSource = getTriggerSource(options);
    if (!state.ready) {
      diagnostics?.log("action.skip", {
        reason: "not-ready",
        sourceActionId,
        triggerSource,
      });
      return;
    }
    if (!configStore.isCurrentSiteEnabled?.()) {
      diagnostics?.log("action.skip", {
        reason: "site-disabled",
        sourceActionId,
        triggerSource,
      });
      return;
    }

    const targetScheme = scheme || configStore.getActiveScheme?.();
    const sourceActionConfig = configStore.getActionConfig?.(targetScheme, sourceActionId);
    if (!sourceActionConfig) {
      diagnostics?.log("action.skip", {
        reason: "missing-source-action-config",
        sourceActionId,
        triggerSource,
      });
      return;
    }
    const sourceTriggerConfig = configStore.getActionTriggerConfig(sourceActionConfig);
    if (!configStore.matchesTriggerZone?.(coords.target, sourceTriggerConfig.triggerZone, coords.event, { actionId: sourceActionId, triggerSource })) {
      diagnostics?.log("action.skip", {
        reason: "trigger-zone-filtered",
        sourceActionId,
        triggerSource,
        triggerZone: sourceTriggerConfig.triggerZone || "任意区域",
        target: diagnostics?.describeTarget?.(coords.target),
      });
      return;
    }

    const cursorStateId = configStore.resolveCursorStateId?.(coords.target) || "";
    const binding = configStore.getCursorStateBinding?.(targetScheme, cursorStateId, sourceActionId)
      || { actionId: sourceActionId, cursorStateId };
    const resolvedActionId = options.resolvedActionId || binding.actionId;
    diagnostics?.log("action.resolve", {
      sourceActionId,
      resolvedActionId,
      triggerSource,
      cursorStateId: binding.cursorStateId,
      inheritedFromDefault: binding.inheritedFromDefault,
      target: diagnostics?.describeTarget?.(coords.target),
    });
    const actionConfig = configStore.getActionConfig?.(targetScheme, resolvedActionId);
    if (!actionConfig) {
      diagnostics?.log("action.skip", {
        reason: "missing-resolved-action-config",
        sourceActionId,
        resolvedActionId,
        triggerSource,
      });
      return;
    }
    const textConfig = configStore.getActionTextConfig(actionConfig);
    const particleConfig = configStore.getActionParticleConfig(actionConfig);
    const rippleConfig = configStore.getActionRippleConfig(actionConfig);
    const audioConfig = configStore.getActionAudioConfig(actionConfig);
    const animationConfig = configStore.getActionAnimationConfig(actionConfig);
    const imageConfig = configStore.getActionImageConfig(actionConfig);
    const outputSummary = {
      textEnabled: Boolean(textConfig.textEnabled),
      particleEnabled: Boolean(particleConfig.particle),
      rippleEnabled: Boolean(rippleConfig.ripple),
      soundEnabled: Boolean(audioConfig.sound),
      animationEnabled: Boolean(animationConfig.animationEnabled),
      imageEnabled: Boolean(imageConfig.imageEnabled && imageConfig.imageDataUrl),
      cursorOverrideEnabled: Boolean(visualEffects.hasCursorOverride(actionConfig)),
    };
    if (!outputSummary.textEnabled && !outputSummary.particleEnabled && !outputSummary.rippleEnabled && !outputSummary.soundEnabled && !outputSummary.animationEnabled && !outputSummary.imageEnabled && !outputSummary.cursorOverrideEnabled) {
      diagnostics?.log("action.skip", {
        reason: "no-enabled-effects",
        sourceActionId,
        resolvedActionId,
        triggerSource,
        outputs: outputSummary,
      });
      return;
    }

    ensureMaps();
    const now = Date.now();
    const holdMs = (sourceTriggerConfig.holdMs as number) || 0;
    const throttleMs = options.throttleMs ?? (sourceActionId === "wheel" ? Math.max(80, holdMs || 80) : 40);
    const elapsedMs = now - ((state.lastTriggerAtByAction as Record<string, number>)[sourceActionId] || 0);
    if (!options.force && elapsedMs < throttleMs) {
      diagnostics?.log("action.skip", {
        reason: "throttled",
        sourceActionId,
        resolvedActionId,
        triggerSource,
        elapsedMs,
        throttleMs,
      });
      return;
    }
    (state.lastTriggerAtByAction as Record<string, number>)[sourceActionId] = now;

    const runCounts = state.actionRunCounts as Record<string, number>;
    const runIndex = (runCounts[resolvedActionId] || 0) + 1;
    runCounts[resolvedActionId] = runIndex;
    const comboWindowMs = getComboWindowMs(actionConfig);
    const comboStates = state.actionComboStates as Record<string, { count: number; lastAt: number }>;
    const previousComboState = comboStates[resolvedActionId] || { count: 0, lastAt: 0 };
    const comboIndex = now - previousComboState.lastAt <= comboWindowMs
      ? previousComboState.count + 1
      : 1;
    comboStates[resolvedActionId] = {
      count: comboIndex,
      lastAt: now,
    };
    diagnostics?.log("action.fire", {
      sourceActionId,
      resolvedActionId,
      triggerSource,
      runIndex,
      comboIndex,
      comboWindowMs,
      force: Boolean(options.force),
      outputs: outputSummary,
      target: diagnostics?.describeTarget?.(coords.target),
    });
    visualEffects.renderRipple(coords.x, coords.y, actionConfig);
    const particleCfg = configStore.getActionParticleConfig(actionConfig);
    if (particleCfg.particleMotionMode === "orbital") {
      // clear previous orbital groups before creating new ones
      visualEffects.clearOrbitalParticles();
      visualEffects.renderOrbitalParticles(coords.x, coords.y, actionConfig, runIndex);
    } else {
      visualEffects.renderParticles(coords.x, coords.y, actionConfig, runIndex);
    }
    visualEffects.renderText(coords.x, coords.y, actionConfig, resolvedActionId, comboIndex);
    visualEffects.renderAnimationEffect(coords.x, coords.y, actionConfig);
    visualEffects.renderImageEffect(coords.x, coords.y, actionConfig);
    visualEffects.renderCursorOverride(coords.x, coords.y, actionConfig);
    audioRuntime.playSound(actionConfig, resolvedActionId, { comboIndex });
  }

  function scheduleActionTrigger(
    actionId: string,
    coords: TriggerCoords,
    scheme: unknown,
    delayMs: number,
    options: TriggerOptions = {},
  ): void {
    const run = (): void => triggerAction(actionId, coords, scheme, options);
    if (!delayMs) {
      run();
      return;
    }
    diagnostics?.log("action.schedule", {
      actionId,
      triggerSource: getTriggerSource(options),
      delayMs,
    });
    window.setTimeout(run, delayMs);
  }

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

    const doubleClickConfig = configStore.getActionConfig?.(scheme, "doubleClick");
    const doubleClickTriggerConfig = configStore.getActionTriggerConfig(doubleClickConfig);
    const doubleClickInterval = getActionTimingMs("doubleClick", doubleClickConfig);
    const now = Date.now();
    if (doubleClickTriggerConfig.triggerTiming === "第二次按下时") {
      if (now - (state.lastLeftPointerDownAt || 0) <= doubleClickInterval) {
        triggerAction("doubleClick", coords, scheme, {
          throttleMs: doubleClickInterval,
          triggerSource: "double-click-down",
        });
        state.lastLeftPointerDownAt = 0;
      } else {
        state.lastLeftPointerDownAt = now;
        diagnostics?.log("action.arm", {
          actionId: "doubleClick",
          triggerSource: "double-click-down",
          windowMs: doubleClickInterval,
        });
      }
    } else {
      state.lastLeftPointerDownAt = now;
    }

    if (!longPressArmed) return;

    const lp: NonNullable<EngineState["longPressState"]> = {
      startedAt: Date.now(),
      pointerId: (event as unknown as { pointerId?: number }).pointerId,
      x: event.x,
      y: event.y,
      target: coords.target,
      scheme,
      triggered: false,
      releaseMode: longPressTriggerConfig.triggerTiming === "松开后触发",
      thresholdMs: getActionTimingMs("longPress", longPressConfig),
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
      if (!state.longPressState.releaseMode) {
        triggerAction("longPress", { x: state.longPressState.x, y: state.longPressState.y, target: state.longPressState.target, event: null }, state.longPressState.scheme, {
          throttleMs: state.longPressState.thresholdMs,
          triggerSource: "longpress-timeout",
        });
      }
    }, lp.thresholdMs);
  }

  function finishLongPress(event: CursorEvent | null): void {
    if (!state.longPressState) return;
    if (state.longPressState.timeoutId !== undefined) {
      window.clearTimeout(state.longPressState.timeoutId);
    }
    const duration = Date.now() - state.longPressState.startedAt;
    if (state.longPressState.releaseMode && duration >= state.longPressState.thresholdMs) {
      triggerAction(
        "longPress",
        {
          x: event?.x ?? state.longPressState.x,
          y: event?.y ?? state.longPressState.y,
          target: (event as unknown as { target?: unknown })?.target ?? state.longPressState.target,
          event,
        },
        state.longPressState.scheme,
        {
          throttleMs: state.longPressState.thresholdMs,
          triggerSource: "longpress-release",
        },
      );
    }
    state.longPressState = null;
  }

  function cancelLongPress(): void {
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

  function handlePointerUp(event: CursorEvent): void {
    const scheme = configStore.getActiveScheme?.();
    const lpState = state.longPressState;
    const longPressFired = lpState && (
      lpState.triggered ||
      (lpState.releaseMode && (Date.now() - lpState.startedAt) >= lpState.thresholdMs)
    );

    finishLongPress(event);

    const coords = makeCoordsFromEvent(event);
    if (!longPressFired) {
      const leftClickConfig = configStore.getActionConfig?.(scheme, "leftClick");
      const leftClickTriggerConfig = configStore.getActionTriggerConfig(leftClickConfig);
      if (leftClickTriggerConfig.triggerTiming !== "按下时" || lpState) {
        scheduleActionTrigger("leftClick", coords, scheme, getActionTimingMs("leftClick", leftClickConfig), {
          triggerSource: "left-pointer-up",
        });
      }
    }

    const doubleClickConfig = configStore.getActionConfig?.(scheme, "doubleClick");
    const doubleClickTriggerConfig = configStore.getActionTriggerConfig(doubleClickConfig);
    const doubleClickInterval = getActionTimingMs("doubleClick", doubleClickConfig);
    const now = Date.now();
    if (doubleClickTriggerConfig.triggerTiming !== "第二次按下时") {
      if (now - (state.lastLeftPointerUpAt || 0) <= doubleClickInterval) {
        triggerAction("doubleClick", coords, scheme, {
          throttleMs: doubleClickInterval,
          triggerSource: "double-click-up",
        });
        state.lastLeftPointerUpAt = 0;
      } else {
        state.lastLeftPointerUpAt = now;
        diagnostics?.log("action.arm", {
          actionId: "doubleClick",
          triggerSource: "double-click-up",
          windowMs: doubleClickInterval,
        });
      }
    } else {
      state.lastLeftPointerUpAt = now;
    }
  }

  function handlePointerCancel(): void {
    cancelLongPress();
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

  function previewAtViewportCenter(schemeId?: string, previewScheme?: unknown, actionId?: string): void {
    if (!configStore.isCurrentSiteEnabled?.()) return;
    const config = configStore.getConfig?.();
    const resolvedScheme = previewScheme
      || (config?.schemes.find((scheme) => scheme.id === (schemeId || config?.activeSchemeId)))
      || configStore.getActiveScheme?.();
    const x = Math.round(window.innerWidth / 2);
    const y = Math.round(window.innerHeight / 2);
    triggerAction(actionId || "leftClick", { x, y, target: document.body, event: null }, resolvedScheme, {
      force: true,
      resolvedActionId: actionId || "leftClick",
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
    previewAtViewportCenter,
  };
}
