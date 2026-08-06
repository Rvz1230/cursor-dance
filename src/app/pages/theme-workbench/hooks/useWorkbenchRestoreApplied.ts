import { useRef } from "react";
import {
  clearLivePreviewConfig,
  hydrateWorkbenchState,
  readExtensionConfig,
} from "../lib/workbenchConfig";
import type {
  WorkbenchConfigRef,
  WorkbenchDispatch,
  WorkbenchState,
} from "./workbenchStateTypes";

interface WorkbenchRestoreAppliedOptions {
  state: WorkbenchState;
  dispatch: WorkbenchDispatch;
  configRef: WorkbenchConfigRef;
}

/** Restore the whole draft domain from the last applied config, not just the visible panel. */
export function useWorkbenchRestoreApplied({
  state,
  dispatch,
  configRef,
}: WorkbenchRestoreAppliedOptions) {
  const stateRef = useRef(state);
  stateRef.current = state;

  return async function restoreAppliedChanges() {
    const config = configRef.current ?? await readExtensionConfig();
    configRef.current = config;
    const restored = hydrateWorkbenchState(config, stateRef.current.runtime.site);
    await clearLivePreviewConfig();
    dispatch({
      type: "hydrate",
      payload: {
        domain: restored.domain,
        status: { ...restored.status, unsaved: false },
      },
    });
    return config.activeThemeId;
  };
}
