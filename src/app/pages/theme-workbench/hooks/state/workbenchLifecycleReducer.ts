import type { WorkbenchAction, WorkbenchState } from "../workbenchStateTypes";
import { markUnsaved } from "./workbenchStateOperations";

export function reduceWorkbenchLifecycleState(
  state: WorkbenchState,
  action: WorkbenchAction,
): WorkbenchState {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        domain: { ...state.domain, ...action.payload.domain },
        editor: { ...state.editor, ...action.payload.editor },
        runtime: { ...state.runtime, ...action.payload.runtime },
        status: {
          ...state.status,
          ...action.payload.status,
          isHydrated: true,
          isSaving: false,
          saveError: "",
          dirtyThemes: {},
        },
      };
    case "global-enabled/set":
      if (state.domain.enabled === action.payload) return state;
      return markUnsaved({
        ...state,
        domain: { ...state.domain, enabled: action.payload },
      });
    case "save/start":
      return { ...state, status: { ...state.status, isSaving: true, saveError: "" } };
    case "save/success":
      if (action.payload?.preserveUnsaved) {
        return {
          ...state,
          status: { ...state.status, isSaving: false, saveError: "" },
        };
      }
      return {
        ...state,
        status: { ...state.status, unsaved: false, isSaving: false, saveError: "", dirtyThemes: {} },
      };
    case "save/error":
      return {
        ...state,
        status: { ...state.status, isSaving: false, saveError: action.payload || "保存失败" },
      };
    case "recent-assets/set":
      return {
        ...state,
        runtime: { ...state.runtime, recentCursorAssets: action.payload },
      };
    default:
      return state;
  }
}
