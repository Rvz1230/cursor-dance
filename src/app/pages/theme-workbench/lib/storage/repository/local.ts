import {
  CONFIG_STORAGE_KEY,
  LIVE_PREVIEW_CONFIG_STORAGE_KEY,
  LOCAL_PREVIEW_CHANNEL_NAME,
  canUseLocalStorage,
  postLocalPreviewMessage,
} from "../chrome-api";
import { readLocalEditorState, writeLocalEditorState } from "./local-editor-state";
import {
  notifyRepositoryListener,
  type WorkbenchRepository,
  type WorkbenchRepositoryCodec,
} from "./types";
import { createBrowserFallbackSupport } from "./support";
import type { CursorDanceConfig } from "@/shared/config/default-config";

function readStoredConfig(key: string, codec: WorkbenchRepositoryCodec): CursorDanceConfig | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? codec.normalizeConfig(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function createLocalWorkbenchRepository(codec: WorkbenchRepositoryCodec): WorkbenchRepository {
  const support = createBrowserFallbackSupport("local-storage");
  function writeStoredConfig(key: string, config: unknown, messageType: string): CursorDanceConfig {
    const normalized = codec.normalizeConfig(config);
    if (!canUseLocalStorage()) return normalized;
    try {
      window.localStorage.setItem(key, JSON.stringify(normalized));
      postLocalPreviewMessage({ type: messageType, config: normalized });
    } catch {}
    return normalized;
  }

  return {
    kind: "local",
    ...support,
    async readConfig() {
      if (canUseLocalStorage()) {
        try {
          const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            const normalized = codec.normalizeConfig(parsed);
            if (normalized !== parsed) {
              window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(normalized));
            }
            return normalized;
          }
        } catch {
          // Fall through and replace malformed storage with the latest default.
        }
      }
      return writeStoredConfig(CONFIG_STORAGE_KEY, codec.getDefaultConfig(), "config-updated");
    },
    async writeConfig(config) {
      return writeStoredConfig(CONFIG_STORAGE_KEY, config, "config-updated");
    },
    async readLivePreview() {
      return readStoredConfig(LIVE_PREVIEW_CONFIG_STORAGE_KEY, codec);
    },
    async writeLivePreview(config) {
      return writeStoredConfig(LIVE_PREVIEW_CONFIG_STORAGE_KEY, config, "preview-config-updated");
    },
    async clearLivePreview() {
      if (!canUseLocalStorage()) return;
      try {
        window.localStorage.removeItem(LIVE_PREVIEW_CONFIG_STORAGE_KEY);
        postLocalPreviewMessage({ type: "preview-config-cleared" });
      } catch {}
    },
    readEditorState: readLocalEditorState,
    writeEditorState: writeLocalEditorState,
    subscribeConfig(onChange) {
      if (!canUseLocalStorage()) return () => {};
      const handleStorage = (event: StorageEvent) => {
        if (event.key !== CONFIG_STORAGE_KEY) return;
        notifyRepositoryListener(
          onChange,
          readStoredConfig(CONFIG_STORAGE_KEY, codec) ?? codec.normalizeConfig(codec.getDefaultConfig()),
        );
      };
      window.addEventListener("storage", handleStorage);
      return () => window.removeEventListener("storage", handleStorage);
    },
    subscribeLivePreview(onChange) {
      if (!canUseLocalStorage()) return () => {};
      const handleStorage = (event: StorageEvent) => {
        if (event.key === LIVE_PREVIEW_CONFIG_STORAGE_KEY) {
          notifyRepositoryListener(onChange, readStoredConfig(LIVE_PREVIEW_CONFIG_STORAGE_KEY, codec));
        }
      };
      window.addEventListener("storage", handleStorage);

      let channel: BroadcastChannel | null = null;
      const handleBroadcast = (event: MessageEvent) => {
        const message = event.data && typeof event.data === "object"
          ? event.data as Record<string, unknown>
          : {};
        if (message.type === "preview-config-updated") {
          notifyRepositoryListener(onChange, codec.normalizeConfig(message.config));
        } else if (message.type === "preview-config-cleared") {
          notifyRepositoryListener(onChange, null);
        }
      };
      if (typeof window.BroadcastChannel === "function") {
        channel = new window.BroadcastChannel(LOCAL_PREVIEW_CHANNEL_NAME);
        channel.addEventListener("message", handleBroadcast);
      }
      return () => {
        window.removeEventListener("storage", handleStorage);
        channel?.removeEventListener("message", handleBroadcast);
        channel?.close();
      };
    },
  };
}
