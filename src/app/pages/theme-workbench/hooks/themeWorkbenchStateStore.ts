import { createWorkbenchThemeState } from "../lib/workbenchConfig";
import { THEMES } from "../model/workbenchSchema";
import { reduceWorkbenchEditorState } from "./state/workbenchEditorReducer";
import { reduceWorkbenchLifecycleState } from "./state/workbenchLifecycleReducer";
import { reduceWorkbenchRulesState } from "./state/workbenchRulesReducer";
import { reduceWorkbenchThemeState } from "./state/workbenchThemeReducer";
import type { WorkbenchAction, WorkbenchState } from "./workbenchStateTypes";

export const INITIAL_THEME_STATE = createWorkbenchThemeState(THEMES);

export const initialState: WorkbenchState = {
  domain: {
    enabled: true,
    activeThemeId: INITIAL_THEME_STATE.selectedThemeId,
    themes: INITIAL_THEME_STATE.themes,
    siteRules: [],
    appRules: [],
  },
  editor: {
    workspaceId: "workbench",
    actionId: "leftClick",
    cursorStateId: "default",
  },
  status: {
    unsaved: true,
    isHydrated: false,
    isSaving: false,
    saveError: "",
    dirtyThemes: {},
  },
  runtime: {
    site: {
      host: "example.com",
      path: "/",
      isSupportedPage: false,
      tabId: null,
    },
    recentCursorAssets: [],
  },
};

const stateReducers = [
  reduceWorkbenchLifecycleState,
  reduceWorkbenchEditorState,
  reduceWorkbenchThemeState,
  reduceWorkbenchRulesState,
];

export function reducer(state: WorkbenchState, action: WorkbenchAction): WorkbenchState {
  // Each reducer owns a disjoint action family and returns the same state for unrelated actions.
  return stateReducers.reduce(
    (nextState, reduceState) => reduceState(nextState, action),
    state,
  );
}
