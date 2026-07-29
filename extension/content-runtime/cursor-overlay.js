(function registerContentCursorOverlay(globalThis) {
  const modules = globalThis.CursorDanceContentModules || (globalThis.CursorDanceContentModules = {});

  modules.createCursorOverlay = function createCursorOverlay(runtime) {
    const {
      document,
      constants,
      state,
      configStore,
      visualEffects,
    } = runtime;

    function ensureStateCursorNode() {
      if (state.stateCursorNode && state.stateCursorImg) return state.stateCursorNode;
      state.stateCursorNode = document.createElement("div");
      state.stateCursorNode.className = "cd-state-cursor";
      state.stateCursorNode.hidden = true;
      state.stateCursorImg = document.createElement("img");
      state.stateCursorImg.alt = "";
      state.stateCursorImg.draggable = false;
      state.stateCursorNode.append(state.stateCursorImg);
      visualEffects.ensureRoot().append(state.stateCursorNode);
      return state.stateCursorNode;
    }

    function clearStateCursorOverlay() {
      document.documentElement.classList.remove(constants.HIDE_CURSOR_CLASS);
      if (state.stateCursorNode) {
        state.stateCursorNode.hidden = true;
      }
    }

    function syncStateCursorOverlay(event) {
      if (!configStore.isCurrentSiteEnabled()) {
        clearStateCursorOverlay();
        return;
      }

      const target = event?.target instanceof Element ? event.target : document.body;
      const scheme = configStore.getActiveScheme();
      const stateId = configStore.resolveCursorStateId(target);
      const cursorState = configStore.getEffectiveCursorStateConfig(scheme, stateId);

      if (cursorState?.image?.kind !== "dataUrl") {
        clearStateCursorOverlay();
        return;
      }

      const cursorNode = ensureStateCursorNode();
      const sourceSize = Math.max(cursorState.image.width || 48, cursorState.image.height || 48);
      const configuredSize = cursorState.size?.mode === "fixedBox" ? cursorState.size.boxSize : sourceSize;
      const cursorSize = Math.max(24, Math.min(96, configuredSize || 48));
      cursorNode.hidden = false;
      cursorNode.style.width = `${cursorSize}px`;
      cursorNode.style.height = `${cursorSize}px`;
      cursorNode.style.transform = `translate3d(${event.clientX - (cursorState.hotspot?.x || 0)}px, ${event.clientY - (cursorState.hotspot?.y || 0)}px, 0)`;

      if (state.stateCursorImg.src !== cursorState.image.dataUrl) {
        state.stateCursorImg.src = cursorState.image.dataUrl;
      }

      document.documentElement.classList.add(constants.HIDE_CURSOR_CLASS);
    }

    return {
      clearStateCursorOverlay,
      syncStateCursorOverlay,
    };
  };
})(window);
