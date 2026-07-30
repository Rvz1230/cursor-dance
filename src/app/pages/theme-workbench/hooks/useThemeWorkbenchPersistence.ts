import { useEffect, useRef } from "react";
import {
  buildStoredConfigFromWorkbench,
  clearLivePreviewConfig,
  hydrateWorkbenchState,
  readActiveSiteContext,
  readEditorState,
  readExtensionConfig,
  readRecentCursorAssets,
  subscribeExtensionConfig,
  writeEditorState,
  writeExtensionConfig,
  writeLivePreviewConfig,
} from "../lib/extensionConfig";

export function useThemeWorkbenchPersistence({ state, dispatch, configRef }) {
  const debounceRef = useRef(null);
  const editorStateDebounceRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;

    function clearPreviewOnPageHide() {
      void clearLivePreviewConfig();
    }

    async function hydrate() {
      const [config, site, recentCursorAssets, editorState] = await Promise.all([
        readExtensionConfig(),
        readActiveSiteContext(),
        readRecentCursorAssets(),
        readEditorState(),
      ]);
      if (cancelled) return;
      configRef.current = config;

      const hydratedState = hydrateWorkbenchState(config, site);

      // Apply editor state from separate storage on top of config defaults,
      // so navigation context (workspace, theme, action, cursor) survives refresh
      // without requiring an explicit Save.
      if (editorState) {
        const ws = editorState.workspaceId;
        if (ws === "workbench" || ws === "states" || ws === "sites" || ws === "diagnostics" || ws === "keyboard") {
          hydratedState.workspaceId = ws;
        }
        const tid = editorState.themeId;
        if (tid && hydratedState.themeLibrary.some((t) => t.id === tid)) {
          hydratedState.selection.themeId = tid;
          if (tid !== config.activeThemeId) {
            hydratedState.ui.unsaved = true;
          }
        }
        const aid = editorState.actionId;
        if (aid && ["leftClick", "rightClick", "doubleClick", "longPress", "wheel", "hover"].includes(aid)) {
          hydratedState.selection.actionId = aid;
        }
        const csid = editorState.cursorStateId;
        if (csid && ["default", "text", "pointer", "grab", "grabbing", "busy", "notAllowed", "crosshair", "move", "resizeHorizontal", "resizeVertical", "resizeDiagonalNWSE", "resizeDiagonalNESW", "wait"].includes(csid)) {
          hydratedState.selection.cursorStateId = csid === "wait" ? "busy" : csid;
        }
      }

      dispatch({ type: "hydrate", payload: { ...hydratedState, recentCursorAssets } });
    }

    void hydrate();
    window.addEventListener("pagehide", clearPreviewOnPageHide);

    const unsubscribe = subscribeExtensionConfig(async (nextConfig) => {
      const site = await readActiveSiteContext();
      configRef.current = nextConfig;
      if (cancelled || stateRef.current.ui.unsaved) return;
      dispatch({ type: "hydrate", payload: hydrateWorkbenchState(nextConfig, site) });
    });

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("pagehide", clearPreviewOnPageHide);
      void clearLivePreviewConfig();
    };
  }, [configRef, dispatch]);

  useEffect(() => {
    if (!state.ui.isHydrated) return;

    if (!state.ui.unsaved) {
      void clearLivePreviewConfig();
      return;
    }

    if (!configRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const latestState = stateRef.current;
      const baseConfig = configRef.current;
      if (!baseConfig || !latestState.ui.unsaved) return;
      void writeLivePreviewConfig(buildStoredConfigFromWorkbench(baseConfig, latestState));
    }, 180);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    configRef,
    state.ui.isHydrated,
    state.ui.unsaved,
    state.ui.enabled,
    state.selection.themeId,
    state.siteRules,
    state.appRules,
    state.themeLibrary,
    state.draftsByTheme,
  ]);

  // Auto-save new themes so they survive page refresh without manual save
  const prevThemeLibraryLengthRef = useRef(0);

  useEffect(() => {
    if (!state.ui.isHydrated) return;
    const currentLen = state.themeLibrary.length;
    if (prevThemeLibraryLengthRef.current === 0) {
      prevThemeLibraryLengthRef.current = currentLen;
      return;
    }
    if (currentLen > prevThemeLibraryLengthRef.current) {
      const baseConfig = configRef.current;
      if (!baseConfig) return;
      const latestState = stateRef.current;
      const nextConfig = buildStoredConfigFromWorkbench(baseConfig, latestState);
      writeExtensionConfig(nextConfig).then((savedConfig) => {
        configRef.current = savedConfig;
      }).catch(() => {});
    }
    prevThemeLibraryLengthRef.current = currentLen;
  }, [state.themeLibrary, state.ui.isHydrated, configRef]);

  // Auto-save editor navigation state on every navigation change,
  // so workspace/theme/action/cursor selection survives page refresh.
  const prevEditorStateKey = useRef("");

  useEffect(() => {
    if (!state.ui.isHydrated) return;

    const key = `${state.workspaceId}::${state.selection.themeId}::${state.selection.actionId}::${state.selection.cursorStateId}`;
    if (key === prevEditorStateKey.current) return;
    prevEditorStateKey.current = key;

    if (editorStateDebounceRef.current) clearTimeout(editorStateDebounceRef.current);
    editorStateDebounceRef.current = setTimeout(() => {
      void writeEditorState({
        workspaceId: stateRef.current.workspaceId,
        themeId: stateRef.current.selection.themeId,
        actionId: stateRef.current.selection.actionId,
        cursorStateId: stateRef.current.selection.cursorStateId,
      });
    }, 300);

    return () => {
      if (editorStateDebounceRef.current) clearTimeout(editorStateDebounceRef.current);
    };
  }, [
    state.ui.isHydrated,
    state.workspaceId,
    state.selection.themeId,
    state.selection.actionId,
    state.selection.cursorStateId,
  ]);

  // enabled 开关变更 → 立即持久化（不等"保存"按钮），
  // 否则 overlay 重启后从 electron-store 读到旧值，动效不触发。
  const prevEnabledRef = useRef(state.ui.enabled);
  useEffect(() => {
    if (!state.ui.isHydrated) return;
    if (state.ui.enabled === prevEnabledRef.current) return;
    prevEnabledRef.current = state.ui.enabled;
    const baseConfig = configRef.current;
    if (!baseConfig) return;
    const nextConfig = buildStoredConfigFromWorkbench(baseConfig, stateRef.current);
    writeExtensionConfig(nextConfig).then((savedConfig) => {
      configRef.current = savedConfig;
    }).catch(() => {});
  }, [state.ui.isHydrated, state.ui.enabled, configRef]);
}
