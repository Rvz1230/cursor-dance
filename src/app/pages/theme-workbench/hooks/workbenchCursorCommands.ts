import { createCursorSkin, type CursorSkinState } from "@/shared/domain/cursor-dance";
import type {
  CursorCommandDraft,
  WorkbenchThemeDraft,
} from "./workbenchStateTypes";

interface WorkbenchCursorCommandOptions {
  selected: { cursorStateId: string };
  draft: CursorCommandDraft;
  updateCurrentTheme: (updater: (current: WorkbenchThemeDraft) => WorkbenchThemeDraft) => void;
}

export function createWorkbenchCursorCommands({ selected, draft, updateCurrentTheme }: WorkbenchCursorCommandOptions) {
  function updateCursorSkinState(stateId: string, patch: CursorSkinState): void {
    updateCurrentTheme((current) => ({
      ...current,
      cursorSkin: {
        ...current.cursorSkin,
        states: {
          ...current.cursorSkin.states,
          [stateId]: patch,
        },
      },
    }));
  }

  function clearCursorSkinState(stateId: string): void {
    updateCurrentTheme((current) => {
      const states = { ...current.cursorSkin.states };
      delete states[stateId];
      return {
        ...current,
        cursorSkin: { ...current.cursorSkin, states },
      };
    });
  }

  function copyDefaultCursorSkinState(stateId = selected.cursorStateId): void {
    const defaultState = draft.cursorSkin.states.default;
    if (!defaultState) return;
    updateCursorSkinState(stateId, JSON.parse(JSON.stringify(defaultState)) as CursorSkinState);
  }

  return {
    updateCursorSkinState,
    clearCursorSkinState,
    copyDefaultCursorSkinState,
    resetCursorSkin: () =>
      updateCurrentTheme((current) => ({ ...current, cursorSkin: createCursorSkin() })),
  };
}
