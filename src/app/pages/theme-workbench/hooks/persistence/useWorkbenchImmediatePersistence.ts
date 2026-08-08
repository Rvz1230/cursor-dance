import { useEffect, useRef } from "react";
import {
  buildStoredThemePackFromWorkbench,
  normalizeStoredConfig,
  updateExtensionConfig,
} from "../../lib/workbenchConfig";
import type { WorkbenchPersistenceContext } from "./workbenchPersistenceTypes";
import type { CursorDanceConfig } from "@/shared/domain/cursor-dance";
import type { WorkbenchState } from "../workbenchStateTypes";

export function buildConfigWithNewThemes(
  baseConfig: CursorDanceConfig,
  state: WorkbenchState,
): CursorDanceConfig {
  const storedThemeIds = new Set(baseConfig.themes.map((theme) => theme.id));
  const addedThemes = state.domain.themes
    .filter((theme) => !storedThemeIds.has(theme.meta.id))
    .map((theme) => buildStoredThemePackFromWorkbench(baseConfig, state, theme.meta.id));
  return addedThemes.length
    ? normalizeStoredConfig({
        ...baseConfig,
        themes: [...baseConfig.themes, ...addedThemes],
      })
    : baseConfig;
}

function persistNewThemes({
  stateRef,
  configRef,
}: Pick<WorkbenchPersistenceContext, "stateRef" | "configRef">): void {
  void updateExtensionConfig((currentConfig) => (
    buildConfigWithNewThemes(currentConfig, stateRef.current)
  )).then((savedConfig) => {
    configRef.current = savedConfig;
  }).catch(() => {});
}

export function buildImmediateEnabledConfig(
  baseConfig: CursorDanceConfig | null,
  enabled: boolean,
): CursorDanceConfig | null {
  return baseConfig ? { ...baseConfig, enabled } : null;
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
      persistNewThemes({ stateRef, configRef });
    }
    prevThemeCountRef.current = currentCount;
  }, [configRef, stateRef, state.domain.themes, state.status.isHydrated]);

  // The global enabled switch is runtime state and persists immediately.
  useEffect(() => {
    if (!state.status.isHydrated) return;
    if (state.domain.enabled === prevEnabledRef.current) return;
    prevEnabledRef.current = state.domain.enabled;
    void updateExtensionConfig((currentConfig) => ({
      ...currentConfig,
      enabled: state.domain.enabled,
    })).then((savedConfig) => {
      configRef.current = savedConfig;
    }).catch(() => {});
  }, [configRef, stateRef, state.domain.enabled, state.status.isHydrated]);
}
