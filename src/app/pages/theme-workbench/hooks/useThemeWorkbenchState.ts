import { useMemo, useReducer, useRef } from "react";
import {
  PLATFORM_ACTIONS,
  CURSOR_STATES,
  WORKSPACES,
  getConflictsForAction,
} from "../model/workbenchSchema";
import {
  INITIAL_THEME_STATE,
  initialState,
  reducer,
} from "./themeWorkbenchStateStore";
import { useThemeWorkbenchPersistence } from "./useThemeWorkbenchPersistence";
import { isDesktop } from "@/shared/runtime";
import { createWorkbenchThemeCommands } from "./workbenchThemeCommands";
import { useWorkbenchThemeEditing } from "./editing/useWorkbenchThemeEditing";
import { useWorkbenchSave } from "./useWorkbenchSave";
import { createWorkbenchRuleCommands } from "./workbenchRuleCommands";
import type { WorkbenchConfigRef } from "./workbenchStateTypes";
import { findWorkbenchTheme } from "./workbenchThemeSelectors";
import { useWorkbenchRestoreApplied } from "./useWorkbenchRestoreApplied";

export function useThemeWorkbenchState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const configRef: WorkbenchConfigRef = useRef(null);
  useThemeWorkbenchPersistence({ state, dispatch, configRef });

  const selected = useMemo(() => ({
    themeId: state.domain.activeThemeId,
    actionId: state.editor.actionId,
    cursorStateId: state.editor.cursorStateId,
  }), [state.domain.activeThemeId, state.editor.actionId, state.editor.cursorStateId]);
  const selectedTheme = useMemo(
    () => findWorkbenchTheme(state.domain.themes, selected.themeId) ?? state.domain.themes[0] ?? INITIAL_THEME_STATE.themes[0],
    [selected.themeId, state.domain.themes]
  );
  const activeTheme = selectedTheme.meta;
  const draft = selectedTheme.draft;
  const themeMetadata = useMemo(() => state.domain.themes.map((theme) => theme.meta), [state.domain.themes]);
  const currentActionConfig = draft.actionConfigs[selected.actionId];
  const currentConflicts = getConflictsForAction(selected.actionId, draft.actionConfigs);
  const isWorkbench = state.editor.workspaceId === "workbench";

  const { undoStack, ...themeEditingCommands } = useWorkbenchThemeEditing({
    selected,
    draft,
    dispatch,
  });
  const saveChanges = useWorkbenchSave({ state, dispatch, configRef });
  const restoreAppliedChanges = useWorkbenchRestoreApplied({ state, dispatch, configRef });
  const themeCommands = createWorkbenchThemeCommands({
    state,
    selected,
    configRef,
    dispatch,
  });
  const ruleCommands = createWorkbenchRuleCommands(dispatch);

  return {
    state,
    selected,
    undoStack,
    themes: themeMetadata,
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
    recentCursorAssets: state.runtime.recentCursorAssets,
    setWorkspaceId: (value: string) => dispatch({ type: "workspace/set", payload: value }),
    setThemeId: (value: string) => dispatch({ type: "theme/select", payload: value }),
    setActionId: (value: string) => dispatch({ type: "action/select", payload: value }),
    setCursorStateId: (value: string) => dispatch({ type: "cursor-state/select", payload: value }),
    setEnabled: (value: boolean) => dispatch({ type: "global-enabled/set", payload: value }),
    saveChanges,
    restoreAppliedChanges,
    ...themeCommands,
    ...themeEditingCommands,
    ...ruleCommands,
  };
}
