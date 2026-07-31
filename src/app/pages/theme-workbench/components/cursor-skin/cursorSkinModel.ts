import type { LucideIcon } from "lucide-react";
import { matchCursorStateIdFromFileName } from "@/shared/cursor-states";

export const MAX_CURSOR_UPLOAD_BYTES = 300 * 1024;
export const DEFAULT_BOX_SIZE = 48;

export interface Hotspot {
  x: number;
  y: number;
}

/** 光标图片的宽松视图：素材可能是内联 dataUrl，也可能是桌面 asset 引用。 */
interface CursorImageLike {
  kind?: string;
  mimeType?: string;
  dataUrl?: string;
  assetId?: string;
  width?: number;
  height?: number;
}

export interface CursorSkinStateLike {
  image?: CursorImageLike;
  hotspot?: Hotspot;
  size?: { mode?: string; boxSize?: number };
}

export interface CursorSkinLike {
  states?: Record<string, CursorSkinStateLike | undefined>;
}

/** Workbench 侧的状态元信息（真值源 + UI 图标），见 `model/workbenchSchema.ts`。 */
export interface CursorStateMeta {
  id: string;
  label: string;
  detail: string;
  defaultHotspot: "topLeft" | "center";
  icon: LucideIcon;
}

/** 旧的扁平素材形状，仍用于「最近素材」与 legacy cursorStateAssets。 */
export interface LegacyCursorAsset {
  imageDataUrl?: string;
  mimeType?: string;
  hotspotX?: number;
  hotspotY?: number;
  size?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  name?: string;
}

export function clamp(value: number, min: number, max: number): number {
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

export function inferMimeType(dataUrl: string, fileType = ""): string {
  if (fileType) return fileType;
  if (dataUrl.startsWith("data:image/svg+xml")) return "image/svg+xml";
  if (dataUrl.startsWith("data:image/webp")) return "image/webp";
  if (dataUrl.startsWith("data:image/png")) return "image/png";
  return "image/unknown";
}

export function matchStateId(fileName: string): string {
  return matchCursorStateIdFromFileName(fileName);
}

export function getDisplaySize(skinState: CursorSkinStateLike | null | undefined): number {
  if (!skinState?.image) return DEFAULT_BOX_SIZE;
  if (skinState.size?.mode === "fixedBox") return skinState.size.boxSize || DEFAULT_BOX_SIZE;
  return Math.max(skinState.image.width || DEFAULT_BOX_SIZE, skinState.image.height || DEFAULT_BOX_SIZE);
}

export function getResolvedSkinState(
  cursorSkin: CursorSkinLike | null | undefined,
  stateId: string,
): { state: CursorSkinStateLike | null; inherited: boolean } {
  const ownState = cursorSkin?.states?.[stateId];
  if (ownState) return { state: ownState, inherited: false };
  return { state: cursorSkin?.states?.default || null, inherited: stateId !== "default" };
}

export function buildSkinStateFromAsset(asset: LegacyCursorAsset): CursorSkinStateLike {
  const dataUrl = asset.imageDataUrl || "";
  return {
    image: {
      kind: "dataUrl",
      mimeType: asset.mimeType || inferMimeType(dataUrl),
      dataUrl,
      width: asset.sourceWidth || asset.size || DEFAULT_BOX_SIZE,
      height: asset.sourceHeight || asset.size || DEFAULT_BOX_SIZE,
    },
    hotspot: { x: asset.hotspotX ?? 0, y: asset.hotspotY ?? 0 },
    size: { mode: "fixedBox", boxSize: asset.size || DEFAULT_BOX_SIZE },
  };
}

export function getDefaultHotspot(
  stateMeta: Pick<CursorStateMeta, "defaultHotspot"> | null | undefined,
  width: number,
  height: number,
): Hotspot {
  if (stateMeta?.defaultHotspot === "center") {
    return { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  }
  return { x: Math.min(10, Math.max(0, width - 1)), y: Math.min(8, Math.max(0, height - 1)) };
}
