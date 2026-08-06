import type {
  WorkbenchState,
  WorkbenchTheme,
} from "../workbenchStateTypes";

export function markUnsaved(state: WorkbenchState): WorkbenchState {
  return {
    ...state,
    status: { ...state.status, unsaved: true, saveError: "" },
  };
}

export function markThemeDirty(state: WorkbenchState, themeId: string): WorkbenchState {
  return {
    ...state,
    status: {
      ...state.status,
      unsaved: true,
      saveError: "",
      dirtyThemes: { ...state.status.dirtyThemes, [themeId]: true },
    },
  };
}

export function clearThemeDirty(
  state: WorkbenchState,
  themeId: string,
  options: { preserveUnsaved: boolean },
): WorkbenchState {
  const dirtyThemes = { ...state.status.dirtyThemes };
  delete dirtyThemes[themeId];
  return {
    ...state,
    status: {
      ...state.status,
      unsaved: options.preserveUnsaved || Object.keys(dirtyThemes).length > 0,
      ...(options.preserveUnsaved ? { saveError: "" } : {}),
      dirtyThemes,
    },
  };
}

export function replaceTheme(
  themes: WorkbenchTheme[],
  themeId: string,
  updater: (theme: WorkbenchTheme) => WorkbenchTheme,
): WorkbenchTheme[] {
  return themes.map((theme) => theme.meta.id === themeId ? updater(theme) : theme);
}
