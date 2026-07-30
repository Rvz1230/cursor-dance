export interface DiagnosticEntry extends Record<string, unknown> {
  scope: string;
  at: string;
  href: string;
}

export interface DiagnosticsDeps {
  window: Window;
  initialEnabled?: boolean;
  onExternalToggle?: (toggle: (enabled: unknown) => void) => void;
  onEvent?: (entry: DiagnosticEntry, events: readonly DiagnosticEntry[]) => void;
}

export interface DiagnosticsApi {
  EVENT_NAME: string;
  STORAGE_KEY: string;
  isEnabled(): boolean;
  log(scope: string, payload?: Record<string, unknown>): void;
  describeTarget(target: unknown): Record<string, unknown>;
  describeMedia(media: unknown): Record<string, unknown>;
  getEvents(): DiagnosticEntry[];
}

const STORAGE_KEY = "cursordance.debug";
const EVENT_NAME = "cursordance:diagnostic";
const CHANNEL_NAME = "cursordance.local-preview";
const CHANNEL_MESSAGE_TYPE = "diagnostic-event";
const MAX_EVENTS = 200;

function parseBooleanFlag(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== "string") return false;
  return ["1", "true", "on", "yes", "debug"].includes(value.trim().toLowerCase());
}

function canUseWindowStorage(storage: Storage): boolean {
  try {
    const probeKey = "__cursordance_debug_probe__";
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

function normalizeClassName(className: unknown): string {
  if (typeof className === "string") return className.trim();
  if (typeof (className as { baseVal?: string })?.baseVal === "string") {
    return (className as { baseVal: string }).baseVal.trim();
  }
  return "";
}

export function createDiagnostics(deps: DiagnosticsDeps): DiagnosticsApi {
  const { window, initialEnabled, onExternalToggle, onEvent } = deps;
  const platformWindow = window as Window & {
    BroadcastChannel?: typeof BroadcastChannel;
    CustomEvent?: typeof CustomEvent;
    Element?: typeof Element;
  };
  const eventBuffer: DiagnosticEntry[] = [];
  let diagnosticsChannel: BroadcastChannel | null = null;
  let debugEnabled = false;

  function readStorageFlag(): boolean {
    try {
      const storage = window.localStorage;
      if (!canUseWindowStorage(storage)) return false;
      return parseBooleanFlag(storage.getItem(STORAGE_KEY));
    } catch {
      return false;
    }
  }

  function readQueryFlag(): boolean {
    try {
      const url = new URL(window.location.href);
      return parseBooleanFlag(url.searchParams.get("cursordance-debug"));
    } catch {
      return false;
    }
  }

  function computeSyncEnabled(): boolean {
    const debugWindow = window as Window & { __CURSORDANCE_DEBUG__?: unknown };
    return Boolean(debugWindow.__CURSORDANCE_DEBUG__ || readQueryFlag() || readStorageFlag());
  }

  function setEnabled(value: unknown): void {
    debugEnabled = parseBooleanFlag(value);
  }

  debugEnabled = typeof initialEnabled === "boolean" ? initialEnabled : computeSyncEnabled();
  onExternalToggle?.(setEnabled);

  const BroadcastChannelCtor = platformWindow.BroadcastChannel;
  if (typeof BroadcastChannelCtor === "function") {
    try {
      const debugChannel = new BroadcastChannelCtor(CHANNEL_NAME);
      debugChannel.addEventListener("message", (event) => {
        const message = (event.data || {}) as { type?: string; enabled?: unknown };
        if (message.type === "toggle-debug") setEnabled(message.enabled);
      });
    } catch {
      // BroadcastChannel is optional in constrained or sandboxed runtimes.
    }
  }

  function isEnabled(): boolean {
    return debugEnabled;
  }

  function describeTarget(target: unknown): Record<string, unknown> {
    const ElementCtor = platformWindow.Element;
    if (!ElementCtor || !(target instanceof ElementCtor)) {
      return { type: target == null ? "null" : typeof target };
    }
    const classes = normalizeClassName(target.className)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3);
    return {
      selector: `${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ""}${classes.map((name) => `.${name}`).join("")}`,
      role: target.getAttribute("role") || null,
      text: target.textContent?.trim()?.slice(0, 48) || null,
    };
  }

  function describeMedia(media: unknown): Record<string, unknown> {
    const value = media as {
      paused?: unknown;
      muted?: unknown;
      volume?: number;
      readyState?: number;
      currentSrc?: string;
      src?: string;
    } | null;
    return {
      target: describeTarget(media),
      paused: Boolean(value?.paused),
      muted: Boolean(value?.muted),
      volume: typeof value?.volume === "number" ? Number(value.volume.toFixed(3)) : null,
      readyState: Number.isFinite(value?.readyState) ? value?.readyState : null,
      currentSrc: value?.currentSrc || value?.src || null,
    };
  }

  function log(scope: string, payload: Record<string, unknown> = {}): void {
    if (!isEnabled()) return;
    const entry: DiagnosticEntry = {
      scope,
      at: new Date().toISOString(),
      href: window.location.href,
      ...payload,
    };
    eventBuffer.push(entry);
    if (eventBuffer.length > MAX_EVENTS) eventBuffer.shift();

    try {
      console.info(`[CursorDance][${scope}]`, entry);
    } catch {
      // Console logging is best effort.
    }

    try {
      const CustomEventCtor = platformWindow.CustomEvent;
      if (typeof CustomEventCtor === "function") {
        window.dispatchEvent(new CustomEventCtor(EVENT_NAME, { detail: entry }));
      }
    } catch {
      // The DOM event bridge is optional.
    }

    try {
      if (typeof BroadcastChannelCtor === "function") {
        diagnosticsChannel ??= new BroadcastChannelCtor(CHANNEL_NAME);
        diagnosticsChannel.postMessage({ type: CHANNEL_MESSAGE_TYPE, entry });
      }
    } catch {
      // The cross-context diagnostics bridge is optional.
    }

    try {
      onEvent?.(entry, eventBuffer);
    } catch {
      // Diagnostics sinks must never affect the input/effect pipeline.
    }
  }

  return {
    EVENT_NAME,
    STORAGE_KEY,
    isEnabled,
    log,
    describeTarget,
    describeMedia,
    getEvents: () => eventBuffer.slice(),
  };
}
