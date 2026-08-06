// Shared software-cursor DOM renderer. Context resolution stays in the
// desktop overlay or extension adapter; this module only renders normalized
// coordinates and cursor state.

import { hotspotOffsetPx } from "@/shared/effect-core/cursor-hotspot";
import type { CursorSkinState } from "@/shared/domain/cursor-dance";

export interface CursorOverlayState {
  imageDataUrl?: string;
  size?: number;
  /** 归一化 0–1 的指向点。刻意不叫 hotspotX/Y：改名强制每个调用点重新审视一遍单位。 */
  hotspotNormX?: number;
  hotspotNormY?: number;
}

export interface CursorOverlayModule {
  syncStateCursorOverlay(x: number, y: number, cursorState?: CursorOverlayState): void;
  clearStateCursorOverlay(): void;
}

export interface CursorOverlayRenderState {
  stateCursorNode?: HTMLElement | null;
  stateCursorImg?: HTMLImageElement | null;
}

export interface CursorOverlayDeps {
  document: Document;
  constants: { HIDE_CURSOR_CLASS: string };
  state: CursorOverlayRenderState;
  visualEffects: { ensureRoot(): HTMLElement };
}

export function cursorSkinStateToOverlayState(
  state: CursorSkinState | null | undefined,
  resolveImageSource: (image: unknown) => string = (image) => {
    if (!image || typeof image !== "object") return "";
    const candidate = image as { kind?: unknown; dataUrl?: unknown };
    return candidate.kind === "dataUrl" && typeof candidate.dataUrl === "string"
      ? candidate.dataUrl
      : "";
  },
): CursorOverlayState | undefined {
  if (!state) return undefined;
  const imageDataUrl = resolveImageSource(state.image);
  if (!imageDataUrl) return undefined;
  const imageWidth = state.image.width || 48;
  const imageHeight = state.image.height || 48;
  const sourceSize = Math.max(imageWidth || 48, imageHeight || 48);
  const fixedSize = state.size.boxSize || 48;
  const size = state.size.mode === "fixedBox" ? fixedSize : sourceSize;
  return {
    imageDataUrl,
    size,
    hotspotNormX: state.hotspot.x,
    hotspotNormY: state.hotspot.y,
  };
}

export function createCursorOverlay(deps: CursorOverlayDeps): CursorOverlayModule {
  const { document, constants, state, visualEffects } = deps;

  function ensureStateCursorNode(): HTMLElement {
    if (state.stateCursorNode && state.stateCursorImg) return state.stateCursorNode;
    const node = document.createElement("div");
    node.className = "cd-state-cursor";
    node.hidden = true;
    const img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    node.append(img);
    visualEffects.ensureRoot().append(node);
    state.stateCursorNode = node;
    state.stateCursorImg = img;
    return node;
  }

  function clearStateCursorOverlay(): void {
    document.documentElement.classList.remove(constants.HIDE_CURSOR_CLASS);
    if (state.stateCursorNode) {
      state.stateCursorNode.hidden = true;
    }
  }

  function syncStateCursorOverlay(x: number, y: number, cursorState?: CursorOverlayState): void {
    if (!cursorState?.imageDataUrl) {
      clearStateCursorOverlay();
      return;
    }

    const cursorNode = ensureStateCursorNode();
    const cursorSize = Math.max(24, Math.min(96, cursorState.size || 48));
    cursorNode.hidden = false;
    cursorNode.style.width = `${cursorSize}px`;
    cursorNode.style.height = `${cursorSize}px`;
    // 指向点换算的唯一去处：分数 × cursorSize。必须用夹取之后的 cursorSize，
    // 因为它才是图片真正被渲染成的尺寸。
    const offset = hotspotOffsetPx(
      { x: cursorState.hotspotNormX || 0, y: cursorState.hotspotNormY || 0 },
      cursorSize,
    );
    cursorNode.style.transform = `translate3d(${x - offset.x}px, ${y - offset.y}px, 0)`;

    if (state.stateCursorImg && state.stateCursorImg.src !== cursorState.imageDataUrl) {
      state.stateCursorImg.src = cursorState.imageDataUrl;
    }

    document.documentElement.classList.add(constants.HIDE_CURSOR_CLASS);
  }

  return {
    clearStateCursorOverlay,
    syncStateCursorOverlay,
  };
}
