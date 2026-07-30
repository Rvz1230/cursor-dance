import { createVisualEffects, type VisualEffectsModule } from "@/shared/effect-runtime/dom-effect-surface";
import type { CursorOverlayRenderState } from "@/shared/effect-runtime/cursor-overlay";
import {
  defaultConfig as canonicalDefaultConfig,
  normalizeConfig as normalizeCanonicalConfig,
} from "@/shared/config/default-config";
import { createContentAtmosphere, type ContentAtmosphere } from "./atmosphere";
import {
  createContentAudioRuntime,
  type ContentAudioState,
} from "./audio";
import {
  createContentConfigStore,
  type ContentConfig,
  type ContentConfigStore,
} from "./config-store";
import { createContentCursorOverlay, type ContentCursorOverlay } from "./cursor-overlay";
import { createContentDiagnostics } from "./diagnostics";
import {
  createContentTriggerHandlers,
  type ContentTriggerHandlers,
  type ContentTriggerState,
} from "./trigger-handlers";

export const CONTENT_RUNTIME_CONSTANTS = Object.freeze({
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
});

interface StorageChange {
  oldValue?: unknown;
  newValue?: unknown;
}

interface ContentChrome {
  storage?: {
    local?: {
      get(keys: string[]): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
    session?: {
      get(keys: string[]): Promise<Record<string, unknown>>;
    };
    onChanged?: {
      addListener(listener: (changes: Record<string, StorageChange>, areaName: string) => void): void;
      removeListener?(listener: (changes: Record<string, StorageChange>, areaName: string) => void): void;
    };
  };
  runtime?: {
    onMessage?: {
      addListener(listener: RuntimeMessageListener): void;
      removeListener?(listener: RuntimeMessageListener): void;
    };
  };
}

type RuntimeMessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response?: unknown) => void,
) => boolean;

interface ContentRuntimeState extends ContentTriggerState, ContentAudioState, CursorOverlayRenderState {
  config: ContentConfig | null;
  ready: boolean;
  activeEffects: number;
}

const contentRuntimeFactories = {
  createDiagnostics: createContentDiagnostics,
  createConfigStore: createContentConfigStore,
  createVisualEffects,
  createAudioRuntime: createContentAudioRuntime,
  createCursorOverlay: createContentCursorOverlay,
  createTriggerHandlers: createContentTriggerHandlers,
  createAtmosphere: createContentAtmosphere,
};

type ContentRuntimeFactories = typeof contentRuntimeFactories;

export interface ContentRuntimeOptions {
  window?: Window;
  document?: Document;
  chrome?: ContentChrome | null;
  defaultConfig?: ContentConfig;
  runtimeConfig?: {
    normalizeConfig?(value: unknown, fallback: ContentConfig): ContentConfig;
  };
  factories?: Partial<ContentRuntimeFactories>;
}

export interface ContentRuntime {
  readonly ready: Promise<void>;
  readonly state: Readonly<ContentRuntimeState>;
  destroy(): void;
}

interface RuntimeErrorEntry {
  type: string;
  detail: string;
  host: string;
  at: string;
}

function createRuntimeErrorReporter(
  platformWindow: Window,
  chrome: ContentChrome | null,
): { report(type: string, detail: unknown): void; destroy(): void } {
  const maxErrors = 10;
  let writeTimer: number | null = null;
  let pendingErrors: RuntimeErrorEntry[] = [];

  function report(type: string, detail: unknown): void {
    if (!chrome?.storage?.local) return;
    pendingErrors.push({
      type,
      detail: typeof detail === "string"
        ? detail
        : ((detail as { message?: string } | null)?.message || JSON.stringify(detail || {})),
      host: platformWindow.location.host || "",
      at: new Date().toISOString(),
    });
    if (pendingErrors.length > maxErrors + 5) pendingErrors = pendingErrors.slice(-maxErrors);
    if (writeTimer !== null) return;
    writeTimer = platformWindow.setTimeout(() => {
      writeTimer = null;
      const batch = pendingErrors.slice(-maxErrors);
      pendingErrors = [];
      try {
        void chrome.storage?.local
          ?.set({ [CONTENT_RUNTIME_CONSTANTS.RUNTIME_ERRORS_STORAGE_KEY]: batch })
          .catch(() => undefined);
      } catch {
        // Runtime errors must never interrupt page input handling.
      }
    }, 500);
  }

  function destroy(): void {
    if (writeTimer !== null) platformWindow.clearTimeout(writeTimer);
    writeTimer = null;
    pendingErrors = [];
  }

  return { report, destroy };
}

function createInitialState(): ContentRuntimeState {
  return {
    config: null,
    ready: false,
    lastTriggerAtByAction: Object.create(null) as Record<string, number>,
    actionRunCounts: Object.create(null) as Record<string, number>,
    actionComboStates: Object.create(null) as Record<string, { count: number; lastAt: number }>,
    lastSoundAtByAction: Object.create(null) as Record<string, number>,
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
}

export function startContentRuntime(options: ContentRuntimeOptions = {}): ContentRuntime {
  const platformWindow = options.window || window;
  const browserWindow = platformWindow as Window & {
    BroadcastChannel?: typeof BroadcastChannel;
  };
  const platformDocument = options.document || platformWindow.document;
  const runtimeGlobal = globalThis as typeof globalThis & { chrome?: ContentChrome };
  const chrome = options.chrome === undefined ? (runtimeGlobal.chrome || null) : options.chrome;
  const defaultConfig = options.defaultConfig || canonicalDefaultConfig;
  const runtimeConfig = options.runtimeConfig || { normalizeConfig: normalizeCanonicalConfig };

  const factories = { ...contentRuntimeFactories, ...options.factories };
  const state = createInitialState();
  const errorReporter = createRuntimeErrorReporter(platformWindow, chrome);
  const reportRuntimeError = errorReporter.report;
  const runtime = {
    window: platformWindow,
    document: platformDocument,
    chrome,
    defaultConfig,
    runtimeConfig,
    constants: CONTENT_RUNTIME_CONSTANTS,
    state,
  };

  const diagnostics = factories.createDiagnostics(runtime);
  const configStore: ContentConfigStore = factories.createConfigStore({
    ...runtime,
    diagnostics,
    reportRuntimeError,
  });
  state.config = configStore.normalizeConfig(defaultConfig);

  const visualEffects: VisualEffectsModule = factories.createVisualEffects({
    ...runtime,
    configStore,
  });
  const audioRuntime = factories.createAudioRuntime({
    ...runtime,
    diagnostics,
    configStore,
    reportRuntimeError,
  });
  const cursorOverlay: ContentCursorOverlay = factories.createCursorOverlay({
    ...runtime,
    configStore,
    visualEffects,
  });
  const triggerHandlers: ContentTriggerHandlers = factories.createTriggerHandlers({
    ...runtime,
    diagnostics,
    configStore,
    visualEffects,
    audioRuntime,
    cursorOverlay,
  });
  const atmosphere: ContentAtmosphere = factories.createAtmosphere({
    ...runtime,
    diagnostics,
  });

  let destroyed = false;
  let localPreviewChannel: BroadcastChannel | null = null;
  const cleanupCallbacks: Array<() => void> = [];

  function syncAtmosphere(): void {
    if (destroyed) return;
    try {
      const scheme = configStore.getActiveScheme();
      atmosphere.syncConfig(configStore.getAtmosphereConfig(scheme));
    } catch (error) {
      reportRuntimeError("atmosphere-sync", error);
    }
  }

  visualEffects.ensureRoot();
  diagnostics.log("runtime.ready", {
    diagnosticsStorageKey: diagnostics.STORAGE_KEY,
    activeThemeId: state.config?.activeThemeId || defaultConfig.activeThemeId || null,
    host: platformWindow.location.host || null,
    localPreviewHost: configStore.isLocalPreviewHost(),
  });

  configStore.setOnSyncComplete(() => {
    if (state.ready) syncAtmosphere();
  });
  const ready = configStore.syncConfigFromStorage({
    clearStateCursorOverlay: cursorOverlay.clearStateCursorOverlay,
  }).finally(() => {
    if (destroyed) return;
    state.ready = true;
    syncAtmosphere();
  });

  if (configStore.isLocalPreviewHost()) {
    const handleLocalStorage = (event: StorageEvent): void => {
      if (
        event.key !== CONTENT_RUNTIME_CONSTANTS.CONFIG_STORAGE_KEY
        && event.key !== CONTENT_RUNTIME_CONSTANTS.LIVE_PREVIEW_CONFIG_STORAGE_KEY
      ) return;
      configStore.debouncedSyncConfigFromStorage({
        clearStateCursorOverlay: cursorOverlay.clearStateCursorOverlay,
      });
    };
    platformWindow.addEventListener("storage", handleLocalStorage);
    cleanupCallbacks.push(() => platformWindow.removeEventListener("storage", handleLocalStorage));

    try {
      if (typeof browserWindow.BroadcastChannel === "function") {
        localPreviewChannel = new browserWindow.BroadcastChannel(
          CONTENT_RUNTIME_CONSTANTS.LOCAL_PREVIEW_CHANNEL_NAME,
        );
        localPreviewChannel.addEventListener("message", (event) => {
          const message = (event.data || {}) as Record<string, unknown>;
          if (message.type === "config-updated") {
            configStore.setConfig(message.config || defaultConfig);
            cursorOverlay.clearStateCursorOverlay();
            syncAtmosphere();
          } else if (message.type === "preview-theme") {
            triggerHandlers.previewAtViewportCenter(
              message.themeId as string | undefined,
              message.themePack,
              message.actionId as string | undefined,
            );
          }
        });
      }
    } catch (error) {
      reportRuntimeError("local-preview-channel", error);
    }
  }

  const handleStorageChange = (changes: Record<string, StorageChange>, areaName: string): void => {
    if (areaName !== "local") return;
    const changedKeys = Object.keys(changes);
    if (
      changedKeys.includes(CONTENT_RUNTIME_CONSTANTS.CONFIG_STORAGE_KEY)
      || changedKeys.includes(CONTENT_RUNTIME_CONSTANTS.LIVE_PREVIEW_CONFIG_STORAGE_KEY)
      || changedKeys.some((key) => key.startsWith(CONTENT_RUNTIME_CONSTANTS.CURSOR_ASSET_STORAGE_KEY_PREFIX))
    ) {
      configStore.debouncedSyncConfigFromStorage({
        clearStateCursorOverlay: cursorOverlay.clearStateCursorOverlay,
      });
    }
  };
  try {
    if (!chrome?.storage?.onChanged) throw new Error("chrome.storage.onChanged unavailable");
    chrome.storage.onChanged.addListener(handleStorageChange);
    cleanupCallbacks.push(() => chrome.storage?.onChanged?.removeListener?.(handleStorageChange));
  } catch {
    reportRuntimeError("storage-listener", "chrome.storage.onChanged unavailable; live config sync disabled.");
    configStore.setConfig(state.config);
  }

  const handleRuntimeMessage: RuntimeMessageListener = (message, _sender, sendResponse) => {
    const value = message as Record<string, unknown> | null;
    if (value?.type === "CURSORDANCE_PREVIEW_SCHEME") {
      triggerHandlers.previewAtViewportCenter(
        value.schemeId as string | undefined,
        value.scheme,
        value.actionId as string | undefined,
      );
      sendResponse({ ok: true });
    }
    return false;
  };
  try {
    if (!chrome?.runtime?.onMessage) throw new Error("chrome.runtime.onMessage unavailable");
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    cleanupCallbacks.push(() => chrome.runtime?.onMessage?.removeListener?.(handleRuntimeMessage));
  } catch {
    reportRuntimeError("messaging", "chrome.runtime.onMessage unavailable; preview trigger disabled.");
  }

  platformDocument.addEventListener("pointerdown", triggerHandlers.handleLeftPointerDown, true);
  platformDocument.addEventListener("pointerdown", triggerHandlers.handleRightPointerDown, true);
  platformDocument.addEventListener("pointermove", cursorOverlay.syncStateCursorOverlay, { capture: true, passive: true });
  platformDocument.addEventListener("pointerup", triggerHandlers.handlePointerUp, true);
  platformDocument.addEventListener("pointercancel", triggerHandlers.handlePointerCancel, true);
  platformDocument.addEventListener("contextmenu", triggerHandlers.handleContextMenu, true);
  platformDocument.addEventListener("wheel", triggerHandlers.handleWheel, { capture: true, passive: true });
  platformDocument.addEventListener("pointerover", triggerHandlers.handlePointerOver, true);
  platformDocument.addEventListener("pointerout", triggerHandlers.handlePointerOut, true);
  platformWindow.addEventListener("blur", cursorOverlay.clearStateCursorOverlay);

  cleanupCallbacks.push(
    () => platformDocument.removeEventListener("pointerdown", triggerHandlers.handleLeftPointerDown, true),
    () => platformDocument.removeEventListener("pointerdown", triggerHandlers.handleRightPointerDown, true),
    () => platformDocument.removeEventListener("pointermove", cursorOverlay.syncStateCursorOverlay, true),
    () => platformDocument.removeEventListener("pointerup", triggerHandlers.handlePointerUp, true),
    () => platformDocument.removeEventListener("pointercancel", triggerHandlers.handlePointerCancel, true),
    () => platformDocument.removeEventListener("contextmenu", triggerHandlers.handleContextMenu, true),
    () => platformDocument.removeEventListener("wheel", triggerHandlers.handleWheel, true),
    () => platformDocument.removeEventListener("pointerover", triggerHandlers.handlePointerOver, true),
    () => platformDocument.removeEventListener("pointerout", triggerHandlers.handlePointerOut, true),
    () => platformWindow.removeEventListener("blur", cursorOverlay.clearStateCursorOverlay),
  );

  return {
    ready,
    state,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      state.ready = false;
      configStore.destroy();
      for (const cleanup of cleanupCallbacks.splice(0)) cleanup();
      localPreviewChannel?.close();
      localPreviewChannel = null;
      if (state.hoverTimeoutId !== null) platformWindow.clearTimeout(state.hoverTimeoutId);
      if (state.longPressState?.timeoutId !== undefined) {
        platformWindow.clearTimeout(state.longPressState.timeoutId as number);
      }
      atmosphere.destroy();
      cursorOverlay.clearStateCursorOverlay();
      visualEffects.clearEffects();
      platformDocument.getElementById(CONTENT_RUNTIME_CONSTANTS.ROOT_ID)?.remove();
      platformDocument.getElementById(CONTENT_RUNTIME_CONSTANTS.STYLE_ID)?.remove();
      errorReporter.destroy();
    },
  };
}
