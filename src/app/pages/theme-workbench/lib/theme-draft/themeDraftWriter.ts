import { normalizeKeyFeedbackConfig } from "@/shared/config/key-feedback";
import type { CursorDanceConfigV4 } from "@/shared/config-schema-v4";
import { isDesktop } from "@/shared/runtime";
import type {
  ThemeLibraryItem,
  WorkbenchPersistableState,
  WorkbenchThemeDraft,
} from "../../hooks/workbenchStateTypes";
import {
  CURSOR_STATES,
  pickStoredWorkbenchActionConfigs,
} from "../../model/workbenchSchema";
import { getDefaultConfig, normalizeStoredConfig } from "../runtimeConfig";
import { workbenchRulesToContext } from "./contextRuleAdapter";

interface BuildStoredThemeOptions {
  includeAtmosphere?: boolean;
}

function getStoredTheme(config: CursorDanceConfigV4, themeId: string) {
  return config.themes.find((theme) => theme.id === themeId)
    ?? getDefaultConfig().themes.find((theme) => theme.id === themeId)
    ?? null;
}

function buildCursorBindings(draft: WorkbenchThemeDraft) {
  return Object.fromEntries(CURSOR_STATES.map((state) => [state.id, {
    mode: state.id === "default" || draft.cursorModes[state.id] === "覆盖"
      ? "override" as const
      : "inherit" as const,
    actionId: draft.cursorStateActions[state.id] || "leftClick",
  }]));
}

function buildStoredActionConfigs(draft: WorkbenchThemeDraft) {
  const actionConfigs = pickStoredWorkbenchActionConfigs(draft.actionConfigs) as Record<
    string,
    Record<string, unknown>
  >;
  for (const actionConfig of Object.values(actionConfigs)) {
    if (actionConfig.imageDataUrl === "") delete actionConfig.imageAssetId;
  }
  return actionConfigs;
}

function buildStoredTheme(
  themeId: string,
  draft: WorkbenchThemeDraft,
  previousConfig: CursorDanceConfigV4,
  themeRecord: ThemeLibraryItem | undefined,
  options: BuildStoredThemeOptions = {},
) {
  const previousTheme = getStoredTheme(previousConfig, themeId);
  const includeAtmosphere = options.includeAtmosphere ?? !isDesktop();
  const atmosphere = includeAtmosphere ? (draft.atmosphere || previousTheme?.atmosphere) : undefined;
  return {
    id: themeId,
    name: themeRecord?.name ?? previousTheme?.name ?? themeId,
    description: themeRecord?.description ?? themeRecord?.summary ?? previousTheme?.description ?? "",
    kind: themeRecord?.kind === "内置" ? "builtin" as const : "custom" as const,
    actionConfigs: buildStoredActionConfigs(draft),
    cursorBindings: buildCursorBindings(draft),
    cursorSkin: draft.cursorSkin,
    keyFeedbackConfig: normalizeKeyFeedbackConfig(draft.keyFeedbackConfig),
    ...(atmosphere ? { atmosphere } : {}),
  };
}

function buildStoredThemeFromState(
  previousConfig: CursorDanceConfigV4,
  state: WorkbenchPersistableState,
  themeId: string,
  options: BuildStoredThemeOptions = {},
) {
  return buildStoredTheme(
    themeId,
    state.draftsByTheme[themeId],
    previousConfig,
    state.themeLibrary.find((theme) => theme.id === themeId),
    options,
  );
}

export function buildPreviewThemePackFromWorkbench(previousConfig: unknown, state: WorkbenchPersistableState) {
  return buildStoredThemePackFromWorkbench(previousConfig, state, state.selection.themeId);
}

export function buildStoredThemePackFromWorkbench(
  previousConfig: unknown,
  state: WorkbenchPersistableState,
  themeId = state.selection.themeId,
  options: BuildStoredThemeOptions = {},
) {
  return buildStoredThemeFromState(
    normalizeStoredConfig(previousConfig),
    state,
    themeId,
    options,
  );
}

export function buildStoredConfigFromWorkbench(
  previousConfig: unknown,
  state: WorkbenchPersistableState,
): CursorDanceConfigV4 {
  const normalizedPrevious = normalizeStoredConfig(previousConfig);
  const themes = state.themeLibrary.map((theme) =>
    buildStoredThemeFromState(normalizedPrevious, state, theme.id),
  );
  return normalizeStoredConfig({
    schemaVersion: 4,
    enabled: state.ui.enabled,
    activeThemeId: state.selection.themeId,
    themes,
    contextRules: workbenchRulesToContext(state.siteRules, state.appRules),
    performance: normalizedPrevious.performance || { maxActiveEffects: 48 },
  });
}
