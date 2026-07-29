import {
  DIAGNOSTIC_DEBUG_KEY,
  DIAGNOSTIC_EVENT_MESSAGE_TYPE,
  LOCAL_PREVIEW_CHANNEL_NAME,
  MAX_RECENT_CURSOR_ASSETS,
  RECENT_CURSOR_ASSETS_STORAGE_KEY,
  canUseLocalStorage,
  postLocalPreviewMessage,
} from "../chrome-api";
import type {
  RecentCursorAsset,
  RepositoryListener,
  RuntimeDiagnosticEntry,
  WorkbenchRepository,
} from "./types";
import { notifyRepositoryListener } from "./types";

type RepositorySupport = Pick<WorkbenchRepository,
  | "recentAssetsPersistence"
  | "readRecentCursorAssets"
  | "writeRecentCursorAsset"
  | "readRuntimeErrors"
  | "clearRuntimeErrors"
  | "readDiagnosticDebugFlag"
  | "writeDiagnosticDebugFlag"
  | "readRuntimeDiagnostics"
  | "subscribeRuntimeDiagnostics"
>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function normalizeRecentAsset(value: unknown): RecentCursorAsset | null {
  const record = asRecord(value);
  if (!record || typeof record.imageDataUrl !== "string" || !record.imageDataUrl) return null;
  return {
    ...record,
    id: typeof record.id === "string" && record.id ? record.id : `recent-${Date.now()}`,
    imageDataUrl: record.imageDataUrl,
    name: typeof record.name === "string" && record.name ? record.name : "未命名素材",
    mimeType: typeof record.mimeType === "string" ? record.mimeType : "image/png",
    hotspotX: typeof record.hotspotX === "number" ? record.hotspotX : 16,
    hotspotY: typeof record.hotspotY === "number" ? record.hotspotY : 32,
    size: typeof record.size === "number" ? record.size : 48,
    updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : Date.now(),
  };
}

export function dedupeRecentAssets(current: RecentCursorAsset[], value: unknown): RecentCursorAsset[] {
  const next = normalizeRecentAsset(value);
  if (!next) return current;
  return [next, ...current.filter((item) => item.imageDataUrl !== next.imageDataUrl)]
    .slice(0, MAX_RECENT_CURSOR_ASSETS);
}

function subscribeBroadcastDiagnostics(onChange: RepositoryListener<RuntimeDiagnosticEntry>): () => void {
  if (typeof window === "undefined" || typeof window.BroadcastChannel !== "function") return () => {};
  const seenKeys = new Set<string>();
  const channel = new window.BroadcastChannel(LOCAL_PREVIEW_CHANNEL_NAME);
  const handleMessage = (event: MessageEvent) => {
    const message = asRecord(event.data);
    const entry = asRecord(message?.entry);
    if (message?.type !== DIAGNOSTIC_EVENT_MESSAGE_TYPE || !entry) return;
    const dedupKey = `${entry.scope || ""}::${entry.at || ""}`;
    if (seenKeys.has(dedupKey)) return;
    seenKeys.add(dedupKey);
    notifyRepositoryListener(onChange, entry);
  };
  channel.addEventListener("message", handleMessage);
  return () => {
    channel.removeEventListener("message", handleMessage);
    channel.close();
  };
}

export function createBrowserFallbackSupport(
  persistence: "local-storage" | "session",
): RepositorySupport {
  let sessionRecentAssets: RecentCursorAsset[] = [];

  async function readRecentCursorAssets(): Promise<RecentCursorAsset[]> {
    if (persistence === "session") return sessionRecentAssets;
    if (!canUseLocalStorage()) return [];
    try {
      const raw = window.localStorage.getItem(RECENT_CURSOR_ASSETS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed.map(normalizeRecentAsset).filter((item): item is RecentCursorAsset => Boolean(item))
        : [];
    } catch {
      return [];
    }
  }

  return {
    recentAssetsPersistence: persistence,
    readRecentCursorAssets,
    async writeRecentCursorAsset(asset) {
      const next = dedupeRecentAssets(await readRecentCursorAssets(), asset);
      if (persistence === "session") {
        sessionRecentAssets = next;
      } else if (canUseLocalStorage()) {
        try {
          window.localStorage.setItem(RECENT_CURSOR_ASSETS_STORAGE_KEY, JSON.stringify(next));
        } catch {}
      }
      return next;
    },
    async readRuntimeErrors() {
      return [];
    },
    async clearRuntimeErrors() {},
    async readDiagnosticDebugFlag() {
      if (!canUseLocalStorage()) return false;
      try {
        const raw = window.localStorage.getItem(DIAGNOSTIC_DEBUG_KEY) || "";
        return ["1", "true", "on", "yes", "debug"].includes(raw.trim().toLowerCase());
      } catch {
        return false;
      }
    },
    async writeDiagnosticDebugFlag(enabled) {
      if (canUseLocalStorage()) {
        try {
          if (enabled) window.localStorage.setItem(DIAGNOSTIC_DEBUG_KEY, "1");
          else window.localStorage.removeItem(DIAGNOSTIC_DEBUG_KEY);
        } catch {}
      }
      postLocalPreviewMessage({ type: "toggle-debug", enabled });
    },
    async readRuntimeDiagnostics() {
      return [];
    },
    subscribeRuntimeDiagnostics: subscribeBroadcastDiagnostics,
  };
}
