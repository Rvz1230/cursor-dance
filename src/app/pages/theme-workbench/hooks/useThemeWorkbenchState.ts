import { useMemo, useReducer, useRef } from "react";
import {
  PLATFORM_ACTIONS,
  CURSOR_STATES,
  WORKSPACES,
  getConflictsForAction,
} from "../model/workbenchSchema";
import {
  buildStoredConfigFromWorkbench,
  clearLivePreviewConfig,
  readExtensionConfig,
  writeExtensionConfig,
} from "../lib/workbenchConfig";
import {
  INITIAL_THEME_STATE,
  initialState,
  reducer,
} from "./themeWorkbenchStateStore";
import { useThemeWorkbenchPersistence } from "./useThemeWorkbenchPersistence";
import { isDesktop } from "@/shared/runtime";
import { normalizeKeyFeedbackConfig } from "@/shared/config/key-feedback";
import { createWorkbenchThemeCommands } from "./workbenchThemeCommands";
import { createWorkbenchCursorCommands } from "./workbenchCursorCommands";
import type { AppRule } from "@/shared/app-rules";
import type { KeyFeedbackConfig } from "@/shared/config/key-feedback";
import type {
  SiteRule,
  WorkbenchActionConfig,
  WorkbenchConfigRef,
  WorkbenchThemeDraft,
} from "./workbenchStateTypes";

export function useThemeWorkbenchState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const configRef: WorkbenchConfigRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;
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

  function updateCurrentTheme(updater: (current: WorkbenchThemeDraft) => WorkbenchThemeDraft): void {
    dispatch({ type: "theme/update-current", payload: updater });
  }

  async function saveChanges() {
    dispatch({ type: "save/start" });
    try {
      const nextConfig = buildStoredConfigFromWorkbench(configRef.current ?? (await readExtensionConfig()), state);
      const savedConfig = await writeExtensionConfig(nextConfig);
      configRef.current = savedConfig;
      const latestState = stateRef.current;
      const hasStaleSelection = latestState.selection.themeId !== nextConfig.activeThemeId;
      if (!latestState.ui.unsaved || !hasStaleSelection) {
        await clearLivePreviewConfig();
      }
      dispatch({ type: "save/success", payload: { preserveUnsaved: hasStaleSelection } });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败，请重试";
      dispatch({ type: "save/error", payload: message });
      return { ok: false, error: message };
    }
  }

  const themeCommands = createWorkbenchThemeCommands({
    state,
    selected,
    configRef,
    dispatch,
  });
  const cursorCommands = createWorkbenchCursorCommands({
    selected,
    draft,
    updateCurrentTheme,
  });

  return {
    state,
    selected,
    themes: state.themeLibrary,
    activeTheme,
    draft,
    currentActionConfig,
    currentConflicts,
    isWorkbench,
    workspaceItems: WORKSPACES.map((item) =>
      item.id === "sites" && isDesktop()
        ? { ...item, label: "应用规则" }
        : item,
    ).filter((item) => item.id !== "keyboard" || isDesktop()),
    actionItems: PLATFORM_ACTIONS,
    cursorStates: CURSOR_STATES,
    recentCursorAssets: state.recentCursorAssets,
    setWorkspaceId: (value: string) => dispatch({ type: "workspace/set", payload: value }),
    setThemeId: (value: string) => dispatch({ type: "theme/select", payload: value }),
    setActionId: (value: string) => dispatch({ type: "action/select", payload: value }),
    setCursorStateId: (value: string) => dispatch({ type: "cursor-state/select", payload: value }),
    setEnabled: (value: boolean) => dispatch({ type: "global-enabled/set", payload: value }),
    saveChanges,
    ...themeCommands,
    resetCurrentTheme: () => dispatch({ type: "theme/reset-current" }),
    updateActionConfig: (patch: WorkbenchActionConfig) =>
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
    updateActionConfigs: (patchesByActionId: Record<string, WorkbenchActionConfig>) =>
      updateCurrentTheme((current) => ({
        ...current,
        actionConfigs: Object.entries(patchesByActionId || {}).reduce(
          (nextActionConfigs, [actionId, patch]) => ({
            ...nextActionConfigs,
            [actionId]: {
              ...nextActionConfigs[actionId],
              ...(patch as Record<string, unknown>),
            },
          }),
          current.actionConfigs
        ),
      })),
    updateAtmosphere: (patch: Record<string, unknown>) =>
      updateCurrentTheme((current) => ({
        ...current,
        atmosphere: {
          ...current.atmosphere,
          ...patch,
        },
      })),
    ...cursorCommands,
    addSiteRule: (rule: SiteRule) => dispatch({ type: "rules/add", payload: { collection: "siteRules", rule } }),
    updateSiteRule: (id: string, updates: Partial<SiteRule>) => dispatch({ type: "rules/update", payload: { collection: "siteRules", id, updates } }),
    deleteSiteRule: (id: string) => dispatch({ type: "rules/delete", payload: { collection: "siteRules", id } }),
    reorderSiteRules: (from: number, to: number) => dispatch({ type: "rules/reorder", payload: { collection: "siteRules", from, to } }),
    toggleSiteRule: (id: string) => dispatch({ type: "rules/toggle", payload: { collection: "siteRules", id } }),
    clearAllSiteRules: () => dispatch({ type: "rules/clear-all", payload: { collection: "siteRules" } }),
    addAppRule: (rule: AppRule) => dispatch({ type: "rules/add", payload: { collection: "appRules", rule } }),
    updateAppRule: (id: string, updates: Partial<AppRule>) => dispatch({ type: "rules/update", payload: { collection: "appRules", id, updates } }),
    deleteAppRule: (id: string) => dispatch({ type: "rules/delete", payload: { collection: "appRules", id } }),
    reorderAppRules: (from: number, to: number) => dispatch({ type: "rules/reorder", payload: { collection: "appRules", from, to } }),
    toggleAppRule: (id: string) => dispatch({ type: "rules/toggle", payload: { collection: "appRules", id } }),
    clearAllAppRules: () => dispatch({ type: "rules/clear-all", payload: { collection: "appRules" } }),
    keyFeedbackConfig: normalizeKeyFeedbackConfig(draft?.keyFeedbackConfig),
    updateKeyFeedbackConfig: (patch: Partial<KeyFeedbackConfig>) => dispatch({ type: "key-feedback/update", payload: patch }),
  };
}
