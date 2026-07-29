(function registerContentTriggerHandlers(globalThis) {
  const modules = globalThis.CursorDanceContentModules || (globalThis.CursorDanceContentModules = {});
  const effectRuntime = globalThis.CursorDanceEffectRuntime || {};
  const { decideActionExecution, getActionTimingMs } = effectRuntime;

  if (typeof decideActionExecution !== "function" || typeof getActionTimingMs !== "function") {
    throw new Error("CursorDance shared effect runtime is not loaded.");
  }

  modules.createTriggerHandlers = function createTriggerHandlers(runtime) {
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

    function makeCoordsFromEvent(event) {
      return {
        x: event.clientX,
        y: event.clientY,
        target: event.target,
        event,
      };
    }

    function getTriggerSource(options) {
      return options.triggerSource || "unknown";
    }

    function triggerAction(sourceActionId, coords, scheme, options = {}) {
      const triggerSource = getTriggerSource(options);
      if (!state.ready) {
        diagnostics?.log("action.skip", {
          reason: "not-ready",
          sourceActionId,
          triggerSource,
        });
        return;
      }
      if (!configStore.isCurrentSiteEnabled()) {
        diagnostics?.log("action.skip", {
          reason: "site-disabled",
          sourceActionId,
          triggerSource,
        });
        return;
      }

      const targetScheme = scheme || configStore.getActiveScheme();
      const sourceActionConfig = configStore.getActionConfig(targetScheme, sourceActionId);
      if (!sourceActionConfig) {
        diagnostics?.log("action.skip", {
          reason: "missing-source-action-config",
          sourceActionId,
          triggerSource,
        });
        return;
      }
      const sourceTriggerConfig = configStore.getActionTriggerConfig(sourceActionConfig);
      if (!configStore.matchesTriggerZone(coords.target, sourceTriggerConfig.triggerZone, coords.event, { actionId: sourceActionId, triggerSource })) {
        diagnostics?.log("action.skip", {
          reason: "trigger-zone-filtered",
          sourceActionId,
          triggerSource,
          triggerZone: sourceTriggerConfig.triggerZone || "任意区域",
          target: diagnostics?.describeTarget(coords.target),
        });
        return;
      }

      const binding = configStore.getCursorStateBinding(
        targetScheme,
        configStore.resolveCursorStateId(coords.target),
        sourceActionId
      );
      const resolvedActionId = options.resolvedActionId || binding.actionId;
      diagnostics?.log("action.resolve", {
        sourceActionId,
        resolvedActionId,
        triggerSource,
        cursorStateId: binding.cursorStateId,
        inheritedFromDefault: binding.inheritedFromDefault,
        target: diagnostics?.describeTarget(coords.target),
      });
      const actionConfig = configStore.getActionConfig(targetScheme, resolvedActionId);
      if (!actionConfig) {
        diagnostics?.log("action.skip", {
          reason: "missing-resolved-action-config",
          sourceActionId,
          resolvedActionId,
          triggerSource,
        });
        return;
      }
      const decision = decideActionExecution(state, {
        sourceActionId,
        resolvedActionId,
        x: coords.x,
        y: coords.y,
        actionConfig,
        sourceTriggerConfig,
        now: Date.now(),
        throttleMs: options.throttleMs,
        force: options.force,
      });
      if (decision.status === "skip") {
        diagnostics?.log("action.skip", {
          reason: decision.reason,
          sourceActionId,
          resolvedActionId,
          triggerSource,
          outputs: decision.outputs,
          ...(decision.reason === "throttled"
            ? { elapsedMs: decision.elapsedMs, throttleMs: decision.throttleMs }
            : {}),
        });
        return;
      }
      diagnostics?.log("action.fire", {
        sourceActionId,
        resolvedActionId,
        triggerSource,
        runIndex: decision.runIndex,
        comboIndex: decision.comboIndex,
        comboWindowMs: decision.comboWindowMs,
        force: Boolean(options.force),
        outputs: decision.outputs,
        target: diagnostics?.describeTarget(coords.target),
      });
      for (const effect of decision.outputPlan.effects) {
        if (effect.kind === "ripple") visualEffects.renderRipple(effect.x, effect.y, effect.actionConfig);
        else if (effect.kind === "particle" && effect.particleMode === "orbital") {
          visualEffects.renderOrbitalParticles(effect.x, effect.y, effect.actionConfig, effect.runIndex, effect.actionId);
        } else if (effect.kind === "particle") {
          visualEffects.renderParticles(effect.x, effect.y, effect.actionConfig, effect.runIndex);
        } else if (effect.kind === "text") {
          visualEffects.renderText(effect.x, effect.y, effect.actionConfig, effect.actionId, effect.runIndex);
        } else if (effect.kind === "animation") visualEffects.renderAnimationEffect(effect.x, effect.y, effect.actionConfig);
        else if (effect.kind === "image") visualEffects.renderImageEffect(effect.x, effect.y, effect.actionConfig);
        else if (effect.kind === "cursor") visualEffects.renderCursorOverride(effect.x, effect.y, effect.actionConfig);
      }
      if (decision.outputPlan.audio) {
        const audio = decision.outputPlan.audio;
        audioRuntime.playSound(audio.actionConfig, audio.actionId, {
          comboIndex: audio.comboIndex,
          comboWindowMs: audio.comboWindowMs,
          runIndex: audio.runIndex,
        });
      }
    }

    function scheduleActionTrigger(actionId, coords, scheme, delayMs, options = {}) {
      const run = () => triggerAction(actionId, coords, scheme, options);
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

    function handleLeftPointerDown(event) {
      if (event.button !== 0) return;
      const scheme = configStore.getActiveScheme();
      const leftClickConfig = configStore.getActionConfig(scheme, "leftClick");
      const leftClickTriggerConfig = configStore.getActionTriggerConfig(leftClickConfig);

      const longPressConfig = configStore.getActionConfig(scheme, "longPress");
      const longPressTriggerConfig = configStore.getActionTriggerConfig(longPressConfig);
      const longPressArmed = longPressConfig && configStore.matchesTriggerZone(event.target, longPressTriggerConfig.triggerZone, event, {
        actionId: "longPress",
        triggerSource: "longpress-arm",
      });

      if (leftClickTriggerConfig.triggerTiming === "按下时" && !longPressArmed) {
        scheduleActionTrigger("leftClick", makeCoordsFromEvent(event), scheme, getActionTimingMs("leftClick", leftClickConfig), {
          triggerSource: "left-pointer-down",
        });
      }

      const doubleClickConfig = configStore.getActionConfig(scheme, "doubleClick");
      const doubleClickTriggerConfig = configStore.getActionTriggerConfig(doubleClickConfig);
      const doubleClickInterval = getActionTimingMs("doubleClick", doubleClickConfig);
      const now = Date.now();
      if (doubleClickTriggerConfig.triggerTiming === "第二次按下时") {
        if (now - state.lastLeftPointerDownAt <= doubleClickInterval) {
          triggerAction("doubleClick", makeCoordsFromEvent(event), scheme, {
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

      state.longPressState = {
        startedAt: Date.now(),
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        target: event.target,
        scheme,
        triggered: false,
        fired: false,
        releaseMode: longPressTriggerConfig.triggerTiming === "松开后触发",
        thresholdMs: getActionTimingMs("longPress", longPressConfig),
      };
      diagnostics?.log("action.arm", {
        actionId: "longPress",
        triggerSource: "longpress-arm",
        thresholdMs: state.longPressState.thresholdMs,
      });

      state.longPressState.timeoutId = window.setTimeout(() => {
        if (!state.longPressState) return;
        state.longPressState.triggered = true;
        if (!state.longPressState.releaseMode && !state.longPressState.fired) {
          state.longPressState.fired = true;
          triggerAction("longPress", { x: state.longPressState.x, y: state.longPressState.y, target: state.longPressState.target }, state.longPressState.scheme, {
            throttleMs: state.longPressState.thresholdMs,
            triggerSource: "longpress-timeout",
          });
        }
      }, state.longPressState.thresholdMs);
    }

    function finishLongPress(event) {
      if (!state.longPressState) return;
      window.clearTimeout(state.longPressState.timeoutId);
      const duration = Date.now() - state.longPressState.startedAt;
      if (state.longPressState.releaseMode && duration >= state.longPressState.thresholdMs && !state.longPressState.fired) {
        state.longPressState.fired = true;
        triggerAction(
          "longPress",
          {
            x: event?.clientX ?? state.longPressState.x,
            y: event?.clientY ?? state.longPressState.y,
            target: event?.target ?? state.longPressState.target,
            event,
          },
          state.longPressState.scheme,
          {
            throttleMs: state.longPressState.thresholdMs,
            triggerSource: "longpress-release",
          }
        );
      }
      state.longPressState = null;
    }

    function cancelLongPress() {
      if (!state.longPressState) return;
      window.clearTimeout(state.longPressState.timeoutId);
      diagnostics?.log("action.skip", {
        actionId: "longPress",
        reason: "longpress-cancelled",
      });
      state.longPressState = null;
    }

    function handlePointerUp(event) {
      if (event.button === 0) {
        const scheme = configStore.getActiveScheme();
        const lpState = state.longPressState;
        const longPressFired = lpState && (
          lpState.triggered ||
          (lpState.releaseMode && (Date.now() - lpState.startedAt) >= lpState.thresholdMs)
        );

        finishLongPress(event);

        if (!longPressFired) {
          const leftClickConfig = configStore.getActionConfig(scheme, "leftClick");
          const leftClickTriggerConfig = configStore.getActionTriggerConfig(leftClickConfig);
          if (leftClickTriggerConfig.triggerTiming !== "按下时" || lpState) {
            scheduleActionTrigger("leftClick", makeCoordsFromEvent(event), scheme, getActionTimingMs("leftClick", leftClickConfig), {
              triggerSource: "left-pointer-up",
            });
          }
        }

        const doubleClickConfig = configStore.getActionConfig(scheme, "doubleClick");
        const doubleClickTriggerConfig = configStore.getActionTriggerConfig(doubleClickConfig);
        const doubleClickInterval = getActionTimingMs("doubleClick", doubleClickConfig);
        const now = Date.now();
        if (doubleClickTriggerConfig.triggerTiming !== "第二次按下时") {
        if (now - state.lastLeftPointerUpAt <= doubleClickInterval) {
          triggerAction("doubleClick", makeCoordsFromEvent(event), scheme, {
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
    }

    function handlePointerCancel() {
      cancelLongPress();
    }

    function handleRightPointerDown(event) {
      if (event.button !== 2) return;
      const scheme = configStore.getActiveScheme();
      const actionConfig = configStore.getActionConfig(scheme, "rightClick");
      const triggerConfig = configStore.getActionTriggerConfig(actionConfig);
      if (triggerConfig.triggerTiming === "按下时") {
        scheduleActionTrigger("rightClick", makeCoordsFromEvent(event), scheme, getActionTimingMs("rightClick", actionConfig), {
          triggerSource: "right-pointer-down",
        });
      }
    }

    function handleContextMenu(event) {
      const scheme = configStore.getActiveScheme();
      const actionConfig = configStore.getActionConfig(scheme, "rightClick");
      const triggerConfig = configStore.getActionTriggerConfig(actionConfig);
      if (triggerConfig.triggerTiming !== "按下时") {
        scheduleActionTrigger("rightClick", makeCoordsFromEvent(event), scheme, getActionTimingMs("rightClick", actionConfig), {
          triggerSource: "context-menu",
        });
      }
    }

    function handleWheel(event) {
      const scheme = configStore.getActiveScheme();
      const actionConfig = configStore.getActionConfig(scheme, "wheel");
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
      triggerAction("wheel", makeCoordsFromEvent(event), scheme, {
        throttleMs: triggerConfig.triggerTiming === "连续滚动中" ? timingMs : 0,
        triggerSource: "wheel",
      });
    }

    function handlePointerOver(event) {
      cursorOverlay.syncStateCursorOverlay(event);
      const scheme = configStore.getActiveScheme();
      const actionConfig = configStore.getActionConfig(scheme, "hover");
      const triggerConfig = configStore.getActionTriggerConfig(actionConfig);
      if (!actionConfig || !configStore.matchesTriggerZone(event.target, triggerConfig.triggerZone, event, {
        actionId: "hover",
        triggerSource: "hover-arm",
      })) return;

      window.clearTimeout(state.hoverTimeoutId);
      state.hoverTarget = event.target;

      if (triggerConfig.triggerTiming === "进入时") {
        triggerAction("hover", makeCoordsFromEvent(event), scheme, {
          throttleMs: 120,
          triggerSource: "hover-enter",
        });
        return;
      }

      const hoverDelay = getActionTimingMs("hover", actionConfig);
      state.hoverTimeoutId = window.setTimeout(() => {
        if (state.hoverTarget !== event.target) return;
        triggerAction("hover", makeCoordsFromEvent(event), scheme, {
          throttleMs: hoverDelay,
          triggerSource: "hover-delay",
        });
      }, hoverDelay);
    }

    function handlePointerOut(event) {
      if (!event.relatedTarget) {
        cursorOverlay.clearStateCursorOverlay();
      }
      if (!state.hoverTarget) return;
      if (event.target === state.hoverTarget || (event.target instanceof Element && state.hoverTarget instanceof Element && event.target.contains(state.hoverTarget))) {
        window.clearTimeout(state.hoverTimeoutId);
        state.hoverTarget = null;
        visualEffects.clearOrbitalParticles();
      }
    }

    function previewAtViewportCenter(schemeId, previewScheme, actionId) {
      if (!configStore.isCurrentSiteEnabled()) return;
      const resolvedScheme = previewScheme || configStore.getConfig().themes.find((theme) => theme.id === (schemeId || configStore.getConfig().activeThemeId)) || configStore.getActiveScheme();
      const x = Math.round(window.innerWidth / 2);
      const y = Math.round(window.innerHeight / 2);
      triggerAction(actionId || "leftClick", { x, y, target: document.body }, resolvedScheme, {
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
      handlePointerOver,
      handlePointerOut,
      previewAtViewportCenter,
    };
  };
})(window);
