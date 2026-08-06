import {
  CURSOR_STATES,
  buildDefaultCursorStateActions,
  buildDefaultCursorStateAssets,
} from "../model/workbenchSchema";
import type {
  CursorSkinState,
  CursorStateAsset,
  CursorCommandDraft,
  WorkbenchThemeDraft,
} from "./workbenchStateTypes";

interface WorkbenchCursorCommandOptions {
  selected: { cursorStateId: string };
  draft: CursorCommandDraft;
  updateCurrentTheme: (updater: (current: WorkbenchThemeDraft) => WorkbenchThemeDraft) => void;
}

const createEmptyCursorSkin = (): WorkbenchThemeDraft["cursorSkin"] => ({
  version: 1,
  enabled: true,
  transitionMs: 80,
  states: {},
});

export function createWorkbenchCursorCommands({ selected, draft, updateCurrentTheme }: WorkbenchCursorCommandOptions) {
  function updateCursorSkinState(stateId: string, patch: CursorSkinState): void {
    updateCurrentTheme((current) => ({
      ...current,
      cursorSkin: {
        ...(current.cursorSkin || createEmptyCursorSkin()),
        states: {
          ...(current.cursorSkin?.states || {}),
          [stateId]: { ...(current.cursorSkin?.states?.[stateId] || {}), ...patch },
        },
      },
    }));
  }

  function clearCursorSkinState(stateId: string): void {
    updateCurrentTheme((current) => {
      const states = { ...(current.cursorSkin?.states || {}) };
      delete states[stateId];
      return {
        ...current,
        cursorSkin: { ...(current.cursorSkin || createEmptyCursorSkin()), states },
      };
    });
  }

  function copyDefaultCursorSkinState(stateId = selected.cursorStateId): void {
    const defaultState = draft?.cursorSkin?.states?.default;
    if (!defaultState) return;
    updateCursorSkinState(stateId, JSON.parse(JSON.stringify(defaultState)) as CursorSkinState);
  }

  const updateCursorStateAssetForState = (targetStateId: string, patch: CursorStateAsset): void =>
    updateCurrentTheme((current) => ({
      ...current,
      cursorModes: targetStateId !== "default"
        ? { ...current.cursorModes, [targetStateId]: "覆盖" }
        : current.cursorModes,
      cursorStateAssets: {
        ...current.cursorStateAssets,
        [targetStateId]: { ...current.cursorStateAssets[targetStateId], ...patch },
      },
    }));

  return {
    updateCursorMode: (mode: string) =>
      updateCurrentTheme((current) => ({
        ...current,
        cursorModes: { ...current.cursorModes, [selected.cursorStateId]: mode },
      })),
    updateCursorStateAction: (actionId: string) =>
      updateCurrentTheme((current) => ({
        ...current,
        cursorStateActions: { ...current.cursorStateActions, [selected.cursorStateId]: actionId },
      })),
    updateCursorStateAsset: (patch: CursorStateAsset) => updateCursorStateAssetForState(selected.cursorStateId, patch),
    updateCursorStateAssetForState,
    updateCursorSkinState,
    clearCursorSkinState,
    copyDefaultCursorSkinState,
    resetCursorSkin: () =>
      updateCurrentTheme((current) => ({ ...current, cursorSkin: createEmptyCursorSkin() })),
    copyDefaultCursorStateAsset: () =>
      updateCurrentTheme((current) => ({
        ...current,
        cursorModes: selected.cursorStateId !== "default"
          ? { ...current.cursorModes, [selected.cursorStateId]: "覆盖" }
          : current.cursorModes,
        cursorStateAssets: {
          ...current.cursorStateAssets,
          [selected.cursorStateId]: { ...current.cursorStateAssets.default },
        },
      })),
    resetCurrentCursorState: () => {
      const stateMeta = CURSOR_STATES.find((item) => item.id === selected.cursorStateId);
      if (!stateMeta) return;
      updateCurrentTheme((current) => ({
        ...current,
        cursorModes: {
          ...current.cursorModes,
          [selected.cursorStateId]: stateMeta.id === "default" ? "源" : "继承",
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
        cursorModes: Object.fromEntries(CURSOR_STATES.map((item) => [
          item.id,
          item.id === "default" ? "源" : "继承",
        ])),
        cursorStateActions: buildDefaultCursorStateActions(),
        cursorStateAssets: buildDefaultCursorStateAssets(),
      })),
  };
}
