import type { LucideIcon } from "lucide-react";
import { matchCursorStateIdFromFileName } from "@/shared/cursor-states";
import { hotspotFromImagePixels, hotspotToImagePixels, type Hotspot } from "@/shared/effect-core/cursor-hotspot";
import type { CursorImageMimeType, CursorSkin, CursorSkinState } from "@/shared/domain/cursor-dance";
import { validateCursorAssetFile } from "../../lib/cursorAssetPresets";
import type { CursorAssetDraft } from "../../lib/storage/repository/types";

const MAX_CURSOR_UPLOAD_BYTES = 300 * 1024;
export const DEFAULT_BOX_SIZE = 48;

/** 指向点是 0–1 归一化分数，语义与换算见 `shared/effect-core/cursor-hotspot.ts`。 */
export type { Hotspot };

/** Workbench 侧的状态元信息（真值源 + UI 图标），见 `model/workbenchSchema.ts`。 */
export interface CursorStateMeta {
  id: string;
  label: string;
  detail: string;
  defaultHotspot: "topLeft" | "center";
  icon: LucideIcon;
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("文件读取失败")));
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

function getAssetDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || DEFAULT_BOX_SIZE, height: image.naturalHeight || DEFAULT_BOX_SIZE });
    image.onerror = () => resolve({ width: DEFAULT_BOX_SIZE, height: DEFAULT_BOX_SIZE });
    image.src = dataUrl;
  });
}

function inferMimeType(dataUrl: string, fileType = ""): CursorImageMimeType {
  if (["image/png", "image/svg+xml", "image/webp", "image/unknown"].includes(fileType)) {
    return fileType as CursorImageMimeType;
  }
  if (dataUrl.startsWith("data:image/svg+xml")) return "image/svg+xml";
  if (dataUrl.startsWith("data:image/webp")) return "image/webp";
  if (dataUrl.startsWith("data:image/png")) return "image/png";
  return "image/unknown";
}

export function matchStateId(fileName: string): string {
  return matchCursorStateIdFromFileName(fileName);
}

export interface CursorBatchPlanItem {
  fileIndex: number;
  stateIds: string[];
  pending: boolean;
}

/**
 * 批量导入必须先建立主皮肤，再分配独立槽位。
 * 没有 default 命名文件时用第一张素材建立主皮肤；重复状态与未识别文件进入待分配区。
 */
export function planCursorBatchImport(fileNames: readonly string[], hasMaster: boolean): CursorBatchPlanItem[] {
  const matches = fileNames.map(matchStateId);
  const seedIndex = hasMaster ? -1 : Math.max(0, matches.findIndex((stateId) => stateId === "default"));
  const occupied = new Set<string>();
  const plan = fileNames.map((_, fileIndex) => ({ fileIndex, stateIds: [] as string[], pending: false }));

  if (seedIndex >= 0 && plan[seedIndex]) {
    plan[seedIndex].stateIds.push("default");
    occupied.add("default");
  }

  matches.forEach((stateId, fileIndex) => {
    if (!stateId) {
      plan[fileIndex].pending = fileIndex !== seedIndex;
      return;
    }
    if (occupied.has(stateId)) {
      if (!plan[fileIndex].stateIds.length) plan[fileIndex].pending = true;
      return;
    }
    plan[fileIndex].stateIds.push(stateId);
    occupied.add(stateId);
  });

  return plan;
}

export async function buildCursorAssetDraftFromFile(
  file: File,
  stateMeta?: Pick<CursorStateMeta, "defaultHotspot"> | null,
  pending = false,
): Promise<CursorAssetDraft> {
  const validationMessage = validateCursorAssetFile(file, MAX_CURSOR_UPLOAD_BYTES);
  if (validationMessage) throw new Error(validationMessage);
  const dataUrl = await readFileAsDataUrl(file);
  const dimensions = await getAssetDimensions(dataUrl);
  const hotspot = getDefaultHotspot(stateMeta);
  const hotspotPixels = hotspotToImagePixels(hotspot, dimensions.width, dimensions.height);
  return {
    imageDataUrl: dataUrl,
    mimeType: inferMimeType(dataUrl, file.type),
    hotspotX: hotspotPixels.x,
    hotspotY: hotspotPixels.y,
    size: DEFAULT_BOX_SIZE,
    sourceWidth: dimensions.width,
    sourceHeight: dimensions.height,
    name: file.name,
    pending,
  };
}

export function getDisplaySize(skinState: CursorSkinState | null | undefined): number {
  if (!skinState?.image) return DEFAULT_BOX_SIZE;
  if (skinState.size?.mode === "fixedBox") return skinState.size.boxSize || DEFAULT_BOX_SIZE;
  return Math.max(skinState.image.width || DEFAULT_BOX_SIZE, skinState.image.height || DEFAULT_BOX_SIZE);
}

export function getResolvedSkinState(
  cursorSkin: CursorSkin | null | undefined,
  stateId: string,
): { state: CursorSkinState | null; inherited: boolean } {
  const ownState = cursorSkin?.states?.[stateId];
  if (ownState) return { state: ownState, inherited: false };
  return { state: cursorSkin?.states?.default || null, inherited: stateId !== "default" };
}

export function buildSkinStateFromAsset(asset: CursorAssetDraft): CursorSkinState {
  const dataUrl = asset.imageDataUrl || "";
  const width = asset.sourceWidth || asset.size || DEFAULT_BOX_SIZE;
  const height = asset.sourceHeight || asset.size || DEFAULT_BOX_SIZE;
  return {
    image: {
      kind: "dataUrl",
      mimeType: inferMimeType(dataUrl, asset.mimeType),
      dataUrl,
      width,
      height,
    },
    // 最近素材缓存使用原图像素；进入领域模型时统一折算成分数。
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
