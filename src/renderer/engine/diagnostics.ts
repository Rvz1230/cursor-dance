// CursorDance 诊断日志
//
// 从 public/content-runtime/diagnostics.js 迁移而来（任务 2.5）。
// 关键调整：
//   - 去 IIFE，改为 export function createDiagnostics(deps)。
//   - 移除 chrome.storage.onChanged / chrome.storage.local 桥（桌面端通过
//     IPC + electron-store 同步开关；调用方直接设置 deps.initialEnabled）。
//   - 保留 BroadcastChannel 桥：本地预览页面（landing / e2e）继续用它切换 debug。
//   - 保留 query 串 / localStorage / __CURSORDANCE_DEBUG__ 三种读取方式。
//   - 事件入栈、CustomEvent 派发、console.info 字节级保留。
//   - describeMedia 桌面端用不到（无页面媒体），但保留导出，避免破坏扩展端
//     由共用引擎调用此模块的潜在场景。

import type { DiagnosticsModule } from "./types";

export interface DiagnosticsDeps {
  window: Window;
  /** 初始 debug 开关。扩展端可注入 chrome.storage 读出的值；桌面端可注入 electron-store 读出的值。 */
  initialEnabled?: boolean;
  /** 上层 chrome.storage / electron-store 任一回写时调用，将覆盖 _debugEnabled。 */
  onExternalToggle?: (toggle: (enabled: boolean) => void) => void;
}

export interface DiagnosticsApi extends DiagnosticsModule {
  EVENT_NAME: string;
  STORAGE_KEY: string;
  describeMedia(media: unknown): Record<string, unknown>;
  getEvents(): Record<string, unknown>[];
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

export function createDiagnostics(deps: DiagnosticsDeps): DiagnosticsApi {
  const { window, initialEnabled, onExternalToggle } = deps;
  const eventBuffer: Record<string, unknown>[] = [];
  let diagnosticsChannel: BroadcastChannel | null = null;
  let _debugEnabled = false;

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
    return Boolean(
      (window as unknown as { __CURSORDANCE_DEBUG__?: unknown }).__CURSORDANCE_DEBUG__
        || readQueryFlag()
        || readStorageFlag(),
    );
  }

  // 同步初值：先看本地源，再让外部 toggle 可覆盖。
  _debugEnabled = typeof initialEnabled === "boolean" ? initialEnabled : computeSyncEnabled();

  // 外部桥（扩展端：chrome.storage.onChanged；桌面端：IPC 主进程回推）。
  onExternalToggle?.((enabled) => {
    _debugEnabled = parseBooleanFlag(enabled);
  });

  // BroadcastChannel 桥 —— 本地预览继续可用。
  const BC = (window as unknown as { BroadcastChannel?: typeof BroadcastChannel }).BroadcastChannel;
  if (typeof BC === "function") {
    try {
      const debugChannel = new BC(CHANNEL_NAME);
      debugChannel.addEventListener("message", (event: MessageEvent) => {
        const message = (event.data || {}) as { type?: string; enabled?: unknown };
        if (message.type === "toggle-debug") {
          _debugEnabled = parseBooleanFlag(message.enabled);
        }
      });
    } catch {
      // Ignore BroadcastChannel setup failures.
    }
  }

  function isEnabled(): boolean {
    return _debugEnabled;
  }

  function normalizeClassName(className: unknown): string {
    if (typeof className === "string") return className.trim();
    if (typeof (className as { baseVal?: string })?.baseVal === "string") {
      return (className as { baseVal: string }).baseVal.trim();
    }
    return "";
  }

  function describeTarget(target: unknown): Record<string, unknown> {
    if (!(target instanceof Element)) {
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
    const m = media as { paused?: unknown; muted?: unknown; volume?: number; readyState?: number; currentSrc?: string; src?: string };
    return {
      target: describeTarget(media),
      paused: Boolean(m?.paused),
      muted: Boolean(m?.muted),
      volume: typeof m?.volume === "number" ? Number(m.volume.toFixed(3)) : null,
      readyState: Number.isFinite(m?.readyState) ? m.readyState : null,
      currentSrc: m?.currentSrc || m?.src || null,
    };
  }

  function log(scope: string, payload: Record<string, unknown> = {}): void {
    if (!isEnabled()) return;
    const entry = {
      scope,
      at: new Date().toISOString(),
      href: window.location.href,
      ...payload,
    };

    eventBuffer.push(entry);
    if (eventBuffer.length > MAX_EVENTS) {
      eventBuffer.shift();
    }

    try {
      console.info(`[CursorDance][${scope}]`, entry);
    } catch {
      // Ignore console failures in constrained runtimes.
    }

    try {
      const CE = (window as unknown as { CustomEvent?: typeof CustomEvent }).CustomEvent;
      if (typeof CE === "function") {
        window.dispatchEvent(new CE(EVENT_NAME, { detail: entry }));
      }
    } catch {
      // Ignore DOM event bridge failures.
    }

    try {
      const BCLog = (window as unknown as { BroadcastChannel?: typeof BroadcastChannel }).BroadcastChannel;
      if (typeof BCLog === "function") {
        diagnosticsChannel ??= new BCLog(CHANNEL_NAME);
        diagnosticsChannel.postMessage({
          type: CHANNEL_MESSAGE_TYPE,
          entry,
        });
      }
    } catch {
      // Ignore diagnostics bridge failures.
    }
  }

  return {
    EVENT_NAME,
    STORAGE_KEY,
    isEnabled,
    log,
    describeTarget,
    describeMedia,
    getEvents() {
      return eventBuffer.slice();
    },
  };
}
