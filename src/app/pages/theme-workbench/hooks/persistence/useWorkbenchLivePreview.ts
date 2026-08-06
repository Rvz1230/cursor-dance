import { useEffect, useRef } from "react";
import {
  buildStoredConfigFromWorkbench,
  clearLivePreviewConfig,
  writeLivePreviewConfig,
} from "../../lib/workbenchConfig";
import type { WorkbenchPersistenceContext } from "./workbenchPersistenceTypes";

export function useWorkbenchLivePreview({
  state,
  stateRef,
  configRef,
}: WorkbenchPersistenceContext): void {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!state.status.isHydrated) return;

    if (!state.status.unsaved) {
      void clearLivePreviewConfig();
      return;
    }
    if (!configRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const latestState = stateRef.current;
      const baseConfig = configRef.current;
      if (!baseConfig || !latestState.status.unsaved) return;
      void writeLivePreviewConfig(buildStoredConfigFromWorkbench(baseConfig, latestState));
    }, 180);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    configRef,
    stateRef,
    state.status.isHydrated,
    state.status.unsaved,
    state.domain.enabled,
    state.domain.activeThemeId,
    state.domain.siteRules,
    state.domain.appRules,
    state.domain.themes,
  ]);
}
