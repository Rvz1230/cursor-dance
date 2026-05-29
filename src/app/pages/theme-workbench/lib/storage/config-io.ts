import { CURSOR_STATES } from "../../model/workbenchSchema";
import { getDefaultConfig, normalizeStoredConfig } from "../runtimeConfig";
import {
  CONFIG_STORAGE_KEY,
  CURSOR_ASSET_STORAGE_KEY_PREFIX,
  LEGACY_ENABLED_STORAGE_KEY,
  LIVE_PREVIEW_CONFIG_STORAGE_KEY,
  MAX_CURSOR_ASSET_DATA_URL_LENGTH,
  buildCursorAssetStorageKey,
  canUseLocalStorage,
  ensurePreviewStorageAccess,
  getChromeApi,
  postLocalPreviewMessage,
} from "./chrome-api";

function readLocalStorageConfig() {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    const legacyEnabledRaw = window.localStorage.getItem(LEGACY_ENABLED_STORAGE_KEY);
    const defaultConfig = getDefaultConfig();
    const parsed = raw ? JSON.parse(raw) : null;
    return normalizeStoredConfig(
      parsed || { ...defaultConfig, enabled: legacyEnabledRaw !== "false" }
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
    postLocalPreviewMessage({ type: "config-updated", config: normalized });
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
    postLocalPreviewMessage({ type: "preview-config-updated", config: normalized });
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
  } catch {}
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
        return [state.id, { ...currentState, imageDataUrl: assetRecord?.imageDataUrl || currentState.imageDataUrl || "" }];
      })
    ),
  }));
  return { ...config, themePacks: nextThemePacks, schemes: nextThemePacks };
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
        { ...stateConfig, imageDataUrl: "" },
      ])
    ),
  }));
  return { ...config, themePacks: nextThemePacks, schemes: nextThemePacks };
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
    storedConfig || { ...defaultConfig, enabled: result[LEGACY_ENABLED_STORAGE_KEY] !== false }
  );
  if (!storedConfig) {
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
        assetWrites[assetKey] = { imageDataUrl: stateConfig.imageDataUrl, updatedAt: Date.now() };
      } else {
        assetRemovals.push(assetKey);
      }
    });
  });
  if (Object.keys(assetWrites).length) await chromeApi.storage.local.set(assetWrites);
  if (assetRemovals.length) await chromeApi.storage.local.remove(assetRemovals);
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
