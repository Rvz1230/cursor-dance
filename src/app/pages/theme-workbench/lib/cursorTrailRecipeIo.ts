import { serializeCursorTrailRecipe } from "@/shared/config/cursor-trail-recipe";
import type { CursorTrailConfig } from "@/shared/config/cursor-trail";

let copiedRecipeText = "";

function buildFileName(config: CursorTrailConfig): string {
  return `cursor-trail-${config.material}.cursordance-trail.json`;
}

export async function copyCursorTrailRecipe(config: CursorTrailConfig): Promise<void> {
  copiedRecipeText = serializeCursorTrailRecipe(config);
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(copiedRecipeText);
      return;
    } catch {}
  }
  const input = document.createElement("textarea");
  input.value = copiedRecipeText;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

export async function readCursorTrailRecipeClipboard(): Promise<string> {
  if (navigator.clipboard?.readText) {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) return text;
    } catch {}
  }
  if (copiedRecipeText) return copiedRecipeText;
  throw new Error("剪贴板里没有可读取的拖尾配方。");
}

export async function downloadCursorTrailRecipe(config: CursorTrailConfig): Promise<string | null> {
  const fileName = buildFileName(config);
  const contents = serializeCursorTrailRecipe(config);
  if (window.cursorDanceDialog?.saveThemeFile) {
    const result = await window.cursorDanceDialog.saveThemeFile({ defaultFileName: fileName, contents });
    if (result.ok === false) throw new Error(result.error || "导出拖尾配方失败。");
    return result.canceled === true ? null : fileName;
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

export async function pickCursorTrailRecipeFile(): Promise<{ fileName: string; contents: string } | null> {
  if (!window.cursorDanceDialog?.openThemeFile) return null;
  const result = await window.cursorDanceDialog.openThemeFile();
  if (result.ok === false) throw new Error(result.error || "读取拖尾配方失败。");
  if (result.canceled === true) return null;
  return {
    fileName: result.filePath.split(/[\\/]/).pop() || "cursor-trail.json",
    contents: result.contents,
  };
}
