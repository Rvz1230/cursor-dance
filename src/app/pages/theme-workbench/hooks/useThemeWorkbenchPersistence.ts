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
} from "../lib/workbenchConfig";
import { CURSOR_STATES } from "../model/workbenchSchema";
import { hasWorkbenchTheme } from "./workbenchThemeSelectors";

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
      const editor = { ...stateRef.current.editor };

      // Apply editor state from separate storage on top of config defaults,
      // so navigation context (workspace, theme, action, cursor) survives refresh
      // without requiring an explicit Save.
      if (editorState) {
        const ws = editorState.workspaceId;
        if (ws === "workbench" || ws === "states" || ws === "sites" || ws === "diagnostics" || ws === "keyboard") {
          editor.workspaceId = ws;
        }
        const tid = editorState.themeId;
        if (tid && hasWorkbenchTheme(hydratedState.domain.themes, tid)) {
          hydratedState.domain.activeThemeId = tid;
          if (tid !== config.activeThemeId) {
            hydratedState.status.unsaved = true;
          }
        }
        const aid = editorState.actionId;
        if (aid && ["leftClick", "rightClick", "doubleClick", "longPress", "wheel", "hover"].includes(aid)) {
          editor.actionId = aid;
        }
        // 只恢复当前平台真正可达的状态；存量的已移除槽位（grab / crosshair /
        // resize* 等）会落回默认选中项。旧的 wait→busy 别名补丁已不需要——
        // 运行时现在直接产出 busy。
        const csid = editorState.cursorStateId;
        if (csid && CURSOR_STATES.some((state) => state.id === csid)) {
          editor.cursorStateId = csid;
        }
      }

      dispatch({
        type: "hydrate",
        payload: {
          ...hydratedState,
          editor,
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
  }, [configRef, dispatch]);

  useEffect(() => {
    if (!state.status.isHydrated) return;

    if (!state.status.unsaved) {
      void clearLivePreviewConfig();
      return;
    }

    if (!configRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const latestState = stateRef.current;
      const baseConfig = configRef.current;
      if (!baseConfig || !latestState.status.unsaved) return;
      void writeLivePreviewConfig(buildStoredConfigFromWorkbench(baseConfig, latestState));
    }, 180);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    configRef,
    state.status.isHydrated,
    state.status.unsaved,
    state.domain.enabled,
    state.domain.activeThemeId,
    state.domain.siteRules,
    state.domain.appRules,
    state.domain.themes,
  ]);

  // Auto-save new themes so they survive page refresh without manual save
  const prevThemeCountRef = useRef(0);

  useEffect(() => {
    if (!state.status.isHydrated) return;
    const currentLen = state.domain.themes.length;
    if (prevThemeCountRef.current === 0) {
      prevThemeCountRef.current = currentLen;
      return;
    }
    if (currentLen > prevThemeCountRef.current) {
      const baseConfig = configRef.current;
      if (!baseConfig) return;
      const latestState = stateRef.current;
      const nextConfig = buildStoredConfigFromWorkbench(baseConfig, latestState);
      writeExtensionConfig(nextConfig).then((savedConfig) => {
        configRef.current = savedConfig;
      }).catch(() => {});
    }
    prevThemeCountRef.current = currentLen;
  }, [state.domain.themes, state.status.isHydrated, configRef]);

  // Auto-save editor navigation state on every navigation change,
  // so workspace/theme/action/cursor selection survives page refresh.
  const prevEditorStateKey = useRef("");

  useEffect(() => {
    if (!state.status.isHydrated) return;

    const key = `${state.editor.workspaceId}::${state.domain.activeThemeId}::${state.editor.actionId}::${state.editor.cursorStateId}`;
    if (key === prevEditorStateKey.current) return;
    prevEditorStateKey.current = key;

    if (editorStateDebounceRef.current) clearTimeout(editorStateDebounceRef.current);
    editorStateDebounceRef.current = setTimeout(() => {
      void writeEditorState({
        workspaceId: stateRef.current.editor.workspaceId,
        themeId: stateRef.current.domain.activeThemeId,
        actionId: stateRef.current.editor.actionId,
        cursorStateId: stateRef.current.editor.cursorStateId,
      });
    }, 300);

    return () => {
      if (editorStateDebounceRef.current) clearTimeout(editorStateDebounceRef.current);
    };
  }, [
    state.status.isHydrated,
    state.editor.workspaceId,
    state.domain.activeThemeId,
    state.editor.actionId,
    state.editor.cursorStateId,
  ]);

  // enabled 开关变更 → 立即持久化（不等"保存"按钮），
  // 否则 overlay 重启后从 electron-store 读到旧值，动效不触发。
  const prevEnabledRef = useRef(state.domain.enabled);
  useEffect(() => {
    if (!state.status.isHydrated) return;
    if (state.domain.enabled === prevEnabledRef.current) return;
    prevEnabledRef.current = state.domain.enabled;
    const baseConfig = configRef.current;
    if (!baseConfig) return;
    const nextConfig = buildStoredConfigFromWorkbench(baseConfig, stateRef.current);
    writeExtensionConfig(nextConfig).then((savedConfig) => {
      configRef.current = savedConfig;
    }).catch(() => {});
  }, [state.status.isHydrated, state.domain.enabled, configRef]);
}
