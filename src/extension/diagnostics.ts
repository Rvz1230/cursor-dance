import {
  createDiagnostics,
  type DiagnosticEntry,
  type DiagnosticsApi,
} from "@/shared/effect-runtime/diagnostics";

interface ChromeStorageChange {
  newValue?: unknown;
}

interface ContentChromeStorage {
  local: {
    get(keys: string[]): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
  };
  onChanged?: {
    addListener(listener: (
      changes: Record<string, ChromeStorageChange>,
      areaName: string,
    ) => void): void;
  };
}

export interface ContentDiagnosticsRuntime {
  window: Window;
  chrome?: { storage?: ContentChromeStorage } | null;
}

const DIAGNOSTIC_EVENTS_STORAGE_KEY = "cursordance.diagnosticEvents";
const STORAGE_FLUSH_MS = 300;

export function createContentDiagnostics(runtime: ContentDiagnosticsRuntime): DiagnosticsApi {
  const chromeStorage = runtime.chrome?.storage;
  let storageFlushTimer: number | null = null;
  let pendingEvents: readonly DiagnosticEntry[] = [];

  function scheduleStorageFlush(events: readonly DiagnosticEntry[]): void {
    if (!chromeStorage?.local) return;
    pendingEvents = events;
    if (storageFlushTimer !== null) return;
    storageFlushTimer = runtime.window.setTimeout(() => {
      storageFlushTimer = null;
      const snapshot = pendingEvents.slice();
      void chromeStorage.local
        .set({ [DIAGNOSTIC_EVENTS_STORAGE_KEY]: snapshot })
        .catch(() => undefined);
    }, STORAGE_FLUSH_MS);
  }

  return createDiagnostics({
    window: runtime.window,
    onExternalToggle(setEnabled) {
      const storageKey = "cursordance.debug";
      chromeStorage?.onChanged?.addListener((changes, areaName) => {
        if (areaName !== "local" || !(storageKey in changes)) return;
        setEnabled(changes[storageKey].newValue);
      });
      void chromeStorage?.local
        .get([storageKey])
        .then((result) => {
          if (storageKey in result) setEnabled(result[storageKey]);
        })
        .catch(() => undefined);
    },
    onEvent(_entry, events) {
      scheduleStorageFlush(events);
    },
  });
}

const runtimeGlobal = globalThis as typeof globalThis & {
  CursorDanceContentModules?: Record<string, unknown>;
};
runtimeGlobal.CursorDanceContentModules ||= {};
runtimeGlobal.CursorDanceContentModules.createDiagnostics = createContentDiagnostics;
