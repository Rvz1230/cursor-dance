const CONFIG_STORAGE_KEY = "cursordance.config";
const PREVIEW_MESSAGE_TYPE = "CURSORDANCE_PREVIEW_THEME";
const LOCAL_PREVIEW_CHANNEL_NAME = "cursordance.local-preview";
const DIAGNOSTIC_EVENT_MESSAGE_TYPE = "diagnostic-event";
const LIVE_PREVIEW_CONFIG_STORAGE_KEY = "cursordance.livePreviewConfig";
const CURSOR_ASSET_STORAGE_KEY_PREFIX = "cursordance.cursorAsset.";
const RECENT_CURSOR_ASSETS_STORAGE_KEY = "cursordance.cursorAssetRecents";
const RUNTIME_ERRORS_STORAGE_KEY = "cursordance.runtimeErrors";
const DIAGNOSTIC_DEBUG_KEY = "cursordance.debug";
const EDITOR_STATE_STORAGE_KEY = "cursordance.editorState";
const MAX_CURSOR_ASSET_DATA_URL_LENGTH = 600 * 1024;
const MAX_RECENT_CURSOR_ASSETS = 6;

let localPreviewChannel = null;
let previewStorageAccessPromise = null;

function getChromeApi() {
  if (typeof window === "undefined") return null;
  return window.chrome ?? null;
}

// 桌面端 preload 注入的存储桥。扩展端、静态预览、单测里
// 都不存在，返回 null —— 让上层的 chrome / localStorage 分支接管。
function getElectronStorageBridge() {
  if (typeof window === "undefined") return null;
  return window.cursorDanceStorage ?? null;
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

function parseBooleanFlag(value) {
  if (value === true) return true;
  if (typeof value !== "string") return false;
  return ["1", "true", "on", "yes", "debug"].includes(value.trim().toLowerCase());
}

function buildCursorAssetStorageKey(themeId, stateId) {
  return `${CURSOR_ASSET_STORAGE_KEY_PREFIX}${themeId}.${stateId}`;
}

function slugifyFileSegment(value, fallback = "theme") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    || fallback;
}

export {
  CONFIG_STORAGE_KEY,
  CURSOR_ASSET_STORAGE_KEY_PREFIX,
  DIAGNOSTIC_DEBUG_KEY,
  DIAGNOSTIC_EVENT_MESSAGE_TYPE,
  EDITOR_STATE_STORAGE_KEY,
  LIVE_PREVIEW_CONFIG_STORAGE_KEY,
  LOCAL_PREVIEW_CHANNEL_NAME,
  MAX_CURSOR_ASSET_DATA_URL_LENGTH,
  MAX_RECENT_CURSOR_ASSETS,
  PREVIEW_MESSAGE_TYPE,
  RECENT_CURSOR_ASSETS_STORAGE_KEY,
  RUNTIME_ERRORS_STORAGE_KEY,
  buildCursorAssetStorageKey,
  canUseLocalStorage,
  ensurePreviewStorageAccess,
  getChromeApi,
  getElectronStorageBridge,
  parseBooleanFlag,
  postLocalPreviewMessage,
  slugifyFileSegment,
};
