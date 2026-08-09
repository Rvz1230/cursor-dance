import { describe, expect, it, vi } from "vitest";
import {
  CONTENT_RUNTIME_CONSTANTS,
  startContentRuntime,
  type ContentRuntimeOptions,
} from "./content-runtime";

const config = {
  schemaVersion: 4,
  enabled: true,
  activeThemeId: "mono-geo",
  themes: [{
    id: "mono-geo",
    actionConfigs: {},
    cursorBindings: {},
    cursorSkin: { states: {} },
    atmosphere: { mode: "none" },
  }],
  contextRules: [],
  performance: { maxActiveEffects: 48 },
};

function createFixture() {
  const documentListeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const windowListeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const addListener = (
    listeners: Map<string, Set<EventListenerOrEventListenerObject>>,
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) => {
    const entries = listeners.get(type) || new Set();
    entries.add(listener);
    listeners.set(type, entries);
  };
  const removeListener = (
    listeners: Map<string, Set<EventListenerOrEventListenerObject>>,
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) => listeners.get(type)?.delete(listener);

  const document = {
    addEventListener: vi.fn((type, listener) => addListener(documentListeners, type, listener)),
    removeEventListener: vi.fn((type, listener) => removeListener(documentListeners, type, listener)),
    getElementById: vi.fn(() => null),
  } as unknown as Document;
  const window = {
    document,
    location: { host: "example.com", hostname: "example.com", href: "https://example.com/" },
    setTimeout,
    clearTimeout,
    addEventListener: vi.fn((type, listener) => addListener(windowListeners, type, listener)),
    removeEventListener: vi.fn((type, listener) => removeListener(windowListeners, type, listener)),
  } as unknown as Window;

  let storageListener: ((changes: Record<string, unknown>, areaName: string) => void) | undefined;
  let messageListener: ((message: unknown, sender: unknown, respond: (response: unknown) => void) => boolean) | undefined;
  const removeStorageListener = vi.fn();
  const removeMessageListener = vi.fn();
  const chrome = {
    storage: {
      local: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => undefined),
      },
      session: { get: vi.fn(async () => ({})) },
      onChanged: {
        addListener: vi.fn((listener) => { storageListener = listener; }),
        removeListener: removeStorageListener,
      },
    },
    runtime: {
      onMessage: {
        addListener: vi.fn((listener) => { messageListener = listener; }),
        removeListener: removeMessageListener,
      },
    },
  };

  const clearStateCursorOverlay = vi.fn();
  const syncAtmosphere = vi.fn();
  const destroyAtmosphere = vi.fn();
  const syncCursorTrail = vi.fn();
  const pressCursorTrail = vi.fn();
  const setCursorTrailStateColor = vi.fn();
  const destroyCursorTrail = vi.fn();
  const clearEffects = vi.fn();
  const debounceConfigSync = vi.fn();
  const previewAtViewportCenter = vi.fn();
  const resetTriggerHandlers = vi.fn();
  let onSyncComplete: (() => void) | null = null;
  const destroyConfigStore = vi.fn(() => { onSyncComplete = null; });
  const configStore = {
    normalizeConfig: vi.fn(() => config),
    setConfig: vi.fn(() => config),
    getConfig: vi.fn(() => config),
    isLocalPreviewHost: vi.fn(() => false),
    isCurrentSiteEnabled: vi.fn(() => true),
    getActiveTheme: vi.fn(() => config.themes[0]),
    getActionConfig: vi.fn(() => ({ cursorGlowColor: "#22C55E" })),
    getActionCursorFeedbackConfig: vi.fn((value) => value || {}),
    getCursorStateBinding: vi.fn((_theme, cursorStateId) => ({ cursorStateId, actionId: "leftClick", inheritedFromDefault: false })),
    getAtmosphereConfig: vi.fn(() => ({ mode: "none" })),
    setOnSyncComplete: vi.fn((callback) => { onSyncComplete = callback; }),
    syncConfigFromStorage: vi.fn(async ({ clearStateCursorOverlay: clear }) => { clear(); }),
    debouncedSyncConfigFromStorage: debounceConfigSync,
    destroy: destroyConfigStore,
  };
  const triggerHandlers = {
    handleLeftPointerDown: vi.fn(),
    handleRightPointerDown: vi.fn(),
    handlePointerUp: vi.fn(),
    handlePointerCancel: vi.fn(),
    handleContextMenu: vi.fn(),
    handleWheel: vi.fn(),
    handlePointerOver: vi.fn(),
    handlePointerOut: vi.fn(),
    previewAtViewportCenter,
    reset: resetTriggerHandlers,
  };
  const factories = {
    createDiagnostics: vi.fn(() => ({
      STORAGE_KEY: "cursordance.debug",
      EVENT_NAME: "cursordance:diagnostic",
      isEnabled: () => false,
      log: vi.fn(),
      describeTarget: vi.fn(),
      describeMedia: vi.fn(),
      getEvents: () => [],
    })),
    createConfigStore: vi.fn(() => configStore),
    createVisualEffects: vi.fn(() => ({
      ensureRoot: vi.fn(),
      clearEffects,
    })),
    createAudioRuntime: vi.fn(() => ({ playSound: vi.fn() })),
    createCursorOverlay: vi.fn(() => ({
      syncStateCursorOverlay: vi.fn(() => "pointer"),
      clearStateCursorOverlay,
    })),
    createTriggerHandlers: vi.fn(() => triggerHandlers),
    createAtmosphere: vi.fn(() => ({ syncConfig: syncAtmosphere, destroy: destroyAtmosphere })),
    createCursorTrail: vi.fn(() => ({
      syncConfig: syncCursorTrail,
      setStateColor: setCursorTrailStateColor,
      move: vi.fn(),
      press: pressCursorTrail,
      leave: vi.fn(),
      clear: vi.fn(),
      destroy: destroyCursorTrail,
    })),
  } as unknown as NonNullable<ContentRuntimeOptions["factories"]>;

  return {
    options: { window, document, chrome, defaultConfig: config, factories } as unknown as ContentRuntimeOptions,
    documentListeners,
    windowListeners,
    getStorageListener: () => storageListener,
    getMessageListener: () => messageListener,
    removeStorageListener,
    removeMessageListener,
    clearStateCursorOverlay,
    syncAtmosphere,
    destroyAtmosphere,
    syncCursorTrail,
    pressCursorTrail,
    setCursorTrailStateColor,
    destroyCursorTrail,
    clearEffects,
    debounceConfigSync,
    destroyConfigStore,
    previewAtViewportCenter,
    resetTriggerHandlers,
    getOnSyncComplete: () => onSyncComplete,
  };
}

describe("extension content runtime assembly", () => {
  it("wires direct adapters, synchronizes config, and releases listeners", async () => {
    const fixture = createFixture();
    const runtime = startContentRuntime(fixture.options);

    expect(fixture.documentListeners.get("pointerdown")?.size).toBe(2);
    expect(fixture.windowListeners.get("blur")?.size).toBe(1);

    await runtime.ready;
    expect(runtime.state.ready).toBe(true);
    expect(fixture.clearStateCursorOverlay).toHaveBeenCalledTimes(1);
    expect(fixture.syncAtmosphere).toHaveBeenCalledWith({ mode: "none" });
    expect(fixture.syncCursorTrail).toHaveBeenCalledWith(undefined);
    for (const listener of fixture.documentListeners.get("pointerdown") ?? []) {
      if (typeof listener === "function") listener({ button: 0, clientX: 48, clientY: 72 } as PointerEvent);
    }
    expect(fixture.pressCursorTrail).toHaveBeenCalledWith();
    for (const listener of fixture.documentListeners.get("pointermove") ?? []) {
      if (typeof listener === "function") listener({ clientX: 64, clientY: 96, target: null } as PointerEvent);
    }
    expect(fixture.setCursorTrailStateColor).toHaveBeenCalledWith("#22C55E");

    fixture.getStorageListener()?.({
      [CONTENT_RUNTIME_CONSTANTS.CONFIG_STORAGE_KEY]: {},
    }, "local");
    expect(fixture.debounceConfigSync).toHaveBeenCalledTimes(1);
    fixture.getStorageListener()?.({
      [CONTENT_RUNTIME_CONSTANTS.LIVE_PREVIEW_CONFIG_STORAGE_KEY]: {},
    }, "session");
    expect(fixture.debounceConfigSync).toHaveBeenCalledTimes(2);

    fixture.getOnSyncComplete()?.();
    expect(fixture.resetTriggerHandlers).toHaveBeenCalledTimes(1);

    const respond = vi.fn();
    fixture.getMessageListener()?.({
      type: "CURSORDANCE_PREVIEW_THEME",
      themeId: "mono-geo",
      actionId: "leftClick",
    }, {}, respond);
    expect(fixture.previewAtViewportCenter).toHaveBeenCalledWith("mono-geo", undefined, "leftClick");
    expect(respond).toHaveBeenCalledWith({ ok: true });

    runtime.destroy();
    runtime.destroy();
    expect(runtime.state.ready).toBe(false);
    expect(fixture.documentListeners.get("pointerdown")?.size).toBe(0);
    expect(fixture.windowListeners.get("blur")?.size).toBe(0);
    expect(fixture.removeStorageListener).toHaveBeenCalledTimes(1);
    expect(fixture.removeMessageListener).toHaveBeenCalledTimes(1);
    expect(fixture.destroyConfigStore).toHaveBeenCalledTimes(1);
    expect(fixture.resetTriggerHandlers).toHaveBeenCalledTimes(2);
    expect(fixture.getOnSyncComplete()).toBeNull();
    expect(fixture.destroyAtmosphere).toHaveBeenCalledTimes(1);
    expect(fixture.destroyCursorTrail).toHaveBeenCalledTimes(1);
    expect(fixture.clearEffects).toHaveBeenCalledTimes(1);
  });
});
