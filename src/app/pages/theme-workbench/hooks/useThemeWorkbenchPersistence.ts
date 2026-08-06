import { useRef } from "react";
import { useWorkbenchEditorPersistence } from "./persistence/useWorkbenchEditorPersistence";
import { useWorkbenchHydration } from "./persistence/useWorkbenchHydration";
import { useWorkbenchImmediatePersistence } from "./persistence/useWorkbenchImmediatePersistence";
import { useWorkbenchLivePreview } from "./persistence/useWorkbenchLivePreview";
import type { WorkbenchPersistenceContext } from "./persistence/workbenchPersistenceTypes";

type ThemeWorkbenchPersistenceOptions = Omit<WorkbenchPersistenceContext, "stateRef">;

export function useThemeWorkbenchPersistence(
  options: ThemeWorkbenchPersistenceOptions,
): void {
  const stateRef = useRef(options.state);
  stateRef.current = options.state;

  const context: WorkbenchPersistenceContext = { ...options, stateRef };
  useWorkbenchHydration(context);
  useWorkbenchLivePreview(context);
  useWorkbenchImmediatePersistence(context);
  useWorkbenchEditorPersistence(context);
}
