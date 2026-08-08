import type { CursorDanceTheme } from "@/shared/domain/cursor-dance";
import { slugifyFileSegment } from "./chrome-api";

interface ThemeExportPayload {
  format: "cursordance-theme";
  schemaVersion: 4;
  exportedAt: string;
  theme: CursorDanceTheme;
}

interface PickedThemeFile {
  fileName: string;
  contents: string;
}

export function buildThemeExportPayload(themePack: CursorDanceTheme): ThemeExportPayload {
  return {
    format: "cursordance-theme",
    schemaVersion: 4,
    exportedAt: new Date().toISOString(),
    theme: themePack,
  };
}

function getDialogBridge(): CursorDanceDialogBridge | null {
  if (typeof window === "undefined") return null;
  return window.cursorDanceDialog ?? null;
}

function buildExportFileName(themePack: CursorDanceTheme): string {
  return `${slugifyFileSegment(themePack.name || themePack.id, "theme")}.cursordance-theme.json`;
}

function serializeExportPayload(themePack: CursorDanceTheme): string {
  return `${JSON.stringify(buildThemeExportPayload(themePack), null, 2)}\n`;
}

// Desktop uses a native save dialog; extension/local preview falls back to a download link.
export async function downloadThemePackExport(themePack: CursorDanceTheme): Promise<string | null> {
  const fileName = buildExportFileName(themePack);
  const contents = serializeExportPayload(themePack);
  const bridge = getDialogBridge();
  if (bridge?.saveThemeFile) {
    const result = await bridge.saveThemeFile({ defaultFileName: fileName, contents });
    if (!result.ok) throw new Error(result.error || "导出主题失败。");
    return result.canceled ? null : fileName;
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

export async function pickThemeFile(): Promise<PickedThemeFile | null> {
  const bridge = getDialogBridge();
  if (!bridge?.openThemeFile) return null;
  const result = await bridge.openThemeFile();
  if (!result.ok) throw new Error(result.error || "读取主题文件失败。");
  if (result.canceled) return null;
  const fileName = result.filePath.split(/[\\/]/).pop() || "theme.json";
  return { fileName, contents: result.contents };
}
