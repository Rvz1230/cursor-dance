import { CURSOR_STATES } from "../../model/workbenchSchema";
import { getDefaultConfig, normalizeStoredConfig } from "../runtimeConfig";
import {
  assetIdFromDesktopAssetUrl,
  isDesktopAssetId,
} from "@/shared/asset-reference";
import {
  CONFIG_STORAGE_KEY,
  EDITOR_STATE_STORAGE_KEY,
  LIVE_PREVIEW_CONFIG_STORAGE_KEY,
  MAX_CURSOR_ASSET_DATA_URL_LENGTH,
  buildCursorAssetStorageKey,
  canUseLocalStorage,
  ensurePreviewStorageAccess,
  getChromeApi,
  getElectronStorageBridge,
  postLocalPreviewMessage,
} from "./chrome-api";

const desktopAssetIdByDataUrl = new Map<string, string>();

type TransportImage = {
  kind?: unknown;
  dataUrl?: unknown;
  assetId?: unknown;
  mimeType?: unknown;
  width?: unknown;
  height?: unknown;
};

type TransportState = { image?: TransportImage };
type TransportAction = Record<string, unknown>;
type TransportTheme = {
  id?: unknown;
  cursorSkin?: { states?: Record<string, TransportState> };
  actionConfigs?: Record<string, TransportAction>;
};
type TransportConfig = { themes?: TransportTheme[] };

function cloneConfig(config: unknown): TransportConfig {
  return JSON.parse(JSON.stringify(config)) as TransportConfig;
}

function canonicalizeCachedDesktopAssets(config: unknown): TransportConfig {
  const next = cloneConfig(config);
  for (const theme of next.themes || []) {
    for (const state of Object.values(theme.cursorSkin?.states || {})) {
      const image = state.image;
      if (image?.kind !== "dataUrl" || typeof image.dataUrl !== "string") continue;
      const assetId = desktopAssetIdByDataUrl.get(image.dataUrl);
      if (!assetId) continue;
      state.image = {
        kind: "asset",
        assetId,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
      };
    }
    for (const action of Object.values(theme.actionConfigs || {})) {
      const imageDataUrl = typeof action.imageDataUrl === "string" ? action.imageDataUrl : "";
      if ("imageDataUrl" in action && imageDataUrl === "") {
        delete action.imageAssetId;
        continue;
      }
      const assetId = desktopAssetIdByDataUrl.get(imageDataUrl)
        ?? assetIdFromDesktopAssetUrl(imageDataUrl)
        ?? (isDesktopAssetId(action.imageAssetId) ? action.imageAssetId : null);
      if (!assetId) continue;
      action.imageAssetId = assetId;
      delete action.imageDataUrl;
    }
  }
  return next;
}

function rememberMaterializedDesktopAssets(sourceValue: unknown, storedValue: unknown) {
  const sourceConfig = sourceValue as TransportConfig;
  const storedConfig = storedValue as TransportConfig;
  const storedThemes = new Map((storedConfig?.themes || []).map((theme) => [theme.id, theme]));
  for (const sourceTheme of sourceConfig?.themes || []) {
    const storedTheme = storedThemes.get(sourceTheme.id);
    if (!storedTheme) continue;
    for (const [stateId, sourceState] of Object.entries(sourceTheme.cursorSkin?.states || {})) {
      const sourceImage = sourceState.image;
      const storedImage = storedTheme.cursorSkin?.states?.[stateId]?.image;
      if (
        sourceImage?.kind === "dataUrl"
        && typeof sourceImage.dataUrl === "string"
        && isDesktopAssetId(storedImage?.assetId)
      ) {
        desktopAssetIdByDataUrl.set(sourceImage.dataUrl, storedImage.assetId);
      }
    }
    for (const [actionId, sourceAction] of Object.entries(sourceTheme.actionConfigs || {})) {
      const imageDataUrl = sourceAction.imageDataUrl;
      const assetId = storedTheme.actionConfigs?.[actionId]?.imageAssetId;
      if (typeof imageDataUrl === "string" && imageDataUrl.startsWith("data:") && isDesktopAssetId(assetId)) {
        desktopAssetIdByDataUrl.set(imageDataUrl, assetId);
      }
    }
  }
}

function readLocalStorageConfig() {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    const defaultConfig = getDefaultConfig();
    const parsed = raw ? JSON.parse(raw) : null;
    const normalized = normalizeStoredConfig(parsed || defaultConfig);
    if (parsed && normalized !== parsed) {
      window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(normalized));
    }
    return normalized;
  } catch {
    return normalizeStoredConfig(getDefaultConfig());
  }
}

function writeLocalStorageConfig(config) {
  if (!canUseLocalStorage()) return normalizeStoredConfig(config);
  const normalized = normalizeStoredConfig(config);
  try {
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(normalized));
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
  return [...new Set((config.themes || []).flatMap((theme) => [
    ...CURSOR_STATES.map((state) => buildCursorAssetStorageKey(theme.id, state.id)),
    ...Object.values(theme.cursorSkin?.states || {}).flatMap((stateValue) => {
      const state = stateValue as Record<string, any>;
      return state?.image?.kind === "asset" ? [state.image.assetId] : [];
    }),
  ]))];
}

function withResolvedCursorAssets(config, assetEntries) {
  const assetMap = assetEntries || {};
  const themes = (config.themes || []).map((theme) => ({
    ...theme,
    cursorSkin: {
      ...theme.cursorSkin,
      states: Object.fromEntries(Object.entries(theme.cursorSkin?.states || {}).map(([stateId, stateValue]) => {
        const state = stateValue as Record<string, any>;
        if (state?.image?.kind !== "asset") return [stateId, state];
        const assetRecord = assetMap[state.image.assetId];
        if (!assetRecord?.imageDataUrl) return [stateId, state];
        return [stateId, {
          ...state,
          image: {
            kind: "dataUrl",
            mimeType: state.image.mimeType,
            dataUrl: assetRecord.imageDataUrl,
            width: state.image.width,
            height: state.image.height,
          },
        }];
      })),
    },
  }));
  return { ...config, themes };
}

async function resolveCursorAssetsForConfig(config, chromeApi) {
  if (!chromeApi?.storage?.local) return config;
  const assetKeys = buildCursorAssetStorageKeys(config);
  if (!assetKeys.length) return config;
  const assetEntries = await chromeApi.storage.local.get(assetKeys);
  return withResolvedCursorAssets(config, assetEntries);
}

function stripInlineCursorAssets(config) {
  const themes = (config.themes || []).map((theme) => ({
    ...theme,
    cursorSkin: {
      ...theme.cursorSkin,
      states: Object.fromEntries(Object.entries(theme.cursorSkin?.states || {}).map(([stateId, stateValue]) => {
        const state = stateValue as Record<string, any>;
        if (state?.image?.kind !== "dataUrl") return [stateId, state];
        return [stateId, {
          ...state,
          image: {
            kind: "asset",
            assetId: buildCursorAssetStorageKey(theme.id, stateId),
            mimeType: state.image.mimeType,
            width: state.image.width,
            height: state.image.height,
          },
        }];
      })),
    },
  }));
  return { ...config, themes };
}

export async function readExtensionConfig() {
  // Electron 使用单一 v4 config；Chrome 扩展才把大图片拆成 asset 引用。
  const bridge = getElectronStorageBridge();
  if (bridge) {
    const stored = await bridge.getConfig();
    const defaultConfig = getDefaultConfig();
    if (!stored) {
      return writeExtensionConfig(normalizeStoredConfig(defaultConfig));
    }
    const normalized = normalizeStoredConfig(stored);
    if (normalized !== stored) await bridge.setConfig(normalized);
    return normalized;
  }

  const chromeApi = getChromeApi();
  const defaultConfig = getDefaultConfig();
  if (!chromeApi?.storage?.local) {
    return readLocalStorageConfig() || normalizeStoredConfig(defaultConfig);
  }
  const result = await chromeApi.storage.local.get([CONFIG_STORAGE_KEY]);
  const storedConfig = result[CONFIG_STORAGE_KEY];
  const nextConfig = normalizeStoredConfig(storedConfig || defaultConfig);
  if (!storedConfig || nextConfig !== storedConfig) {
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
    const payload = canonicalizeCachedDesktopAssets(normalized);
    const stored = await bridge.setConfig(payload);
    const materialized = stored ? normalizeStoredConfig(stored) : normalized;
    rememberMaterializedDesktopAssets(normalized, materialized);
    return materialized;
  }

  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.local) {
    return writeLocalStorageConfig(normalized);
  }
  const assetWrites = {};
  const assetRemovals = [];
  Object.values(normalized.themes || {}).forEach((themeValue) => {
    const theme = themeValue as Record<string, any>;
    const states = theme.cursorSkin?.states || {};
    Object.entries(states).forEach(([stateId, stateValue]) => {
      const state = stateValue as Record<string, any>;
      const imageDataUrl = state.image?.kind === "dataUrl" ? state.image.dataUrl : "";
      if (imageDataUrl.length > MAX_CURSOR_ASSET_DATA_URL_LENGTH) {
        throw new Error(`光标图片过大，当前 ${stateId} 状态请换成更小的 PNG / WebP 后再保存。`);
      }
      const assetKey = buildCursorAssetStorageKey(theme.id, stateId);
      if (imageDataUrl) {
        assetWrites[assetKey] = { imageDataUrl, updatedAt: Date.now() };
      } else {
        assetRemovals.push(assetKey);
      }
    });
    for (const cursorState of CURSOR_STATES) {
      if (!(cursorState.id in states)) assetRemovals.push(buildCursorAssetStorageKey(theme.id, cursorState.id));
    }
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
    const payload = canonicalizeCachedDesktopAssets(normalized);
    const stored = await bridge.setLivePreview(payload);
    const materialized = stored ? normalizeStoredConfig(stored) : normalized;
    rememberMaterializedDesktopAssets(normalized, materialized);
    return materialized;
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
