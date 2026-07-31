export const MAX_CURSOR_UPLOAD_BYTES = 300 * 1024;
export const DEFAULT_BOX_SIZE = 48;

const MATCH_RULES = [
  { stateId: "default", patterns: ["normal", "default", "arrow", "cursor", "base"] },
  { stateId: "pointer", patterns: ["pointer", "hand", "link", "hover", "click"] },
  { stateId: "text", patterns: ["text", "ibeam", "i-beam", "input"] },
  { stateId: "grab", patterns: ["grab", "openhand"] },
  { stateId: "grabbing", patterns: ["grabbing", "closedhand", "dragging", "drag"] },
  { stateId: "busy", patterns: ["wait", "busy", "loading", "progress"] },
  { stateId: "notAllowed", patterns: ["disabled", "disable", "notallowed", "not-allowed", "ban", "forbidden"] },
  { stateId: "crosshair", patterns: ["crosshair", "precision", "aim"] },
  { stateId: "move", patterns: ["move", "all-scroll", "sizeall"] },
  { stateId: "resizeHorizontal", patterns: ["resize-horizontal", "sizewe", "ew-resize", "horizontal"] },
  { stateId: "resizeVertical", patterns: ["resize-vertical", "sizens", "ns-resize", "vertical"] },
  { stateId: "resizeDiagonalNWSE", patterns: ["nwse", "resize-diagonal-1", "diagonal-nwse"] },
  { stateId: "resizeDiagonalNESW", patterns: ["nesw", "resize-diagonal-2", "diagonal-nesw"] },
];

export function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("文件读取失败")));
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

export function getAssetDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || DEFAULT_BOX_SIZE, height: image.naturalHeight || DEFAULT_BOX_SIZE });
    image.onerror = () => resolve({ width: DEFAULT_BOX_SIZE, height: DEFAULT_BOX_SIZE });
    image.src = dataUrl;
  });
}

export function inferMimeType(dataUrl, fileType = "") {
  if (fileType) return fileType;
  if (dataUrl.startsWith("data:image/svg+xml")) return "image/svg+xml";
  if (dataUrl.startsWith("data:image/webp")) return "image/webp";
  if (dataUrl.startsWith("data:image/png")) return "image/png";
  return "image/unknown";
}

export function matchStateId(fileName) {
  const normalized = fileName.toLowerCase().replace(/\.[^.]+$/, "");
  const matched = MATCH_RULES.find((rule) => rule.patterns.some((pattern) => normalized.includes(pattern)));
  return matched?.stateId || "";
}

export function getDisplaySize(skinState) {
  if (!skinState?.image) return DEFAULT_BOX_SIZE;
  if (skinState.size?.mode === "fixedBox") return skinState.size.boxSize || DEFAULT_BOX_SIZE;
  return Math.max(skinState.image.width || DEFAULT_BOX_SIZE, skinState.image.height || DEFAULT_BOX_SIZE);
}

export function getResolvedSkinState(cursorSkin, stateId) {
  const ownState = cursorSkin?.states?.[stateId];
  if (ownState) return { state: ownState, inherited: false };
  return { state: cursorSkin?.states?.default || null, inherited: stateId !== "default" };
}

export function buildSkinStateFromAsset(asset) {
  return {
    image: {
      kind: "dataUrl",
      mimeType: asset.mimeType || inferMimeType(asset.imageDataUrl),
      dataUrl: asset.imageDataUrl,
      width: asset.sourceWidth || asset.size || DEFAULT_BOX_SIZE,
      height: asset.sourceHeight || asset.size || DEFAULT_BOX_SIZE,
    },
    hotspot: { x: asset.hotspotX ?? 0, y: asset.hotspotY ?? 0 },
    size: { mode: "fixedBox", boxSize: asset.size || DEFAULT_BOX_SIZE },
  };
}

export function getDefaultHotspot(stateMeta, width, height) {
  if (stateMeta?.defaultHotspot === "center") return { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  return { x: Math.min(10, Math.max(0, width - 1)), y: Math.min(8, Math.max(0, height - 1)) };
}
