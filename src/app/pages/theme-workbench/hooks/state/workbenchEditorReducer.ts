import type { WorkbenchAction, WorkbenchState } from "../workbenchStateTypes";

export function reduceWorkbenchEditorState(
  state: WorkbenchState,
  action: WorkbenchAction,
): WorkbenchState {
  switch (action.type) {
    case "workspace/set":
      if (state.editor.workspaceId === action.payload) return state;
      return {
        ...state,
        editor: { ...state.editor, workspaceId: action.payload },
      };
    case "action/select":
      if (state.editor.actionId === action.payload) return state;
      return {
        ...state,
        editor: { ...state.editor, actionId: action.payload },
      };
    case "cursor-state/select":
      if (state.editor.cursorStateId === action.payload) return state;
      return {
        ...state,
        editor: { ...state.editor, cursorStateId: action.payload },
      };
    default:
      return state;
  }
}
