import { useEffect, useRef } from "react";
import {
  buildStoredConfigFromWorkbench,
  writeExtensionConfig,
} from "../../lib/workbenchConfig";
import type { WorkbenchPersistenceContext } from "./workbenchPersistenceTypes";

function persistLatestConfig({
  stateRef,
  configRef,
}: Pick<WorkbenchPersistenceContext, "stateRef" | "configRef">): void {
  const baseConfig = configRef.current;
  if (!baseConfig) return;
  const nextConfig = buildStoredConfigFromWorkbench(baseConfig, stateRef.current);
  writeExtensionConfig(nextConfig).then((savedConfig) => {
    configRef.current = savedConfig;
  }).catch(() => {});
}

export function useWorkbenchImmediatePersistence(
  context: WorkbenchPersistenceContext,
): void {
  const { state, stateRef, configRef } = context;
  const prevThemeCountRef = useRef(0);
  const prevEnabledRef = useRef(state.domain.enabled);

  // New themes must survive refresh even before the user presses Save.
  useEffect(() => {
    if (!state.status.isHydrated) return;
    const currentCount = state.domain.themes.length;
    if (prevThemeCountRef.current === 0) {
      prevThemeCountRef.current = currentCount;
      return;
    }
    if (currentCount > prevThemeCountRef.current) {
      persistLatestConfig({ stateRef, configRef });
    }
    prevThemeCountRef.current = currentCount;
  }, [configRef, stateRef, state.domain.themes, state.status.isHydrated]);

  // The global enabled switch is runtime state and persists immediately.
  useEffect(() => {
    if (!state.status.isHydrated) return;
    if (state.domain.enabled === prevEnabledRef.current) return;
    prevEnabledRef.current = state.domain.enabled;
    persistLatestConfig({ stateRef, configRef });
  }, [configRef, stateRef, state.domain.enabled, state.status.isHydrated]);
}
