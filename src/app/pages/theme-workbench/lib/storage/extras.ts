import { normalizeStoredConfig } from "../runtimeConfig";
import {
  DIAGNOSTIC_DEBUG_KEY,
  LOCAL_PREVIEW_CHANNEL_NAME,
  MAX_RECENT_CURSOR_ASSETS,
  PREVIEW_MESSAGE_TYPE,
  RECENT_CURSOR_ASSETS_STORAGE_KEY,
  RUNTIME_ERRORS_STORAGE_KEY,
  getChromeApi,
  parseBooleanFlag,
  postLocalPreviewMessage,
  slugifyFileSegment,
} from "./chrome-api";

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
      siteRules: [],
      editor: {},
    }).themePacks[0],
  };
}

function getDialogBridge() {
  if (typeof window === "undefined") return null;
  return window.cursorDanceDialog ?? null;
}

function buildExportFileName(themePack) {
  return `${slugifyFileSegment(themePack?.name || themePack?.id, "theme")}.cursordance-theme.json`;
}

function serializeExportPayload(themePack) {
  return `${JSON.stringify(buildThemeExportPayload(themePack), null, 2)}\n`;
}

// 桌面端通过 cursorDanceDialog（IPC + dialog.showSaveDialog）走原生保存对话框；
// 扩展端 / 静态预览没有 bridge，回落到 Blob + <a download>。
// 返回值统一：成功保存 → fileName；用户取消 → null。
export async function downloadThemePackExport(themePack) {
  const fileName = buildExportFileName(themePack);
  const contents = serializeExportPayload(themePack);

  const bridge = getDialogBridge();
  if (bridge?.saveThemeFile) {
    const result = await bridge.saveThemeFile({ defaultFileName: fileName, contents });
    if (!result.ok) {
      throw new Error(result.error || "导出主题失败。");
    }
    if (result.canceled) return null;
    return fileName;
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("当前环境不支持导出主题文件。");
  }
  const blob = new Blob([contents], { type: "application/json" });
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

// 桌面端打开原生「打开文件」对话框，读取并返回 { fileName, contents }。
// 扩展端没有桥时返回 null —— 调用方继续走 <input type=file> 路径。
// 用户取消同样返回 null。
export async function pickThemeFile() {
  const bridge = getDialogBridge();
  if (!bridge?.openThemeFile) return null;
  const result = await bridge.openThemeFile();
  if (!result.ok) {
    throw new Error(result.error || "读取主题文件失败。");
  }
  if (result.canceled) return null;
  const fileName = result.filePath.split(/[\\/]/).pop() || "theme.json";
  return { fileName, contents: result.contents };
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
    return { host: "example.com", isSupportedPage: false, isPreviewMode: false, tabId: null };
  }
}

export async function previewThemePack(themeId, themePack, actionId = "leftClick") {
  const chromeApi = getChromeApi();
  const site = await readActiveSiteContext();
  if (!chromeApi?.tabs?.sendMessage) {
    if (!site.isSupportedPage) return false;
    postLocalPreviewMessage({ type: "preview-theme", themeId, themePack, actionId });
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
  } catch {}
}

export async function readDiagnosticDebugFlag() {
  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.local) {
    try {
      const raw = window.localStorage?.getItem(DIAGNOSTIC_DEBUG_KEY) || "";
      return ["1", "true", "on", "yes", "debug"].includes(raw.trim().toLowerCase());
    } catch {
      return false;
    }
  }
  try {
    const result = await chromeApi.storage.local.get([DIAGNOSTIC_DEBUG_KEY]);
    return parseBooleanFlag(result[DIAGNOSTIC_DEBUG_KEY]);
  } catch {
    return false;
  }
}

export async function readRuntimeDiagnostics() {
  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.local) return [];
  try {
    const result = await chromeApi.storage.local.get(["cursordance.diagnosticEvents"]);
    return Array.isArray(result["cursordance.diagnosticEvents"]) ? result["cursordance.diagnosticEvents"] : [];
  } catch {
    return [];
  }
}

export async function writeDiagnosticDebugFlag(enabled) {
  const chromeApi = getChromeApi();
  try {
    if (enabled) {
      window.localStorage?.setItem(DIAGNOSTIC_DEBUG_KEY, "1");
    } else {
      window.localStorage?.removeItem(DIAGNOSTIC_DEBUG_KEY);
    }
  } catch {}
  if (!chromeApi?.storage?.local) {
    try {
      if (typeof window !== "undefined" && typeof window.BroadcastChannel === "function") {
        const channel = new window.BroadcastChannel(LOCAL_PREVIEW_CHANNEL_NAME);
        channel.postMessage({ type: "toggle-debug", enabled });
        channel.close();
      }
    } catch {}
    return;
  }
  try {
    if (enabled) {
      await chromeApi.storage.local.set({ [DIAGNOSTIC_DEBUG_KEY]: "1" });
    } else {
      await chromeApi.storage.local.remove([DIAGNOSTIC_DEBUG_KEY]);
    }
  } catch {}
}
