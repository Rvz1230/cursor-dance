import type { LucideIcon } from "lucide-react";
import { matchCursorStateIdFromFileName } from "@/shared/cursor-states";
import { hotspotFromImagePixels, type Hotspot } from "@/shared/effect-core/cursor-hotspot";

export const MAX_CURSOR_UPLOAD_BYTES = 300 * 1024;
export const DEFAULT_BOX_SIZE = 48;

/** 指向点是 0–1 归一化分数，语义与换算见 `shared/effect-core/cursor-hotspot.ts`。 */
export type { Hotspot };

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
  const width = asset.sourceWidth || asset.size || DEFAULT_BOX_SIZE;
  const height = asset.sourceHeight || asset.size || DEFAULT_BOX_SIZE;
  return {
    image: {
      kind: "dataUrl",
      mimeType: asset.mimeType || inferMimeType(dataUrl),
      dataUrl,
      width,
      height,
    },
    // LegacyCursorAsset 是扁平的旧素材形状，hotspotX/Y 一直是原图像素，
    // 在这个边界上折算成分数。
    hotspot: hotspotFromImagePixels(
      { x: asset.hotspotX ?? 0, y: asset.hotspotY ?? 0 },
      width,
      height,
    ),
    size: { mode: "fixedBox", boxSize: asset.size || DEFAULT_BOX_SIZE },
  };
}

/**
 * 推荐指向点，返回归一化分数。
 *
 * `topLeft` 沿用历史上按 48px 素材定的箭头尖位置（10, 8），折算成分数后
 * 才对任意尺寸的素材都成立——这正是像素存储换成分数存储的收益。
 */
const TIP_HOTSPOT: Hotspot = { x: 10 / DEFAULT_BOX_SIZE, y: 8 / DEFAULT_BOX_SIZE };

export function getDefaultHotspot(
  stateMeta: Pick<CursorStateMeta, "defaultHotspot"> | null | undefined,
): Hotspot {
  if (stateMeta?.defaultHotspot === "center") return { x: 0.5, y: 0.5 };
  return { ...TIP_HOTSPOT };
}
