(function registerContentTriggerHandlers(globalThis) {
  const modules = globalThis.CursorDanceContentModules || (globalThis.CursorDanceContentModules = {});

  modules.createTriggerHandlers = function createTriggerHandlers(runtime) {
    const {
      window,
      document,
      state,
      configStore,
      visualEffects,
      audioRuntime,
      cursorOverlay,
    } = runtime;

    function getActionTimingMs(actionId, actionConfig) {
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
      if (actionId === "hover") {
        return value === 420 ? 220 : Math.max(80, Math.min(700, value || 220));
      }
      if (actionId === "longPress") {
        return Math.max(120, Math.min(900, value || 420));
      }
      return Math.max(0, value);
    }

    function makeCoordsFromEvent(event) {
      return {
        x: event.clientX,
        y: event.clientY,
        target: event.target,
        event,
      };
    }

    function triggerAction(sourceActionId, coords, scheme, options = {}) {
      if (!configStore.isCurrentSiteEnabled()) return;

      const targetScheme = scheme || configStore.getActiveScheme();
      const sourceActionConfig = configStore.getActionConfig(targetScheme, sourceActionId);
      if (!sourceActionConfig) return;
      const sourceTriggerConfig = configStore.getActionTriggerConfig(sourceActionConfig);
      if (!configStore.matchesTriggerZone(coords.target, sourceTriggerConfig.triggerZone, coords.event)) return;

      const resolvedActionId = options.resolvedActionId || configStore.getCursorStateBinding(
        targetScheme,
        configStore.resolveCursorStateId(coords.target),
        sourceActionId
      ).actionId;
      const actionConfig = configStore.getActionConfig(targetScheme, resolvedActionId);
      if (!actionConfig) return;
      const textConfig = configStore.getActionTextConfig(actionConfig);
      const particleConfig = configStore.getActionParticleConfig(actionConfig);
      const rippleConfig = configStore.getActionRippleConfig(actionConfig);
      const audioConfig = configStore.getActionAudioConfig(actionConfig);
      if (!textConfig.textEnabled && !particleConfig.particle && !rippleConfig.ripple && !audioConfig.sound && !visualEffects.hasCursorOverride(actionConfig)) {
        return;
      }

      const now = Date.now();
      const throttleMs = options.throttleMs ?? (sourceActionId === "wheel" || sourceActionId === "hover" ? Math.max(80, sourceTriggerConfig.holdMs || 80) : 40);
      if (!options.force && now - (state.lastTriggerAtByAction[sourceActionId] || 0) < throttleMs) return;
      state.lastTriggerAtByAction[sourceActionId] = now;

      const runIndex = (state.actionRunCounts[resolvedActionId] || 0) + 1;
      state.actionRunCounts[resolvedActionId] = runIndex;
      visualEffects.renderRipple(coords.x, coords.y, actionConfig);
      visualEffects.renderParticles(coords.x, coords.y, actionConfig);
      visualEffects.renderText(coords.x, coords.y, actionConfig, resolvedActionId, runIndex);
      visualEffects.renderCursorOverride(coords.x, coords.y, actionConfig);
      audioRuntime.playSound(actionConfig, resolvedActionId);
    }

    function scheduleActionTrigger(actionId, coords, scheme, delayMs, options = {}) {
      const run = () => triggerAction(actionId, coords, scheme, options);
      if (!delayMs) {
        run();
        return;
      }
      window.setTimeout(run, delayMs);
    }

    function handleLeftPointerDown(event) {
      if (event.button !== 0) return;
      const scheme = configStore.getActiveScheme();
      const leftClickConfig = configStore.getActionConfig(scheme, "leftClick");
      const leftClickTriggerConfig = configStore.getActionTriggerConfig(leftClickConfig);
      if (leftClickTriggerConfig.triggerTiming === "按下时") {
        scheduleActionTrigger("leftClick", makeCoordsFromEvent(event), scheme, getActionTimingMs("leftClick", leftClickConfig));
      }

      const doubleClickConfig = configStore.getActionConfig(scheme, "doubleClick");
      const doubleClickTriggerConfig = configStore.getActionTriggerConfig(doubleClickConfig);
      const doubleClickInterval = getActionTimingMs("doubleClick", doubleClickConfig);
      const now = Date.now();
      if (doubleClickTriggerConfig.triggerTiming === "第二次按下时") {
        if (now - state.lastLeftPointerDownAt <= doubleClickInterval) {
          triggerAction("doubleClick", makeCoordsFromEvent(event), scheme, { throttleMs: doubleClickInterval });
          state.lastLeftPointerDownAt = 0;
        } else {
          state.lastLeftPointerDownAt = now;
        }
      } else {
        state.lastLeftPointerDownAt = now;
      }

      const longPressConfig = configStore.getActionConfig(scheme, "longPress");
      const longPressTriggerConfig = configStore.getActionTriggerConfig(longPressConfig);
      if (!longPressConfig || !configStore.matchesTriggerZone(event.target, longPressTriggerConfig.triggerZone, event)) return;

      state.longPressState = {
        startedAt: Date.now(),
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        target: event.target,
        scheme,
        triggered: false,
        releaseMode: longPressTriggerConfig.triggerTiming === "松开后触发",
        thresholdMs: getActionTimingMs("longPress", longPressConfig),
      };

      state.longPressState.timeoutId = window.setTimeout(() => {
        if (!state.longPressState) return;
        state.longPressState.triggered = true;
        if (!state.longPressState.releaseMode) {
          triggerAction("longPress", { x: state.longPressState.x, y: state.longPressState.y, target: state.longPressState.target }, state.longPressState.scheme, {
            throttleMs: state.longPressState.thresholdMs,
          });
        }
      }, state.longPressState.thresholdMs);
    }

    function finishLongPress(event) {
      if (!state.longPressState) return;
      window.clearTimeout(state.longPressState.timeoutId);
      const duration = Date.now() - state.longPressState.startedAt;
      if (state.longPressState.releaseMode && duration >= state.longPressState.thresholdMs) {
        triggerAction(
          "longPress",
          {
            x: event?.clientX ?? state.longPressState.x,
            y: event?.clientY ?? state.longPressState.y,
            target: event?.target ?? state.longPressState.target,
            event,
          },
          state.longPressState.scheme,
          { throttleMs: state.longPressState.thresholdMs }
        );
      }
      state.longPressState = null;
    }

    function cancelLongPress() {
      if (!state.longPressState) return;
      window.clearTimeout(state.longPressState.timeoutId);
      state.longPressState = null;
    }

    function handlePointerUp(event) {
      if (event.button === 0) {
        const scheme = configStore.getActiveScheme();
        const leftClickConfig = configStore.getActionConfig(scheme, "leftClick");
        const leftClickTriggerConfig = configStore.getActionTriggerConfig(leftClickConfig);
        if (leftClickTriggerConfig.triggerTiming !== "按下时") {
          scheduleActionTrigger("leftClick", makeCoordsFromEvent(event), scheme, getActionTimingMs("leftClick", leftClickConfig));
        }

        const doubleClickConfig = configStore.getActionConfig(scheme, "doubleClick");
        const doubleClickTriggerConfig = configStore.getActionTriggerConfig(doubleClickConfig);
        const doubleClickInterval = getActionTimingMs("doubleClick", doubleClickConfig);
        const now = Date.now();
        if (doubleClickTriggerConfig.triggerTiming !== "第二次按下时") {
          if (now - state.lastLeftPointerUpAt <= doubleClickInterval) {
            triggerAction("doubleClick", makeCoordsFromEvent(event), scheme, { throttleMs: doubleClickInterval });
            state.lastLeftPointerUpAt = 0;
          } else {
            state.lastLeftPointerUpAt = now;
          }
        } else {
          state.lastLeftPointerUpAt = now;
        }
        finishLongPress(event);
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
        scheduleActionTrigger("rightClick", makeCoordsFromEvent(event), scheme, getActionTimingMs("rightClick", actionConfig));
      }
    }

    function handleContextMenu(event) {
      const scheme = configStore.getActiveScheme();
      const actionConfig = configStore.getActionConfig(scheme, "rightClick");
      const triggerConfig = configStore.getActionTriggerConfig(actionConfig);
      if (triggerConfig.triggerTiming !== "按下时") {
        scheduleActionTrigger("rightClick", makeCoordsFromEvent(event), scheme, getActionTimingMs("rightClick", actionConfig));
      }
    }

    function handleWheel(event) {
      const scheme = configStore.getActiveScheme();
      const actionConfig = configStore.getActionConfig(scheme, "wheel");
      const triggerConfig = configStore.getActionTriggerConfig(actionConfig);
      if (!configStore.matchesTriggerZone(event.target, triggerConfig.triggerZone, event)) return;
      const timingMs = getActionTimingMs("wheel", actionConfig);
      const now = Date.now();
      const isNewBurst = now - state.lastWheelEventAt > timingMs;
      state.lastWheelEventAt = now;
      if (triggerConfig.triggerTiming === "滚动开始时" && !isNewBurst) return;
      triggerAction("wheel", makeCoordsFromEvent(event), scheme, {
        throttleMs: triggerConfig.triggerTiming === "连续滚动中" ? timingMs : 0,
      });
    }

    function handlePointerOver(event) {
      cursorOverlay.syncStateCursorOverlay(event);
      const scheme = configStore.getActiveScheme();
      const actionConfig = configStore.getActionConfig(scheme, "hover");
      const triggerConfig = configStore.getActionTriggerConfig(actionConfig);
      if (!actionConfig || !configStore.matchesTriggerZone(event.target, triggerConfig.triggerZone, event)) return;

      window.clearTimeout(state.hoverTimeoutId);
      state.hoverTarget = event.target;

      if (triggerConfig.triggerTiming === "进入时") {
        triggerAction("hover", makeCoordsFromEvent(event), scheme, { throttleMs: 120 });
        return;
      }

      const hoverDelay = getActionTimingMs("hover", actionConfig);
      state.hoverTimeoutId = window.setTimeout(() => {
        if (state.hoverTarget !== event.target) return;
        triggerAction("hover", makeCoordsFromEvent(event), scheme, {
          throttleMs: hoverDelay,
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
      }
    }

    function previewAtViewportCenter(schemeId, previewScheme, actionId) {
      if (!configStore.isCurrentSiteEnabled()) return;
      const resolvedScheme = previewScheme || configStore.getConfig().schemes.find((scheme) => scheme.id === (schemeId || configStore.getConfig().activeSchemeId)) || configStore.getActiveScheme();
      const x = Math.round(window.innerWidth / 2);
      const y = Math.round(window.innerHeight / 2);
      triggerAction(actionId || "leftClick", { x, y, target: document.body }, resolvedScheme, {
        force: true,
        resolvedActionId: actionId || "leftClick",
        throttleMs: 0,
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
