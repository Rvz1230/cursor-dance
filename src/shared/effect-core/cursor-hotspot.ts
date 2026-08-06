/**
 * 指向点（hotspot）统一以 **0–1 归一化分数** 存储与传递。
 *
 * 为什么不是像素：渲染尺寸并不等于原图尺寸。`cursor-overlay` 会把尺寸夹到 24–96
 * (`clamp(size, 24, 96)`)，`fixedBox` 模式下更是直接换成 boxSize。所以「原图第 64 像素」
 * 这个说法在渲染时没有唯一答案——只有分数在「编辑器预览」「运行时渲染」「导出」三处
 * 同时成立，换算集中在渲染那一处（乘以**夹取之后**的实际渲染尺寸）。
 *
 * 这正是原缺陷的成因：编辑器按原图比例定位红点，运行时却把同一个值当 CSS px 直接减，
 * 且没跟着被夹后的尺寸换算。128×128 的图配 fixedBox 32 时，正确偏移是 16px，
 * 运行时减了 64px——偏出一个半光标身位。
 *
 * 最新领域模型只接受归一化分数；像素缓存只能在明确的素材导入边界调用
 * `hotspotFromImagePixels`。不再根据数值范围猜测旧格式。
 */

/** 原图尺寸未知时的回落值，与 cursor-overlay / cursorSkinModel 的既有 `|| 48` 一致。 */
const FALLBACK_IMAGE_SIZE = 48;

export interface HotspotLike {
  x?: unknown;
  y?: unknown;
}

export interface Hotspot {
  x: number;
  y: number;
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function positiveSize(value: unknown): number {
  const size = finite(value, FALLBACK_IMAGE_SIZE);
  return size > 0 ? size : FALLBACK_IMAGE_SIZE;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * 读出并夹取归一化指向点。不负责识别或迁移旧像素格式。
 */
export function normalizeHotspot(
  hotspot: HotspotLike | null | undefined,
): Hotspot {
  const rawX = finite(hotspot?.x);
  const rawY = finite(hotspot?.y);
  return {
    x: clamp01(rawX),
    y: clamp01(rawY),
  };
}

/** 分数 → 原图像素。UI 仍然按像素展示，用户的心智模型不变。 */
export function hotspotToImagePixels(
  hotspot: Hotspot,
  imageWidth?: unknown,
  imageHeight?: unknown,
): Hotspot {
  const width = positiveSize(imageWidth);
  const height = positiveSize(imageHeight);
  return {
    x: Math.min(Math.round(hotspot.x * width), Math.max(0, width - 1)),
    y: Math.min(Math.round(hotspot.y * height), Math.max(0, height - 1)),
  };
}

/** 原图像素 → 分数。编辑器的拖拽 / 方向键 / 数值框都经这里回写。 */
export function hotspotFromImagePixels(
  pixels: Hotspot,
  imageWidth?: unknown,
  imageHeight?: unknown,
): Hotspot {
  return {
    x: clamp01(finite(pixels.x) / positiveSize(imageWidth)),
    y: clamp01(finite(pixels.y) / positiveSize(imageHeight)),
  };
}

/**
 * 渲染时的唯一换算点：分数 × **实际渲染尺寸**（已夹取过的那个），得到要减掉的 CSS px。
 */
export function hotspotOffsetPx(hotspot: Hotspot, renderedSize: number): Hotspot {
  const size = finite(renderedSize, FALLBACK_IMAGE_SIZE);
  return { x: hotspot.x * size, y: hotspot.y * size };
}
