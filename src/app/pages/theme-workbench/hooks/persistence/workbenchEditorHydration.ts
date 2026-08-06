import type { WorkbenchEditorState as StoredEditorState } from "../../lib/storage/repository/types";
import type { WorkbenchState, WorkbenchTheme } from "../workbenchStateTypes";
import { hasWorkbenchTheme } from "../workbenchThemeSelectors";

const WORKSPACE_IDS = new Set(["workbench", "states", "sites", "diagnostics", "keyboard"]);
const ACTION_IDS = new Set(["leftClick", "rightClick", "doubleClick", "longPress", "wheel", "hover"]);

interface ResolveWorkbenchEditorHydrationOptions {
  currentEditor: WorkbenchState["editor"];
  storedEditor: StoredEditorState | null;
  themes: readonly WorkbenchTheme[];
  configActiveThemeId: string;
  availableCursorStateIds: readonly string[];
}

interface ResolvedWorkbenchEditorHydration {
  editor: WorkbenchState["editor"];
  activeThemeId: string;
  hasUnsavedThemeSelection: boolean;
}

export function resolveWorkbenchEditorHydration({
  currentEditor,
  storedEditor,
  themes,
  configActiveThemeId,
  availableCursorStateIds,
}: ResolveWorkbenchEditorHydrationOptions): ResolvedWorkbenchEditorHydration {
  const editor = { ...currentEditor };
  let activeThemeId = configActiveThemeId;

  if (storedEditor?.workspaceId && WORKSPACE_IDS.has(storedEditor.workspaceId)) {
    editor.workspaceId = storedEditor.workspaceId;
  }
  if (storedEditor?.themeId && hasWorkbenchTheme(themes, storedEditor.themeId)) {
    activeThemeId = storedEditor.themeId;
  }
  if (storedEditor?.actionId && ACTION_IDS.has(storedEditor.actionId)) {
    editor.actionId = storedEditor.actionId;
  }
  if (storedEditor?.cursorStateId && availableCursorStateIds.includes(storedEditor.cursorStateId)) {
    editor.cursorStateId = storedEditor.cursorStateId;
  }

  return {
    editor,
    activeThemeId,
    hasUnsavedThemeSelection: activeThemeId !== configActiveThemeId,
  };
}
