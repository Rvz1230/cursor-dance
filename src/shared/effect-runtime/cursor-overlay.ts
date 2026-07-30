// Shared software-cursor DOM renderer. Context resolution stays in the
// desktop overlay or extension adapter; this module only renders normalized
// coordinates and cursor state.

export interface CursorOverlayState {
  imageDataUrl?: string;
  size?: number;
  hotspotX?: number;
  hotspotY?: number;
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
  value: unknown,
  resolveImageSource: (image: unknown) => string = (image) => {
    if (!image || typeof image !== "object") return "";
    const candidate = image as { kind?: unknown; dataUrl?: unknown };
    return candidate.kind === "dataUrl" && typeof candidate.dataUrl === "string"
      ? candidate.dataUrl
      : "";
  },
): CursorOverlayState | undefined {
  if (!value || typeof value !== "object") return undefined;
  const state = value as {
    image?: { width?: unknown; height?: unknown };
    size?: { mode?: unknown; boxSize?: unknown };
    hotspot?: { x?: unknown; y?: unknown };
  };
  const imageDataUrl = resolveImageSource(state.image);
  if (!imageDataUrl) return undefined;
  const imageWidth = typeof state.image?.width === "number" ? state.image.width : 48;
  const imageHeight = typeof state.image?.height === "number" ? state.image.height : 48;
  const sourceSize = Math.max(imageWidth || 48, imageHeight || 48);
  const fixedSize = typeof state.size?.boxSize === "number" ? state.size.boxSize : 48;
  const size = state.size?.mode === "fixedBox" ? (fixedSize || 48) : sourceSize;
  return {
    imageDataUrl,
    size,
    hotspotX: typeof state.hotspot?.x === "number" ? state.hotspot.x : 0,
    hotspotY: typeof state.hotspot?.y === "number" ? state.hotspot.y : 0,
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
    cursorNode.style.transform = `translate3d(${x - (cursorState.hotspotX || 0)}px, ${y - (cursorState.hotspotY || 0)}px, 0)`;

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
