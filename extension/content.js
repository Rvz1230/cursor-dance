(function cursorDanceMinimalContent() {
  const modules = window.CursorDanceContentModules || {};
  const defaultConfig = window.CursorDanceDefaultConfig || {};
  const runtimeConfig = window.CursorDanceConfigRuntime || {};

  const constants = {
    ROOT_ID: "cursordance-root",
    STYLE_ID: "cursordance-style",
    HIDE_CURSOR_CLASS: "cd-hide-native-cursor",
    CONFIG_STORAGE_KEY: "cursordance.config",
    LIVE_PREVIEW_CONFIG_STORAGE_KEY: "cursordance.livePreviewConfig",
    LOCAL_PREVIEW_CHANNEL_NAME: "cursordance.local-preview",
    CURSOR_ASSET_STORAGE_KEY_PREFIX: "cursordance.cursorAsset.",
    RUNTIME_ERRORS_STORAGE_KEY: "cursordance.runtimeErrors",
    INTERACTIVE_SELECTOR: 'a,button,input,textarea,select,summary,label,[role="button"],[tabindex]',
    TEXT_EDITABLE_SELECTOR: 'textarea,input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"]),[contenteditable]:not([contenteditable="false"])',
  };

  const MAX_RUNTIME_ERRORS = 10;
  let errorWriteTimer = null;
  let pendingErrors = [];

  const state = {
    config: null,
    ready: false,
    lastTriggerAtByAction: Object.create(null),
    actionRunCounts: Object.create(null),
    actionComboStates: Object.create(null),
    lastSoundAtByAction: Object.create(null),
    mediaDuckState: new WeakMap(),
    activeEffects: 0,
    hoverTimeoutId: null,
    hoverTarget: null,
    longPressState: null,
    lastLeftPointerDownAt: 0,
    lastLeftPointerUpAt: 0,
    lastWheelEventAt: 0,
    audioContext: null,
    stateCursorNode: null,
    stateCursorImg: null,
  };

  const runtime = {
    window,
    document,
    chrome: globalThis.chrome ?? null,
    defaultConfig,
    runtimeConfig,
    constants,
    state,
  };

  function reportRuntimeError(type, detail) {
    if (!runtime.chrome?.storage?.local) return;
    const entry = {
      type,
      detail: typeof detail === "string" ? detail : (detail?.message || JSON.stringify(detail || {})),
      host: window.location.host || "",
      at: new Date().toISOString(),
    };
    pendingErrors.push(entry);
    if (pendingErrors.length > MAX_RUNTIME_ERRORS + 5) {
      pendingErrors = pendingErrors.slice(-MAX_RUNTIME_ERRORS);
    }
    if (errorWriteTimer) return;
    errorWriteTimer = window.setTimeout(() => {
      errorWriteTimer = null;
      const batch = pendingErrors.slice(-MAX_RUNTIME_ERRORS);
      pendingErrors = [];
      try {
        runtime.chrome.storage.local.set({ [constants.RUNTIME_ERRORS_STORAGE_KEY]: batch });
      } catch {
        // Best-effort error reporting.
      }
    }, 500);
  }

  const diagnostics = modules.createDiagnostics({
    ...runtime,
  });
  const configStore = modules.createConfigStore({
    ...runtime,
    diagnostics,
    reportRuntimeError,
  });
  state.config = configStore.normalizeConfig(defaultConfig);

  const visualEffects = modules.createVisualEffects({
    ...runtime,
    diagnostics,
    configStore,
  });
  const audioRuntime = modules.createAudioRuntime({
    ...runtime,
    diagnostics,
    configStore,
    reportRuntimeError,
  });
  const cursorOverlay = modules.createCursorOverlay({
    ...runtime,
    diagnostics,
    configStore,
    visualEffects,
  });
  const triggerHandlers = modules.createTriggerHandlers({
    ...runtime,
    diagnostics,
    configStore,
    visualEffects,
    audioRuntime,
    cursorOverlay,
  });
  const atmosphere = modules.createAtmosphere({
    ...runtime,
    diagnostics,
    configStore,
  });

  visualEffects.ensureRoot();
  diagnostics.log("runtime.ready", {
    diagnosticsStorageKey: diagnostics.STORAGE_KEY,
    activeThemeId: state.config?.activeThemeId || defaultConfig.activeThemeId || null,
    host: window.location.host || null,
    localPreviewHost: configStore.isLocalPreviewHost(),
  });
  configStore.syncConfigFromStorage({
    clearStateCursorOverlay: cursorOverlay.clearStateCursorOverlay,
  }).finally(() => {
    state.ready = true;
    try {
      var scheme = configStore.getActiveScheme();
      var atmosConfig = configStore.getAtmosphereConfig(scheme);
      atmosphere.syncConfig(atmosConfig);
    } catch (e) {}
  });

  configStore.setOnSyncComplete(function onConfigSync() {
    try {
      if (state.ready) {
        var scheme = configStore.getActiveScheme();
        var atmosConfig = configStore.getAtmosphereConfig(scheme);
        atmosphere.syncConfig(atmosConfig);
      }
    } catch (e) {}
  });

  if (configStore.isLocalPreviewHost()) {
    try {
      window.addEventListener("storage", (event) => {
        if (
          event.key !== constants.CONFIG_STORAGE_KEY
          && event.key !== constants.LIVE_PREVIEW_CONFIG_STORAGE_KEY
        ) {
          return;
        }
        void configStore.debouncedSyncConfigFromStorage({
          clearStateCursorOverlay: cursorOverlay.clearStateCursorOverlay,
        });
      });
    } catch {
      reportRuntimeError("storage-bridge", "Local preview storage bridge unavailable.");
    }

    try {
      if (typeof window.BroadcastChannel === "function") {
        const localPreviewChannel = new window.BroadcastChannel(constants.LOCAL_PREVIEW_CHANNEL_NAME);
        localPreviewChannel.addEventListener("message", (event) => {
          const message = event.data || {};
          if (message.type === "config-updated") {
            configStore.setConfig(message.config || defaultConfig);
            cursorOverlay.clearStateCursorOverlay();
            return;
          }
          if (message.type === "preview-theme") {
            triggerHandlers.previewAtViewportCenter(message.themeId, message.themePack, message.actionId);
          }
        });
      }
    } catch {
      // Ignore local preview broadcast bridge failures.
    }
  }

  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;
      const changedKeys = Object.keys(changes);
      if (
        changedKeys.includes(constants.CONFIG_STORAGE_KEY)
        || changedKeys.includes(constants.LIVE_PREVIEW_CONFIG_STORAGE_KEY)
        || changedKeys.some((key) => key.startsWith(constants.CURSOR_ASSET_STORAGE_KEY_PREFIX))
      ) {
        void configStore.debouncedSyncConfigFromStorage({
          clearStateCursorOverlay: cursorOverlay.clearStateCursorOverlay,
        });
      }
    });
  } catch {
    reportRuntimeError("storage-listener", "chrome.storage.onChanged unavailable; live config sync disabled.");
    configStore.setConfig(state.config);
  }

  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "CURSORDANCE_PREVIEW_SCHEME") {
        triggerHandlers.previewAtViewportCenter(message.schemeId, message.scheme, message.actionId);
        sendResponse({ ok: true });
      }
      return false;
    });
  } catch {
    reportRuntimeError("messaging", "chrome.runtime.onMessage unavailable; preview trigger disabled.");
  }

  document.addEventListener("pointerdown", triggerHandlers.handleLeftPointerDown, true);
  document.addEventListener("pointerdown", triggerHandlers.handleRightPointerDown, true);
  document.addEventListener("pointermove", cursorOverlay.syncStateCursorOverlay, { capture: true, passive: true });
  document.addEventListener("pointerup", triggerHandlers.handlePointerUp, true);
  document.addEventListener("pointercancel", triggerHandlers.handlePointerCancel, true);
  document.addEventListener("contextmenu", triggerHandlers.handleContextMenu, true);
  document.addEventListener("wheel", triggerHandlers.handleWheel, { capture: true, passive: true });
  document.addEventListener("pointerover", triggerHandlers.handlePointerOver, true);
  document.addEventListener("pointerout", triggerHandlers.handlePointerOut, true);
  window.addEventListener("blur", cursorOverlay.clearStateCursorOverlay);
})();
