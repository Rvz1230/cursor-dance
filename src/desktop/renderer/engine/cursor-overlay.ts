// CursorDance 软件光标渲染层
//
// 从 extension/content-runtime/cursor-overlay.js 迁移而来（任务 2.2）。
// 关键调整：
//   - 去 IIFE，改为 export function createCursorOverlay(deps)
//   - syncStateCursorOverlay 不再消费 DOM Event。坐标 + 已解析的目标光标
//     由调用方传入（CursorOverlayState | undefined）。这样：
//       * 桌面端可以从主进程的 IPC 包里拿到屏幕坐标，没有 DOM event 可用；
//       * 站点/状态解析（isCurrentSiteEnabled / resolveCursorStateId 等）
//         留在更高层，引擎本身不再依赖 configStore。
//   - DOM 元素创建逻辑、HIDE_CURSOR_CLASS 切换、size 钳位 [24, 96]、
//     transform 公式全部原样保留。

import type {
  CursorOverlayModule,
  CursorOverlayState,
  EngineConstants,
  EngineState,
  VisualEffectsModule,
} from "./types";

export interface CursorOverlayDeps {
  document: Document;
  constants: EngineConstants;
  state: EngineState;
  visualEffects: VisualEffectsModule;
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
