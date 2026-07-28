import { CURSOR_STATES } from "../../model/workbenchSchema";
import { getDefaultConfig, normalizeStoredConfig } from "../runtimeConfig";
import {
  CONFIG_STORAGE_KEY,
  CURSOR_ASSET_STORAGE_KEY_PREFIX,
  EDITOR_STATE_STORAGE_KEY,
  LEGACY_ENABLED_STORAGE_KEY,
  LIVE_PREVIEW_CONFIG_STORAGE_KEY,
  MAX_CURSOR_ASSET_DATA_URL_LENGTH,
  buildCursorAssetStorageKey,
  canUseLocalStorage,
  ensurePreviewStorageAccess,
  getChromeApi,
  getElectronStorageBridge,
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
        { ...(stateConfig as Record<string, any>), imageDataUrl: "" },
      ])
    ),
  }));
  return { ...config, themePacks: nextThemePacks, schemes: nextThemePacks };
}

export async function readExtensionConfig() {
  // 任务 3.0：Electron 桌面端走 IPC → main → electron-store。
  // electron-store 没有 chrome.storage 的 5MB 单 key 限制，cursor 资产可以
  // 直接内联在 cursorStates.imageDataUrl 里，不走 buildCursorAssetStorageKeys 拆分。
  const bridge = getElectronStorageBridge();
  if (bridge) {
    const stored = await bridge.getConfig();
    const defaultConfig = getDefaultConfig();
    if (!stored) {
      return writeExtensionConfig(normalizeStoredConfig(defaultConfig));
    }
    return normalizeStoredConfig(stored);
  }

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
  const bridge = getElectronStorageBridge();
  if (bridge) {
    const stored = await bridge.getLivePreview();
    return stored ? normalizeStoredConfig(stored) : null;
  }

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
  const normalized = normalizeStoredConfig(config);

  const bridge = getElectronStorageBridge();
  if (bridge) {
    // electron-store 单 key 容量足够大；cursor 资产无需拆分，整个 normalized 直接落盘。
    await bridge.setConfig(normalized);
    return normalized;
  }

  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.local) {
    return writeLocalStorageConfig(normalized);
  }
  const assetWrites = {};
  const assetRemovals = [];
  Object.values(normalized.themePacks || {}).forEach((themePackValue) => {
    const themePack = themePackValue as Record<string, any>;
    Object.entries(themePack.cursorStates || {}).forEach(([stateId, stateConfigValue]) => {
      const stateConfig = stateConfigValue as Record<string, any>;
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
  const normalized = normalizeStoredConfig(config);

  const bridge = getElectronStorageBridge();
  if (bridge) {
    await bridge.setLivePreview(normalized);
    return normalized;
  }

  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.session) {
    return writeLocalStoragePreviewConfig(normalized);
  }
  await ensurePreviewStorageAccess(chromeApi);
  await chromeApi.storage.session.set({ [LIVE_PREVIEW_CONFIG_STORAGE_KEY]: normalized });
  return normalized;
}

export async function clearLivePreviewConfig() {
  const bridge = getElectronStorageBridge();
  if (bridge) {
    await bridge.clearLivePreview();
    return;
  }

  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.session) {
    clearLocalStoragePreviewConfig();
    return;
  }
  await ensurePreviewStorageAccess(chromeApi);
  await chromeApi.storage.session.remove([LIVE_PREVIEW_CONFIG_STORAGE_KEY]);
}

export async function readEditorState() {
  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.local) {
    if (!canUseLocalStorage()) return null;
    try {
      const raw = window.localStorage.getItem(EDITOR_STATE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  try {
    const result = await chromeApi.storage.local.get([EDITOR_STATE_STORAGE_KEY]);
    return result[EDITOR_STATE_STORAGE_KEY] || null;
  } catch {
    return null;
  }
}

export async function writeEditorState(state) {
  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.local) {
    if (!canUseLocalStorage()) return;
    try {
      window.localStorage.setItem(EDITOR_STATE_STORAGE_KEY, JSON.stringify(state));
    } catch {}
    return;
  }
  try {
    await chromeApi.storage.local.set({ [EDITOR_STATE_STORAGE_KEY]: state });
  } catch {
    // Non-critical, editor state is best-effort
  }
}
