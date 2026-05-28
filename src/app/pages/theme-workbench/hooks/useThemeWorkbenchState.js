import { useEffect, useMemo, useReducer, useRef } from "react";
import {
  ACTIONS,
  CURSOR_STATES,
  WORKSPACES,
  buildDefaultCursorStateActions,
  buildDefaultCursorStateAssets,
  createThemeDraft,
  getConflictsForAction,
} from "../model/workbenchSchema.js";
import {
  buildStoredThemePackFromWorkbench,
  buildPreviewThemePackFromWorkbench,
  buildStoredConfigFromWorkbench,
  buildThemeExportPayload,
  clearLivePreviewConfig,
  downloadThemePackExport,
  draftFromThemePack,
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

  function discardThemeChanges(themeId) {
    const storedConfig = configRef.current;
    const themePack = storedConfig?.themePacks?.find((tp) => tp.id === themeId);
    const draft = themePack ? draftFromThemePack(themePack) : createThemeDraft(themeId);
    dispatch({ type: "theme/discard-changes", payload: { themeId, draft } });
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
      siteRules: [],
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

  function renameTheme(themeId, name) {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const exists = state.themeLibrary.some(
      (theme) => theme.id !== themeId && theme.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) return false;
    dispatch({ type: "theme/library-rename", payload: { themeId, name: trimmed } });
    return true;
  }

  function updateThemeIcon(themeId, icon) {
    dispatch({ type: "theme/library-update-icon", payload: { themeId, icon } });
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
    discardThemeChanges,
    previewActiveTheme,
    createTheme,
    duplicateTheme,
    deleteTheme,
    exportTheme,
    importThemeFromText,
    renameTheme,
    updateThemeIcon,
    resetCurrentTheme: () => dispatch({ type: "theme/reset-current" }),
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
    updateActionConfigs: (patchesByActionId) =>
      updateCurrentTheme((current) => ({
        ...current,
        actionConfigs: Object.entries(patchesByActionId || {}).reduce(
          (nextActionConfigs, [actionId, patch]) => ({
            ...nextActionConfigs,
            [actionId]: {
              ...nextActionConfigs[actionId],
              ...patch,
            },
          }),
          current.actionConfigs
        ),
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
    addSiteRule: (rule) => dispatch({ type: "site-rules/add", payload: rule }),
    updateSiteRule: (id, updates) => dispatch({ type: "site-rules/update", payload: { id, updates } }),
    deleteSiteRule: (id) => dispatch({ type: "site-rules/delete", payload: id }),
    reorderSiteRules: (from, to) => dispatch({ type: "site-rules/reorder", payload: { from, to } }),
    toggleSiteRule: (id) => dispatch({ type: "site-rules/toggle", payload: id }),
    clearAllSiteRules: () => dispatch({ type: "site-rules/clear-all" }),
  };
}
