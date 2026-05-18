import { useEffect, useMemo, useReducer, useRef } from "react";
import {
  ACTIONS,
  CURSOR_STATES,
  WORKSPACES,
  buildDefaultCursorStateActions,
  buildDefaultCursorStateAssets,
  getConflictsForAction,
} from "../model/workbenchSchema.js";
import {
  buildStoredThemePackFromWorkbench,
  buildPreviewThemePackFromWorkbench,
  buildStoredConfigFromWorkbench,
  buildThemeExportPayload,
  clearLivePreviewConfig,
  downloadThemePackExport,
  previewThemePack,
  readExtensionConfig,
  writeRecentCursorAsset,
  writeExtensionConfig,
} from "../lib/extensionConfig.js";
import {
  buildCreateThemePayload,
  buildDeleteThemePlan,
  buildDuplicateThemePayload,
  buildImportedThemePayload,
} from "../lib/themeWorkbenchThemeLifecycle.js";
import {
  INITIAL_THEME_STATE,
  initialState,
  reducer,
} from "./themeWorkbenchStateStore.js";
import { useThemeWorkbenchPersistence } from "./useThemeWorkbenchPersistence.js";

export function useThemeWorkbenchState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const configRef = useRef(null);
  useThemeWorkbenchPersistence({ state, dispatch, configRef });

  const selected = state.selection;
  const activeTheme = useMemo(
    () => state.themeLibrary.find((item) => item.id === selected.themeId) ?? state.themeLibrary[0] ?? INITIAL_THEME_STATE.themeLibrary[0],
    [selected.themeId, state.themeLibrary]
  );
  const draft = state.draftsByTheme[selected.themeId];
  const currentActionConfig = draft.actionConfigs[selected.actionId];
  const currentConflicts = getConflictsForAction(selected.actionId, draft.actionConfigs);
  const isWorkbench = state.workspaceId === "workbench";

  function updateCurrentTheme(updater) {
    dispatch({ type: "theme/update-current", payload: updater });
  }

  async function saveChanges() {
    dispatch({ type: "save/start" });
    try {
      const nextConfig = buildStoredConfigFromWorkbench(configRef.current ?? (await readExtensionConfig()), state);
      const savedConfig = await writeExtensionConfig(nextConfig);
      await clearLivePreviewConfig();
      configRef.current = savedConfig;
      dispatch({ type: "save/success" });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败，请重试";
      dispatch({ type: "save/error", payload: message });
      return { ok: false, error: message };
    }
  }

  async function previewActiveTheme() {
    const currentConfig = configRef.current ?? (await readExtensionConfig());
    const previewTheme = buildPreviewThemePackFromWorkbench(currentConfig, state);
    await previewThemePack(selected.themeId, previewTheme, selected.actionId);
  }

  async function rememberRecentCursorAsset(assetRecord) {
    const nextRecentAssets = await writeRecentCursorAsset(assetRecord);
    dispatch({ type: "recent-assets/set", payload: nextRecentAssets });
  }

  function createTheme({ name, description = "", basedOnThemeId = "blank" }) {
    dispatch({
      type: "theme/library-add",
      payload: buildCreateThemePayload(
        { themeLibrary: state.themeLibrary, draftsByTheme: state.draftsByTheme },
        { name, description, basedOnThemeId }
      ),
    });
  }

  function duplicateTheme(themeId = selected.themeId) {
    const { duplicatedName, payload } = buildDuplicateThemePayload(
      { themeLibrary: state.themeLibrary, draftsByTheme: state.draftsByTheme },
      themeId
    );

    dispatch({
      type: "theme/library-add",
      payload,
    });

    return duplicatedName;
  }

  function deleteTheme(themeId = selected.themeId) {
    const { themeName, nextSelectedThemeId } = buildDeleteThemePlan(state.themeLibrary, themeId);
    dispatch({
      type: "theme/library-remove",
      payload: {
        themeId,
        nextSelectedThemeId,
      },
    });

    return themeName;
  }

  function exportTheme(themeId = selected.themeId) {
    const theme = state.themeLibrary.find((item) => item.id === themeId);
    if (!theme) {
      throw new Error("导出失败：没有找到要导出的主题。");
    }

    const previousConfig = configRef.current ?? {
      enabled: state.ui.enabled,
      activeThemePackId: state.selection.themeId,
      activeSchemeId: state.selection.themeId,
      themePacks: [],
      schemes: [],
      siteRules: { byHost: {} },
      editor: {},
    };
    const themePack = buildStoredThemePackFromWorkbench(previousConfig, state, themeId);
    const fileName = downloadThemePackExport(themePack);
    return {
      fileName,
      payload: buildThemeExportPayload(themePack),
    };
  }

  function importThemeFromText(text, fileName = "") {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("导入失败：文件不是合法的 JSON。");
    }

    dispatch({
      type: "theme/library-add",
      payload: buildImportedThemePayload(state.themeLibrary, parsed, fileName),
    });
  }

  return {
    state,
    selected,
    themes: state.themeLibrary,
    activeTheme,
    draft,
    currentActionConfig,
    currentConflicts,
    isWorkbench,
    workspaceItems: WORKSPACES,
    actionItems: ACTIONS,
    cursorStates: CURSOR_STATES,
    recentCursorAssets: state.recentCursorAssets,
    setWorkspaceId: (value) => dispatch({ type: "workspace/set", payload: value }),
    setThemeId: (value) => dispatch({ type: "theme/select", payload: value }),
    setActionId: (value) => dispatch({ type: "action/select", payload: value }),
    setCursorStateId: (value) => dispatch({ type: "cursor-state/select", payload: value }),
    setEnabled: (value) => dispatch({ type: "global-enabled/set", payload: value }),
    saveChanges,
    previewActiveTheme,
    createTheme,
    duplicateTheme,
    deleteTheme,
    exportTheme,
    importThemeFromText,
    resetCurrentTheme: () => dispatch({ type: "theme/reset-current" }),
    setSiteFilter: (value) => dispatch({ type: "site-filter/set", payload: value }),
    updateActionConfig: (patch) =>
      updateCurrentTheme((current) => ({
        ...current,
        actionConfigs: {
          ...current.actionConfigs,
          [selected.actionId]: {
            ...current.actionConfigs[selected.actionId],
            ...patch,
          },
        },
      })),
    updateCursorMode: (mode) =>
      updateCurrentTheme((current) => ({
        ...current,
        cursorModes: {
          ...current.cursorModes,
          [selected.cursorStateId]: mode,
        },
      })),
    updateCursorStateAction: (actionId) =>
      updateCurrentTheme((current) => ({
        ...current,
        cursorStateActions: {
          ...current.cursorStateActions,
          [selected.cursorStateId]: actionId,
        },
      })),
    updateCursorStateAsset: (patch) =>
      updateCurrentTheme((current) => ({
        ...current,
        cursorModes:
          selected.cursorStateId !== "default"
            ? {
                ...current.cursorModes,
                [selected.cursorStateId]: "覆盖",
              }
            : current.cursorModes,
        cursorStateAssets: {
          ...current.cursorStateAssets,
          [selected.cursorStateId]: {
            ...current.cursorStateAssets[selected.cursorStateId],
            ...patch,
          },
        },
      })),
    updateCursorStateAssetForState: (targetStateId, patch) =>
      updateCurrentTheme((current) => ({
        ...current,
        cursorModes:
          targetStateId !== "default"
            ? {
                ...current.cursorModes,
                [targetStateId]: "覆盖",
              }
            : current.cursorModes,
        cursorStateAssets: {
          ...current.cursorStateAssets,
          [targetStateId]: {
            ...current.cursorStateAssets[targetStateId],
            ...patch,
          },
        },
      })),
    rememberRecentCursorAsset,
    copyDefaultCursorStateAsset: () =>
      updateCurrentTheme((current) => ({
        ...current,
        cursorModes:
          selected.cursorStateId !== "default"
            ? {
                ...current.cursorModes,
                [selected.cursorStateId]: "覆盖",
              }
            : current.cursorModes,
        cursorStateAssets: {
          ...current.cursorStateAssets,
          [selected.cursorStateId]: {
            ...current.cursorStateAssets.default,
          },
        },
      })),
    resetCurrentCursorState: () => {
      const stateMeta = CURSOR_STATES.find((item) => item.id === selected.cursorStateId);
      if (!stateMeta) return;
      updateCurrentTheme((current) => ({
        ...current,
        cursorModes: {
          ...current.cursorModes,
          [selected.cursorStateId]: stateMeta.defaultMode,
        },
        cursorStateActions: {
          ...current.cursorStateActions,
          [selected.cursorStateId]: buildDefaultCursorStateActions()[selected.cursorStateId],
        },
        cursorStateAssets: {
          ...current.cursorStateAssets,
          [selected.cursorStateId]: buildDefaultCursorStateAssets()[selected.cursorStateId],
        },
      }));
    },
    resetAllCursorStates: () =>
      updateCurrentTheme((current) => ({
        ...current,
        cursorModes: Object.fromEntries(CURSOR_STATES.map((item) => [item.id, item.defaultMode])),
        cursorStateActions: buildDefaultCursorStateActions(),
        cursorStateAssets: buildDefaultCursorStateAssets(),
      })),
    setSiteMode: (mode) => dispatch({ type: "site-mode/set", payload: mode }),
    clearAllSiteRules: () => dispatch({ type: "site-rules/clear-all" }),
    clearFilteredSiteRules: (hosts) => dispatch({ type: "site-rules/remove-hosts", payload: hosts }),
  };
}
