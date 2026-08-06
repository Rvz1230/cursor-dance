import { normalizeKeyFeedbackConfig } from "@/shared/config/key-feedback";
import type { CursorDanceConfig } from "@/shared/domain/cursor-dance";
import { isDesktop } from "@/shared/runtime";
import { pickKnownCursorStates } from "@/shared/cursor-states";
import type {
  WorkbenchPersistableState,
  WorkbenchTheme,
  WorkbenchThemeDraft,
} from "../../hooks/workbenchStateTypes";
import { findWorkbenchTheme } from "../../hooks/workbenchThemeSelectors";
import {
  CURSOR_STATES,
  pickStoredWorkbenchActionConfigs,
} from "../../model/workbenchSchema";
import { getDefaultConfig, normalizeStoredConfig } from "../runtimeConfig";
import { workbenchRulesToContext } from "./contextRuleAdapter";

interface BuildStoredThemeOptions {
  includeAtmosphere?: boolean;
}

function getStoredTheme(config: CursorDanceConfig, themeId: string) {
  return config.themes.find((theme) => theme.id === themeId)
    ?? getDefaultConfig().themes.find((theme) => theme.id === themeId)
    ?? null;
}

/**
 * 丢弃已从真值源移除的状态槽位（存量配置里的 grab / crosshair / resize* 等）。
 * 只做静默丢弃，不做拒绝式校验——后者会触发整份配置恢复默认。
 */
function normalizeCursorSkinStates(
  cursorSkin: WorkbenchThemeDraft["cursorSkin"],
): WorkbenchThemeDraft["cursorSkin"] {
  return { ...cursorSkin, states: pickKnownCursorStates(cursorSkin?.states) };
}

function buildCursorBindings(draft: WorkbenchThemeDraft) {
  return Object.fromEntries(CURSOR_STATES.map((state) => {
    const binding = draft.cursorBindings[state.id];
    return [state.id, {
      mode: state.id === "default" ? "override" as const : (binding?.mode || "inherit"),
      actionId: binding?.actionId || "leftClick",
    }];
  }));
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
  previousConfig: CursorDanceConfig,
  themeRecord: WorkbenchTheme["meta"] | undefined,
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
    cursorSkin: normalizeCursorSkinStates(draft.cursorSkin),
    keyFeedbackConfig: normalizeKeyFeedbackConfig(draft.keyFeedbackConfig),
    ...(atmosphere ? { atmosphere } : {}),
  };
}

function buildStoredThemeFromState(
  previousConfig: CursorDanceConfig,
  state: WorkbenchPersistableState,
  themeId: string,
  options: BuildStoredThemeOptions = {},
) {
  const theme = findWorkbenchTheme(state.themes, themeId);
  if (!theme) {
    throw new Error(`Theme not found: ${themeId}`);
  }
  return buildStoredTheme(
    themeId,
    theme.draft,
    previousConfig,
    theme.meta,
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
): CursorDanceConfig {
  const normalizedPrevious = normalizeStoredConfig(previousConfig);
  const themes = state.themes.map((theme) =>
    buildStoredThemeFromState(normalizedPrevious, state, theme.meta.id),
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
