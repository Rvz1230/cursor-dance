import { getDefaultConfig, normalizeStoredConfig } from "../runtimeConfig.js";
import {
  CONFIG_STORAGE_KEY,
  CURSOR_ASSET_STORAGE_KEY_PREFIX,
  DIAGNOSTIC_EVENT_MESSAGE_TYPE,
  LEGACY_ENABLED_STORAGE_KEY,
  LIVE_PREVIEW_CONFIG_STORAGE_KEY,
  LOCAL_PREVIEW_CHANNEL_NAME,
  canUseLocalStorage,
  getChromeApi,
} from "./chrome-api.js";
import { readExtensionConfig, readLivePreviewConfig } from "./config-io.js";

function readLocalStorageFallback() {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    return normalizeStoredConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

function readLocalStoragePreviewFallback() {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(LIVE_PREVIEW_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    return normalizeStoredConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function subscribeExtensionConfig(onChange) {
  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.onChanged) {
    if (!canUseLocalStorage()) return () => {};
    function handleStorage(event) {
      if (event.key !== CONFIG_STORAGE_KEY && event.key !== LEGACY_ENABLED_STORAGE_KEY) return;
      onChange(readLocalStorageFallback() || normalizeStoredConfig(getDefaultConfig()));
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }

  async function handleChanges(changes, areaName) {
    if (areaName !== "local") return;
    const changedKeys = Object.keys(changes);
    if (changedKeys.some((key) => key === CONFIG_STORAGE_KEY || key.startsWith(CURSOR_ASSET_STORAGE_KEY_PREFIX))) {
      onChange(await readExtensionConfig());
      return;
    }
    if (changes[LEGACY_ENABLED_STORAGE_KEY]) {
      onChange((currentConfig) =>
        normalizeStoredConfig({
          ...currentConfig,
          enabled: changes[LEGACY_ENABLED_STORAGE_KEY].newValue !== false,
        })
      );
    }
  }

  chromeApi.storage.onChanged.addListener(handleChanges);
  return () => chromeApi.storage.onChanged.removeListener(handleChanges);
}

export function subscribeLivePreviewConfig(onChange) {
  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.onChanged) {
    if (!canUseLocalStorage()) return () => {};

    function handleStorage(event) {
      if (event.key !== LIVE_PREVIEW_CONFIG_STORAGE_KEY) return;
      onChange(readLocalStoragePreviewFallback());
    }

    window.addEventListener("storage", handleStorage);

    let channel = null;
    const handleBroadcast = (event) => {
      const message = event.data || {};
      if (message.type === "preview-config-updated") {
        onChange(normalizeStoredConfig(message.config));
      }
      if (message.type === "preview-config-cleared") {
        onChange(null);
      }
    };

    if (typeof window !== "undefined" && typeof window.BroadcastChannel === "function") {
      channel = new window.BroadcastChannel(LOCAL_PREVIEW_CHANNEL_NAME);
      channel.addEventListener("message", handleBroadcast);
    }

    return () => {
      window.removeEventListener("storage", handleStorage);
      channel?.removeEventListener("message", handleBroadcast);
      channel?.close();
    };
  }

  async function handleChanges(changes, areaName) {
    if (areaName !== "session" || !changes[LIVE_PREVIEW_CONFIG_STORAGE_KEY]) return;
    const nextValue = changes[LIVE_PREVIEW_CONFIG_STORAGE_KEY].newValue;
    onChange(nextValue ? normalizeStoredConfig(nextValue) : null);
  }

  chromeApi.storage.onChanged.addListener(handleChanges);
  return () => chromeApi.storage.onChanged.removeListener(handleChanges);
}

export function subscribeRuntimeDiagnostics(onChange) {
  if (typeof window === "undefined" || typeof window.BroadcastChannel !== "function") {
    return () => {};
  }

  const channel = new window.BroadcastChannel(LOCAL_PREVIEW_CHANNEL_NAME);
  const handleMessage = (event) => {
    const message = event.data || {};
    if (message.type !== DIAGNOSTIC_EVENT_MESSAGE_TYPE || !message.entry) return;
    onChange(message.entry);
  };

  channel.addEventListener("message", handleMessage);
  return () => {
    channel.removeEventListener("message", handleMessage);
    channel.close();
  };
}
