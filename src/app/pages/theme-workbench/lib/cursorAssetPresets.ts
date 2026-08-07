const SUPPORTED_CURSOR_ASSET_TYPES = ["image/png", "image/webp", "image/svg+xml"];

export function validateCursorAssetFile(file: Pick<File, "type" | "size"> | null | undefined, maxBytes: number): string {
  if (!file) return "没有读取到文件。";
  if (!SUPPORTED_CURSOR_ASSET_TYPES.includes(file.type)) {
    return "当前只支持 PNG / WebP / SVG。";
  }
  if (file.size > maxBytes) {
    return `图片过大，请控制在 ${Math.round(maxBytes / 1024)} KB 以内。`;
  }
  return "";
}
