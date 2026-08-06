import { useCallback, useRef } from "react";
import { normalizeKeyFeedbackConfig } from "@/shared/config/key-feedback";
import type { KeyFeedbackConfig } from "@/shared/config/key-feedback";
import { formatActionLabel } from "../../model/workbenchSchema";
import { createWorkbenchCursorCommands } from "../workbenchCursorCommands";
import type {
  WorkbenchActionConfig,
  WorkbenchDispatch,
  WorkbenchSelection,
  WorkbenchThemeDraft,
} from "../workbenchStateTypes";
import { useWorkbenchUndo } from "../useWorkbenchUndo";
import {
  applyActionConfigPatch,
  applyActionConfigPatches,
  applyAtmospherePatch,
  getActionPatchMergeKey,
} from "./workbenchDraftUpdates";

interface WorkbenchThemeEditingOptions {
  selected: WorkbenchSelection;
  draft: WorkbenchThemeDraft;
  dispatch: WorkbenchDispatch;
}

interface ThemeUpdateMeta {
  label?: string;
  mergeKey?: string;
}

export function useWorkbenchThemeEditing({
  selected,
  draft,
  dispatch,
}: WorkbenchThemeEditingOptions) {
  const applyDraftSnapshot = useCallback((snapshot: WorkbenchThemeDraft) => {
    dispatch({ type: "theme/update-current", payload: () => snapshot });
  }, [dispatch]);
  const undoStack = useWorkbenchUndo(applyDraftSnapshot);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  function updateCurrentTheme(
    updater: (current: WorkbenchThemeDraft) => WorkbenchThemeDraft,
    meta?: ThemeUpdateMeta,
  ): void {
    const before = draftRef.current;
    dispatch({ type: "theme/update-current", payload: updater });
    undoStack.record({
      bucket: selected.themeId,
      before,
      after: updater(before),
      label: meta?.label ?? formatActionLabel(selected.actionId),
      mergeKey: meta?.mergeKey,
    });
  }

  const cursorCommands = createWorkbenchCursorCommands({
    selected,
    draft,
    updateCurrentTheme,
  });

  return {
    undoStack,
    resetCurrentTheme: () => dispatch({ type: "theme/reset-current" }),
    updateActionConfig: (patch: WorkbenchActionConfig) =>
      updateCurrentTheme(
        (current) => applyActionConfigPatch(current, selected.actionId, patch),
        { mergeKey: getActionPatchMergeKey(selected.actionId, patch) },
      ),
    updateActionConfigs: (patchesByActionId: Record<string, WorkbenchActionConfig>) =>
      updateCurrentTheme((current) => applyActionConfigPatches(current, patchesByActionId)),
    updateAtmosphere: (patch: Record<string, unknown>) =>
      updateCurrentTheme((current) => applyAtmospherePatch(current, patch)),
    keyFeedbackConfig: normalizeKeyFeedbackConfig(draft.keyFeedbackConfig),
    updateKeyFeedbackConfig: (patch: Partial<KeyFeedbackConfig>) =>
      dispatch({ type: "key-feedback/update", payload: patch }),
    ...cursorCommands,
  };
}
