import { useRef } from "react";
import {
  buildStoredConfigFromWorkbench,
  clearLivePreviewConfig,
  updateExtensionConfig,
} from "../lib/workbenchConfig";
import type {
  WorkbenchConfigRef,
  WorkbenchDispatch,
  WorkbenchState,
} from "./workbenchStateTypes";

interface WorkbenchSaveOptions {
  state: WorkbenchState;
  dispatch: WorkbenchDispatch;
  configRef: WorkbenchConfigRef;
}

export function useWorkbenchSave({ state, dispatch, configRef }: WorkbenchSaveOptions) {
  const stateRef = useRef(state);
  stateRef.current = state;

  return async function saveChanges() {
    dispatch({ type: "save/start" });
    try {
      const savedConfig = await updateExtensionConfig((currentConfig) => (
        buildStoredConfigFromWorkbench(currentConfig, state)
      ));
      configRef.current = savedConfig;

      const latestState = stateRef.current;
      const hasStaleSelection = latestState.domain.activeThemeId !== savedConfig.activeThemeId;
      if (!latestState.status.unsaved || !hasStaleSelection) {
        await clearLivePreviewConfig();
      }
      dispatch({ type: "save/success", payload: { preserveUnsaved: hasStaleSelection } });
      return { ok: true as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败，请重试";
      dispatch({ type: "save/error", payload: message });
      return { ok: false as const, error: message };
    }
  };
}
