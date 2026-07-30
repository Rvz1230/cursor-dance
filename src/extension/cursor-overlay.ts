import {
  createCursorOverlay,
  cursorSkinStateToOverlayState,
  type CursorOverlayModule,
  type CursorOverlayRenderState,
} from "@/shared/effect-runtime/cursor-overlay";

interface ExtensionCursorConfigStore {
  isCurrentSiteEnabled(): boolean;
  getActiveScheme(): unknown;
  resolveCursorStateId(target: unknown): string;
  getEffectiveCursorStateConfig(scheme: unknown, stateId: string): unknown;
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
    const scheme = runtime.configStore.getActiveScheme();
    const stateId = runtime.configStore.resolveCursorStateId(target);
    const state = runtime.configStore.getEffectiveCursorStateConfig(scheme, stateId);
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

const runtimeGlobal = globalThis as typeof globalThis & {
  CursorDanceContentModules?: Record<string, unknown>;
};
runtimeGlobal.CursorDanceContentModules ||= {};
runtimeGlobal.CursorDanceContentModules.createCursorOverlay = createContentCursorOverlay;
