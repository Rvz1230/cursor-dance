import {
  PREVIEW_MESSAGE_TYPE,
  getChromeApi,
  postLocalPreviewMessage,
  slugifyFileSegment,
} from "./chrome-api";
import { getWorkbenchRepository } from "./repository";

export function buildThemeExportPayload(themePack) {
  return {
    format: "cursordance-theme",
    schemaVersion: 4,
    exportedAt: new Date().toISOString(),
    theme: themePack,
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
      throw new Error("error" in result ? result.error : "导出主题失败。");
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
    throw new Error("error" in result ? result.error : "读取主题文件失败。");
  }
  if (result.canceled) return null;
  if (!("filePath" in result) || !("contents" in result)) return null;
  const fileName = result.filePath.split(/[\\/]/).pop() || "theme.json";
  return { fileName, contents: result.contents };
}

export async function readRecentCursorAssets() {
  return getWorkbenchRepository().readRecentCursorAssets();
}

export async function writeRecentCursorAsset(assetRecord) {
  return getWorkbenchRepository().writeRecentCursorAsset(assetRecord);
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
      themeId,
      themePack,
      actionId,
    });
    return true;
  } catch {
    return false;
  }
}

export async function readRuntimeErrors() {
  return getWorkbenchRepository().readRuntimeErrors();
}

export async function clearRuntimeErrors() {
  return getWorkbenchRepository().clearRuntimeErrors();
}

export async function readDiagnosticDebugFlag() {
  return getWorkbenchRepository().readDiagnosticDebugFlag();
}

export async function readRuntimeDiagnostics() {
  return getWorkbenchRepository().readRuntimeDiagnostics();
}

export async function clearRuntimeDiagnostics() {
  return getWorkbenchRepository().clearRuntimeDiagnostics();
}

export async function writeDiagnosticDebugFlag(enabled) {
  return getWorkbenchRepository().writeDiagnosticDebugFlag(enabled);
}
