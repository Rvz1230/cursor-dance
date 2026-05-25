import { CURSOR_STATES } from "../model/workbenchSchema.js";
import { getDefaultConfig, getRuntimeConfig, normalizeStoredConfig } from "./runtimeConfig.js";

const CONFIG_STORAGE_KEY = "cursordance.config";
const LEGACY_ENABLED_STORAGE_KEY = "cursordance.enabled";
const PREVIEW_MESSAGE_TYPE = "CURSORDANCE_PREVIEW_SCHEME";
export const LOCAL_PREVIEW_CHANNEL_NAME = "cursordance.local-preview";
export const DIAGNOSTIC_EVENT_MESSAGE_TYPE = "diagnostic-event";
const LIVE_PREVIEW_CONFIG_STORAGE_KEY = "cursordance.livePreviewConfig";
const CURSOR_ASSET_STORAGE_KEY_PREFIX = "cursordance.cursorAsset.";
const RECENT_CURSOR_ASSETS_STORAGE_KEY = "cursordance.cursorAssetRecents";
const RUNTIME_ERRORS_STORAGE_KEY = "cursordance.runtimeErrors";
const MAX_CURSOR_ASSET_DATA_URL_LENGTH = 600 * 1024;
const MAX_RECENT_CURSOR_ASSETS = 6;

let localPreviewChannel = null;
let previewStorageAccessPromise = null;

function getChromeApi() {
  if (typeof window === "undefined") return null;
  return window.chrome ?? null;
}

function postLocalPreviewMessage(message) {
  if (typeof window === "undefined" || typeof window.BroadcastChannel !== "function") return;
  localPreviewChannel ??= new window.BroadcastChannel(LOCAL_PREVIEW_CHANNEL_NAME);
  localPreviewChannel.postMessage(message);
}

async function ensurePreviewStorageAccess(chromeApi) {
  if (!chromeApi?.storage?.session?.setAccessLevel) return;
  if (!previewStorageAccessPromise) {
    previewStorageAccessPromise = chromeApi.storage.session
      .setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })
      .catch(() => {});
  }
  await previewStorageAccessPromise;
}

function canUseLocalStorage() {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    const probeKey = "__cursordance_preview_probe__";
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

function readLocalStorageConfig() {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    const legacyEnabledRaw = window.localStorage.getItem(LEGACY_ENABLED_STORAGE_KEY);
    const defaultConfig = getDefaultConfig();
    const parsed = raw ? JSON.parse(raw) : null;
    return normalizeStoredConfig(
      parsed || {
        ...defaultConfig,
        enabled: legacyEnabledRaw !== "false",
      }
    );
  } catch {
    return normalizeStoredConfig(getDefaultConfig());
  }
}

function writeLocalStorageConfig(config) {
  if (!canUseLocalStorage()) return normalizeStoredConfig(config);
  const normalized = normalizeStoredConfig(config);
  try {
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(normalized));
    window.localStorage.setItem(LEGACY_ENABLED_STORAGE_KEY, String(normalized.enabled !== false));
    postLocalPreviewMessage({
      type: "config-updated",
      config: normalized,
    });
  } catch {
    return normalized;
  }
  return normalized;
}

function readLocalStoragePreviewConfig() {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(LIVE_PREVIEW_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    return normalizeStoredConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeLocalStoragePreviewConfig(config) {
  if (!canUseLocalStorage()) return normalizeStoredConfig(config);
  const normalized = normalizeStoredConfig(config);
  try {
    window.localStorage.setItem(LIVE_PREVIEW_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
    postLocalPreviewMessage({
      type: "preview-config-updated",
      config: normalized,
    });
  } catch {
    return normalized;
  }
  return normalized;
}

function clearLocalStoragePreviewConfig() {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.removeItem(LIVE_PREVIEW_CONFIG_STORAGE_KEY);
    postLocalPreviewMessage({ type: "preview-config-cleared" });
  } catch {
    // Ignore local preview cleanup failures.
  }
}

function buildCursorAssetStorageKey(themeId, stateId) {
  return `${CURSOR_ASSET_STORAGE_KEY_PREFIX}${themeId}.${stateId}`;
}

function slugifyFileSegment(value, fallback = "theme") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    || fallback;
}

function buildCursorAssetStorageKeys(config) {
  return (config.themePacks || []).flatMap((themePack) =>
    CURSOR_STATES.map((state) => buildCursorAssetStorageKey(themePack.id, state.id))
  );
}

function withResolvedCursorAssets(config, assetEntries) {
  const assetMap = assetEntries || {};
  const nextThemePacks = (config.themePacks || []).map((themePack) => ({
    ...themePack,
    cursorStates: Object.fromEntries(
      CURSOR_STATES.map((state) => {
        const currentState = themePack.cursorStates?.[state.id] || {};
        const assetRecord = assetMap[buildCursorAssetStorageKey(themePack.id, state.id)];
        return [
          state.id,
          {
            ...currentState,
            imageDataUrl: assetRecord?.imageDataUrl || currentState.imageDataUrl || "",
          },
        ];
      })
    ),
  }));

  return {
    ...config,
    themePacks: nextThemePacks,
    schemes: nextThemePacks,
  };
}

async function resolveCursorAssetsForConfig(config, chromeApi) {
  if (!chromeApi?.storage?.local) return config;
  const assetKeys = buildCursorAssetStorageKeys(config);
  if (!assetKeys.length) return config;
  const assetEntries = await chromeApi.storage.local.get(assetKeys);
  return withResolvedCursorAssets(config, assetEntries);
}

function stripInlineCursorAssets(config) {
  const nextThemePacks = (config.themePacks || []).map((themePack) => ({
    ...themePack,
    cursorStates: Object.fromEntries(
      Object.entries(themePack.cursorStates || {}).map(([stateId, stateConfig]) => [
        stateId,
        {
          ...stateConfig,
          imageDataUrl: "",
        },
      ])
    ),
  }));

  return {
    ...config,
    themePacks: nextThemePacks,
    schemes: nextThemePacks,
  };
}

export async function readExtensionConfig() {
  const chromeApi = getChromeApi();
  const defaultConfig = getDefaultConfig();

  if (!chromeApi?.storage?.local) {
    return readLocalStorageConfig() || normalizeStoredConfig(defaultConfig);
  }

  const result = await chromeApi.storage.local.get([CONFIG_STORAGE_KEY, LEGACY_ENABLED_STORAGE_KEY]);
  const storedConfig = result[CONFIG_STORAGE_KEY];
  const nextConfig = normalizeStoredConfig(
    storedConfig || {
      ...defaultConfig,
      enabled: result[LEGACY_ENABLED_STORAGE_KEY] !== false,
    }
  );

  if (!storedConfig || getRuntimeConfig().needsMigration?.(storedConfig)) {
    return writeExtensionConfig(nextConfig);
  }

  return resolveCursorAssetsForConfig(nextConfig, chromeApi);
}

export async function readLivePreviewConfig() {
  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.session) {
    return readLocalStoragePreviewConfig();
  }

  await ensurePreviewStorageAccess(chromeApi);
  try {
    const result = await chromeApi.storage.session.get([LIVE_PREVIEW_CONFIG_STORAGE_KEY]);
    return result[LIVE_PREVIEW_CONFIG_STORAGE_KEY]
      ? normalizeStoredConfig(result[LIVE_PREVIEW_CONFIG_STORAGE_KEY])
      : null;
  } catch {
    return null;
  }
}

export async function writeExtensionConfig(config) {
  const chromeApi = getChromeApi();
  const normalized = normalizeStoredConfig(config);

  if (!chromeApi?.storage?.local) {
    return writeLocalStorageConfig(normalized);
  }

  const assetWrites = {};
  const assetRemovals = [];
  Object.values(normalized.themePacks || []).forEach((themePack) => {
    Object.entries(themePack?.cursorStates || {}).forEach(([stateId, stateConfig]) => {
      if ((stateConfig?.imageDataUrl || "").length > MAX_CURSOR_ASSET_DATA_URL_LENGTH) {
        throw new Error(`光标图片过大，当前 ${stateId} 状态请换成更小的 PNG / WebP 后再保存。`);
      }
      const assetKey = buildCursorAssetStorageKey(themePack.id, stateId);
      if (stateConfig?.imageDataUrl) {
        assetWrites[assetKey] = {
          imageDataUrl: stateConfig.imageDataUrl,
          updatedAt: Date.now(),
        };
      } else {
        assetRemovals.push(assetKey);
      }
    });
  });

  if (Object.keys(assetWrites).length) {
    await chromeApi.storage.local.set(assetWrites);
  }
  if (assetRemovals.length) {
    await chromeApi.storage.local.remove(assetRemovals);
  }

  const configForStorage = stripInlineCursorAssets(normalized);
  await chromeApi.storage.local.set({ [CONFIG_STORAGE_KEY]: configForStorage });
  return resolveCursorAssetsForConfig(configForStorage, chromeApi);
}

export async function writeLivePreviewConfig(config) {
  const chromeApi = getChromeApi();
  const normalized = normalizeStoredConfig(config);

  if (!chromeApi?.storage?.session) {
    return writeLocalStoragePreviewConfig(normalized);
  }

  await ensurePreviewStorageAccess(chromeApi);
  await chromeApi.storage.session.set({ [LIVE_PREVIEW_CONFIG_STORAGE_KEY]: normalized });
  return normalized;
}

export async function clearLivePreviewConfig() {
  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.session) {
    clearLocalStoragePreviewConfig();
    return;
  }

  await ensurePreviewStorageAccess(chromeApi);
  await chromeApi.storage.session.remove([LIVE_PREVIEW_CONFIG_STORAGE_KEY]);
}

export function buildThemeExportPayload(themePack) {
  return {
    format: "cursordance-theme-pack",
    version: 1,
    exportedAt: new Date().toISOString(),
    themePack: normalizeStoredConfig({
      enabled: true,
      activeThemePackId: themePack?.id || "",
      activeSchemeId: themePack?.id || "",
      themePacks: [themePack],
      schemes: [themePack],
      siteRules: { byHost: {} },
      editor: {},
    }).themePacks[0],
  };
}

export function downloadThemePackExport(themePack) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("当前环境不支持导出主题文件。");
  }

  const payload = buildThemeExportPayload(themePack);
  const fileName = `${slugifyFileSegment(themePack?.name || themePack?.id, "theme")}.cursordance-theme.json`;
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 0);
  return fileName;
}

export function subscribeExtensionConfig(onChange) {
  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.onChanged) {
    if (!canUseLocalStorage()) return () => {};
    function handleStorage(event) {
      if (event.key !== CONFIG_STORAGE_KEY && event.key !== LEGACY_ENABLED_STORAGE_KEY) return;
      onChange(readLocalStorageConfig() || normalizeStoredConfig(getDefaultConfig()));
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
      onChange(readLocalStoragePreviewConfig());
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

export async function readRecentCursorAssets() {
  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.local) return [];

  const result = await chromeApi.storage.local.get([RECENT_CURSOR_ASSETS_STORAGE_KEY]);
  return Array.isArray(result[RECENT_CURSOR_ASSETS_STORAGE_KEY]) ? result[RECENT_CURSOR_ASSETS_STORAGE_KEY] : [];
}

export async function writeRecentCursorAsset(assetRecord) {
  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.local || !assetRecord?.imageDataUrl) return [];

  const current = await readRecentCursorAssets();
  const nextRecord = {
    id: assetRecord.id || `recent-${Date.now()}`,
    imageDataUrl: assetRecord.imageDataUrl,
    name: assetRecord.name || "未命名素材",
    mimeType: assetRecord.mimeType || "image/png",
    hotspotX: assetRecord.hotspotX ?? 16,
    hotspotY: assetRecord.hotspotY ?? 32,
    size: assetRecord.size ?? 48,
    updatedAt: assetRecord.updatedAt || Date.now(),
  };

  const deduped = [nextRecord, ...current.filter((item) => item.imageDataUrl !== nextRecord.imageDataUrl)]
    .slice(0, MAX_RECENT_CURSOR_ASSETS);

  await chromeApi.storage.local.set({ [RECENT_CURSOR_ASSETS_STORAGE_KEY]: deduped });
  return deduped;
}

export async function readActiveSiteContext() {
  const chromeApi = getChromeApi();
  if (!chromeApi?.tabs?.query) {
    const isPreviewPage = typeof window !== "undefined"
      && /^(http|https):$/.test(window.location.protocol)
      && window.location.hostname.length > 0;
    return {
      host: isPreviewPage ? window.location.hostname.toLowerCase() : "example.com",
      isSupportedPage: isPreviewPage,
      isPreviewMode: isPreviewPage,
      tabId: isPreviewPage ? 0 : null,
    };
  }

  try {
    const tabs = await chromeApi.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    const url = activeTab?.url ? new URL(activeTab.url) : null;
    const isSupportedPage = url?.protocol === "http:" || url?.protocol === "https:";

    return {
      host: isSupportedPage ? url.hostname.toLowerCase() : "example.com",
      isSupportedPage,
      isPreviewMode: false,
      tabId: activeTab?.id ?? null,
    };
  } catch {
    return {
      host: "example.com",
      isSupportedPage: false,
      isPreviewMode: false,
      tabId: null,
    };
  }
}

export async function previewThemePack(themeId, themePack, actionId = "leftClick") {
  const chromeApi = getChromeApi();
  const site = await readActiveSiteContext();
  if (!chromeApi?.tabs?.sendMessage) {
    if (!site.isSupportedPage) return false;
    postLocalPreviewMessage({
      type: "preview-theme",
      themeId,
      themePack,
      actionId,
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("CURSORDANCE_POPUP_PREVIEW", {
          detail: { themeId, themePack, actionId },
        })
      );
    }
    return true;
  }
  if (site.tabId == null || !site.isSupportedPage) return false;

  try {
    await chromeApi.tabs.sendMessage(site.tabId, {
      type: PREVIEW_MESSAGE_TYPE,
      schemeId: themeId,
      scheme: themePack,
      actionId,
    });
    return true;
  } catch {
    return false;
  }
}

export async function readRuntimeErrors() {
  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.local) return [];
  try {
    const result = await chromeApi.storage.local.get([RUNTIME_ERRORS_STORAGE_KEY]);
    return Array.isArray(result[RUNTIME_ERRORS_STORAGE_KEY]) ? result[RUNTIME_ERRORS_STORAGE_KEY] : [];
  } catch {
    return [];
  }
}

export async function clearRuntimeErrors() {
  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.local) return;
  try {
    await chromeApi.storage.local.remove([RUNTIME_ERRORS_STORAGE_KEY]);
  } catch {
    // Best-effort cleanup.
  }
}
