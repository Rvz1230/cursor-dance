import {
  PLATFORM_ACTIONS,
  CURSOR_STATES,
  THEMES,
  buildThemeDrafts,
  buildThemeLibraryItem,
  createThemeDraft,
  mergeActionConfig,
  pickStoredWorkbenchActionConfigs,
} from "../model/workbenchSchema";
import { getDefaultConfig, normalizeStoredConfig } from "./runtimeConfig";
import { normalizeKeyFeedbackConfig } from "@/desktop/renderer/engine/key-feedback-types";
import { isDesktop } from "@/shared/runtime";
import {
  isDesktopAssetId,
  resolveDesktopImageSource,
  toDesktopAssetUrl,
} from "@/shared/asset-reference";

interface BuildStoredThemeOptions {
  includeAtmosphere?: boolean;
}

function assetFromCursorSkinState(skinState) {
  const imageDataUrl = resolveDesktopImageSource(skinState?.image);
  if (!imageDataUrl) return null;
  const size = skinState.size?.mode === "fixedBox"
    ? (skinState.size.boxSize || 48)
    : Math.max(skinState.image.width || 48, skinState.image.height || 48);
  return {
    imageDataUrl,
    hotspotX: skinState.hotspot?.x ?? 0,
    hotspotY: skinState.hotspot?.y ?? 0,
    size,
    sourceWidth: skinState.image.width || size,
    sourceHeight: skinState.image.height || size,
    mimeType: skinState.image.mimeType,
  };
}

function toWorkbenchCursorMode(stateId, mode) {
  if (stateId === "default") return "源";
  return mode === "override" ? "覆盖" : "继承";
}

function buildDraftActionConfigs(baseDraft, theme) {
  return Object.fromEntries(
    PLATFORM_ACTIONS.map((action) => {
      const merged = mergeActionConfig(baseDraft.actionConfigs[action.id], theme?.actionConfigs?.[action.id] || {});
      if (isDesktop() && isDesktopAssetId(merged.imageAssetId) && !merged.imageDataUrl) {
        merged.imageDataUrl = toDesktopAssetUrl(merged.imageAssetId);
      }
      return [action.id, merged];
    }),
  );
}

function buildResetActionConfigs(baseDraft, theme, actionConfigs) {
  const isBuiltInTheme = THEMES.some((candidate) => candidate.id === theme?.id);
  return isBuiltInTheme
    ? buildDraftActionConfigs(baseDraft, undefined)
    : buildDraftActionConfigs({ actionConfigs }, { actionConfigs });
}

function buildDraftCursorMaps(baseDraft, theme) {
  const entries = CURSOR_STATES.map((state) => {
    const binding = theme?.cursorBindings?.[state.id];
    const asset = assetFromCursorSkinState(theme?.cursorSkin?.states?.[state.id]);
    return [state.id, {
      mode: binding ? toWorkbenchCursorMode(state.id, binding.mode) : baseDraft.cursorModes[state.id],
      actionId: binding?.actionId || baseDraft.cursorStateActions[state.id],
      asset: { ...baseDraft.cursorStateAssets[state.id], ...(asset || {}) },
    }] as const;
  });
  return {
    cursorModes: Object.fromEntries(entries.map(([id, value]) => [id, value.mode])),
    cursorStateActions: Object.fromEntries(entries.map(([id, value]) => [id, value.actionId])),
    cursorStateAssets: Object.fromEntries(entries.map(([id, value]) => [id, value.asset])),
  };
}

function buildDraftFromTheme(theme) {
  const baseDraft = createThemeDraft(theme?.id);
  const cursorDraft = buildDraftCursorMaps(baseDraft, theme);
  const actionConfigs = buildDraftActionConfigs(baseDraft, theme);
  const keyFeedbackConfig = normalizeKeyFeedbackConfig(theme?.keyFeedbackConfig || baseDraft.keyFeedbackConfig);
  return {
    ...baseDraft,
    ...cursorDraft,
    cursorSkin: theme?.cursorSkin || baseDraft.cursorSkin,
    keyFeedbackConfig,
    resetKeyFeedbackConfig: keyFeedbackConfig,
    actionConfigs,
    resetActionConfigs: buildResetActionConfigs(baseDraft, theme, actionConfigs),
    atmosphere: theme?.atmosphere || baseDraft.atmosphere,
  };
}

export function themePackToThemeLibraryItem(theme, fallbackIndex = 0) {
  return buildThemeLibraryItem(theme, fallbackIndex);
}

export function draftFromThemePack(theme) {
  return buildDraftFromTheme(theme);
}

export function buildThemeLibrary(config) {
  const themes = Array.isArray(config?.themes) ? config.themes : [];
  return themes.map((theme, index) => themePackToThemeLibraryItem(theme, index));
}

function resolveSelectedThemeId(themeLibrary, draftsByTheme, activeThemeId) {
  if (activeThemeId && draftsByTheme[activeThemeId]) return activeThemeId;
  return themeLibrary[0]?.id || THEMES[0]?.id || "";
}

export function createWorkbenchThemeState(themeLibrary = THEMES) {
  const nextThemeLibrary = Array.isArray(themeLibrary) && themeLibrary.length ? themeLibrary : THEMES;
  const nextDraftsByTheme = buildThemeDrafts(nextThemeLibrary);
  return {
    themeLibrary: nextThemeLibrary,
    draftsByTheme: nextDraftsByTheme,
    selectedThemeId: resolveSelectedThemeId(nextThemeLibrary, nextDraftsByTheme, undefined),
  };
}

function contextActionToWorkbench(action) {
  return action?.type === "disable"
    ? "disable"
    : { enable: true, ...(action?.themeId ? { theme: action.themeId } : {}) };
}

function webRuleToWorkbench(rule) {
  const path = rule.match.path || "";
  return {
    id: rule.id,
    enabled: rule.enabled,
    pattern: path
      ? { type: "path", hostType: rule.match.type, value: `${rule.match.host}${path}` }
      : { type: rule.match.type, value: rule.match.host },
    action: contextActionToWorkbench(rule.action),
  };
}

function desktopRuleToWorkbench(rule) {
  return {
    id: rule.id,
    enabled: rule.enabled,
    pattern: {
      type: rule.match.type,
      target: rule.match.target,
      value: rule.match.value,
    },
    action: contextActionToWorkbench(rule.action),
  };
}

export function hydrateWorkbenchState(config, site) {
  const themes = Array.isArray(config?.themes) ? config.themes : [];
  const themeLibrary = buildThemeLibrary(config);
  const baseThemeState = createWorkbenchThemeState(themeLibrary);
  const draftsByTheme = { ...baseThemeState.draftsByTheme };
  themes.forEach((theme) => { draftsByTheme[theme.id] = buildDraftFromTheme(theme); });

  return {
    workspaceId: "workbench",
    selection: {
      themeId: resolveSelectedThemeId(themeLibrary, draftsByTheme, config.activeThemeId),
      actionId: "leftClick",
      cursorStateId: "default",
    },
    siteRules: (config.contextRules || []).filter((rule) => rule.context === "web").map(webRuleToWorkbench),
    appRules: (config.contextRules || []).filter((rule) => rule.context === "desktop").map(desktopRuleToWorkbench),
    themeLibrary,
    ui: { enabled: config.enabled !== false, unsaved: false },
    site,
    draftsByTheme,
  };
}

function getStoredTheme(config, themeId) {
  return config?.themes?.find((theme) => theme.id === themeId)
    ?? getDefaultConfig().themes?.find((theme) => theme.id === themeId)
    ?? null;
}

function buildCursorBindings(draft) {
  return Object.fromEntries(CURSOR_STATES.map((state) => [state.id, {
    mode: state.id === "default" || draft.cursorModes?.[state.id] === "覆盖" ? "override" : "inherit",
    actionId: draft.cursorStateActions?.[state.id] || "leftClick",
  }]));
}

function buildStoredActionConfigs(draft) {
  const actionConfigs = pickStoredWorkbenchActionConfigs(draft.actionConfigs);
  for (const actionConfig of Object.values(actionConfigs)) {
    if (actionConfig.imageDataUrl === "") delete actionConfig.imageAssetId;
  }
  return actionConfigs;
}

function buildStoredTheme(
  themeId,
  draft,
  previousConfig,
  themeRecord,
  options: BuildStoredThemeOptions = {},
) {
  const previousTheme = getStoredTheme(previousConfig, themeId);
  const includeAtmosphere = options.includeAtmosphere ?? !isDesktop();
  const atmosphere = includeAtmosphere ? (draft.atmosphere || previousTheme?.atmosphere) : undefined;
  return {
    id: themeId,
    name: themeRecord?.name ?? previousTheme?.name ?? themeId,
    description: themeRecord?.description ?? themeRecord?.summary ?? previousTheme?.description ?? "",
    kind: themeRecord?.kind === "内置" ? "builtin" : "custom",
    actionConfigs: buildStoredActionConfigs(draft),
    cursorBindings: buildCursorBindings(draft),
    cursorSkin: draft.cursorSkin,
    keyFeedbackConfig: normalizeKeyFeedbackConfig(draft.keyFeedbackConfig),
    ...(atmosphere ? { atmosphere } : {}),
  };
}

export function buildPreviewThemePackFromWorkbench(previousConfig, state) {
  return buildStoredThemePackFromWorkbench(previousConfig, state, state.selection.themeId);
}

export function buildStoredThemePackFromWorkbench(
  previousConfig,
  state,
  themeId = state.selection.themeId,
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

function workbenchActionToContext(action) {
  return action === "disable"
    ? { type: "disable" }
    : { type: "enable", ...(action?.theme ? { themeId: action.theme } : {}) };
}

function splitWebPattern(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  const slashIndex = normalized.indexOf("/");
  return slashIndex < 0
    ? { host: normalized }
    : { host: normalized.slice(0, slashIndex), path: normalized.slice(slashIndex) };
}

function workbenchWebRuleToContext(rule) {
  const isPathRule = rule.pattern?.type === "path";
  return {
    id: rule.id,
    context: "web",
    enabled: rule.enabled !== false,
    match: {
      type: rule.pattern?.type === "glob" || (isPathRule && rule.pattern?.hostType === "glob")
        ? "glob"
        : "exact",
      ...splitWebPattern(rule.pattern?.value),
    },
    action: workbenchActionToContext(rule.action),
  };
}

function workbenchDesktopRuleToContext(rule) {
  return {
    id: rule.id,
    context: "desktop",
    enabled: rule.enabled !== false,
    match: {
      type: rule.pattern?.type === "glob" ? "glob" : "exact",
      target: rule.pattern?.target === "title" ? "title" : "process",
      value: rule.pattern?.value || "",
    },
    action: workbenchActionToContext(rule.action),
  };
}

export function buildStoredConfigFromWorkbench(previousConfig, state) {
  const themes = (state.themeLibrary || []).map((theme) =>
    buildStoredThemePackFromWorkbench(previousConfig, state, theme.id),
  );
  const nextConfig = {
    schemaVersion: 4,
    enabled: state.ui.enabled,
    activeThemeId: state.selection.themeId,
    themes,
    contextRules: [
      ...(state.siteRules || []).map(workbenchWebRuleToContext),
      ...(state.appRules || []).map(workbenchDesktopRuleToContext),
    ],
    performance: previousConfig?.performance || { maxActiveEffects: 48 },
  };
  return normalizeStoredConfig(nextConfig);
}
