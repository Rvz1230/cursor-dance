import { useEffect } from "react";
import {
  clearLivePreviewConfig,
  hydrateWorkbenchState,
  readActiveSiteContext,
  readEditorState,
  readExtensionConfig,
  readRecentCursorAssets,
  subscribeExtensionConfig,
} from "../../lib/workbenchConfig";
import { CURSOR_STATES } from "../../model/workbenchSchema";
import { resolveWorkbenchEditorHydration } from "./workbenchEditorHydration";
import type { WorkbenchPersistenceContext } from "./workbenchPersistenceTypes";

const AVAILABLE_CURSOR_STATE_IDS = CURSOR_STATES.map((state) => state.id);

export function useWorkbenchHydration({
  stateRef,
  dispatch,
  configRef,
}: WorkbenchPersistenceContext): void {
  useEffect(() => {
    let cancelled = false;

    function clearPreviewOnPageHide() {
      void clearLivePreviewConfig();
    }

    async function hydrate() {
      const [config, site, recentCursorAssets, storedEditor] = await Promise.all([
        readExtensionConfig(),
        readActiveSiteContext(),
        readRecentCursorAssets(),
        readEditorState(),
      ]);
      if (cancelled) return;
      configRef.current = config;

      const hydratedState = hydrateWorkbenchState(config, site);
      const editorHydration = resolveWorkbenchEditorHydration({
        currentEditor: stateRef.current.editor,
        storedEditor,
        themes: hydratedState.domain.themes,
        configActiveThemeId: config.activeThemeId,
        availableCursorStateIds: AVAILABLE_CURSOR_STATE_IDS,
      });
      hydratedState.domain.activeThemeId = editorHydration.activeThemeId;
      if (editorHydration.hasUnsavedThemeSelection) {
        hydratedState.status.unsaved = true;
      }

      dispatch({
        type: "hydrate",
        payload: {
          ...hydratedState,
          editor: editorHydration.editor,
          runtime: { ...hydratedState.runtime, recentCursorAssets },
        },
      });
    }

    void hydrate();
    window.addEventListener("pagehide", clearPreviewOnPageHide);

    const unsubscribe = subscribeExtensionConfig(async (nextConfig) => {
      const site = await readActiveSiteContext();
      configRef.current = nextConfig;
      if (cancelled || stateRef.current.status.unsaved) return;
      dispatch({ type: "hydrate", payload: hydrateWorkbenchState(nextConfig, site) });
    });

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("pagehide", clearPreviewOnPageHide);
      void clearLivePreviewConfig();
    };
  }, [configRef, dispatch, stateRef]);
}
