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
    LEGACY_ENABLED_STORAGE_KEY: "cursordance.enabled",
    INTERACTIVE_SELECTOR: 'a,button,input,textarea,select,summary,label,[role="button"],[tabindex]',
    TEXT_EDITABLE_SELECTOR: 'textarea,input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="color"]),[contenteditable]:not([contenteditable="false"])',
  };

  const state = {
    config: null,
    lastTriggerAtByAction: Object.create(null),
    actionRunCounts: Object.create(null),
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

  const configStore = modules.createConfigStore(runtime);
  state.config = configStore.normalizeConfig(defaultConfig);

  const visualEffects = modules.createVisualEffects({
    ...runtime,
    configStore,
  });
  const audioRuntime = modules.createAudioRuntime({
    ...runtime,
    configStore,
  });
  const cursorOverlay = modules.createCursorOverlay({
    ...runtime,
    configStore,
    visualEffects,
  });
  const triggerHandlers = modules.createTriggerHandlers({
    ...runtime,
    configStore,
    visualEffects,
    audioRuntime,
    cursorOverlay,
  });

  visualEffects.ensureRoot();
  void configStore.syncConfigFromStorage({
    clearStateCursorOverlay: cursorOverlay.clearStateCursorOverlay,
  });

  if (configStore.isLocalPreviewHost()) {
    try {
      window.addEventListener("storage", (event) => {
        if (
          event.key !== constants.CONFIG_STORAGE_KEY
          && event.key !== constants.LEGACY_ENABLED_STORAGE_KEY
          && event.key !== constants.LIVE_PREVIEW_CONFIG_STORAGE_KEY
        ) {
          return;
        }
        void configStore.syncConfigFromStorage({
          clearStateCursorOverlay: cursorOverlay.clearStateCursorOverlay,
        });
      });
    } catch {
      // Ignore local preview storage bridge failures.
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
        || changedKeys.includes(constants.LEGACY_ENABLED_STORAGE_KEY)
        || changedKeys.some((key) => key.startsWith(constants.CURSOR_ASSET_STORAGE_KEY_PREFIX))
      ) {
        void configStore.syncConfigFromStorage({
          clearStateCursorOverlay: cursorOverlay.clearStateCursorOverlay,
        });
      }
    });
  } catch {
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
    // Keep the runtime usable even if extension messaging is unavailable.
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
