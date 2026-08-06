import { useEffect, useRef } from "react";
import { writeEditorState } from "../../lib/workbenchConfig";
import type { WorkbenchPersistenceContext } from "./workbenchPersistenceTypes";

export function useWorkbenchEditorPersistence({
  state,
  stateRef,
}: WorkbenchPersistenceContext): void {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousKeyRef = useRef("");

  useEffect(() => {
    if (!state.status.isHydrated) return;

    const key = `${state.editor.workspaceId}::${state.domain.activeThemeId}::${state.editor.actionId}::${state.editor.cursorStateId}`;
    if (key === previousKeyRef.current) return;
    previousKeyRef.current = key;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void writeEditorState({
        workspaceId: stateRef.current.editor.workspaceId,
        themeId: stateRef.current.domain.activeThemeId,
        actionId: stateRef.current.editor.actionId,
        cursorStateId: stateRef.current.editor.cursorStateId,
      });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    stateRef,
    state.status.isHydrated,
    state.editor.workspaceId,
    state.domain.activeThemeId,
    state.editor.actionId,
    state.editor.cursorStateId,
  ]);
}
