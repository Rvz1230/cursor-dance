import {
  createCursorOverlay,
  cursorSkinStateToOverlayState,
  type CursorOverlayModule,
  type CursorOverlayRenderState,
} from "@/shared/effect-runtime/cursor-overlay";
import type { CursorSkinState } from "@/shared/domain/cursor-dance";

interface ExtensionCursorConfigStore {
  isCurrentSiteEnabled(): boolean;
  getActiveTheme(): unknown;
  resolveCursorStateId(target: unknown): string;
  getEffectiveCursorStateConfig(theme: unknown, stateId: string): CursorSkinState | null;
}

interface ContentCursorOverlayRuntime {
  document: Document;
  constants: { HIDE_CURSOR_CLASS: string };
  state: CursorOverlayRenderState;
  configStore: ExtensionCursorConfigStore;
  visualEffects: { ensureRoot(): HTMLElement };
}

export interface ContentCursorOverlay {
  syncStateCursorOverlay(event: Pick<PointerEvent, "clientX" | "clientY" | "target">): void;
  clearStateCursorOverlay(): void;
}

export function createContentCursorOverlay(runtime: ContentCursorOverlayRuntime): ContentCursorOverlay {
  const renderer: CursorOverlayModule = createCursorOverlay(runtime);

  function syncStateCursorOverlay(event: Pick<PointerEvent, "clientX" | "clientY" | "target">): void {
    if (!runtime.configStore.isCurrentSiteEnabled()) {
      renderer.clearStateCursorOverlay();
      return;
    }
    const ElementCtor = runtime.document.defaultView?.Element;
    const target = ElementCtor && event.target instanceof ElementCtor ? event.target : runtime.document.body;
    const theme = runtime.configStore.getActiveTheme();
    const stateId = runtime.configStore.resolveCursorStateId(target);
    const state = runtime.configStore.getEffectiveCursorStateConfig(theme, stateId);
    renderer.syncStateCursorOverlay(
      event.clientX,
      event.clientY,
      cursorSkinStateToOverlayState(state),
    );
  }

  return {
    syncStateCursorOverlay,
    clearStateCursorOverlay: renderer.clearStateCursorOverlay,
  };
}
