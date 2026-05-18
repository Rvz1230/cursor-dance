import {
  ACTIONS,
  CURSOR_STATES,
  THEMES,
  buildThemeDrafts,
  buildThemeLibraryItem,
  createThemeDraft,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
  getActionTriggerConfig,
  getOrderedActionTextTags,
  mergeActionConfig,
  pickStoredWorkbenchActionConfigs,
} from "../model/workbenchSchema.js";
import { getDefaultConfig, getRuntimeConfig, normalizeStoredConfig } from "./runtimeConfig.js";

export const DEFAULT_WORKBENCH_SITE_MODE = "跟随全局";

function toWorkbenchCursorMode(stateId, mode) {
  if (stateId === "default") {
    return mode === "override" ? "覆盖" : "源";
  }
  return mode === "override" ? "覆盖" : "继承";
}

function toExtensionCursorState(mode, actionId) {
  return {
    mode: mode === "覆盖" ? "override" : "inherit",
    actionId: typeof actionId === "string" ? actionId : "leftClick",
  };
}

function mapFontWeightToWorkbench(fontWeight) {
  if (fontWeight >= 700) return "加粗";
  if (fontWeight >= 600) return "中等";
  return "常规";
}

function mapFontWeightToStored(weight) {
  if (weight === "加粗") return 800;
  if (weight === "中等") return 600;
  return 500;
}

function buildLeftClickBehaviorActionConfig(baseActionConfig, themePack) {
  const clickConfig = themePack?.behavior?.click ?? {};
  const effects = clickConfig.effects ?? {};
  const textEffect = effects.text ?? {};
  const rippleEffect = effects.ripple ?? {};
  const particleEffect = effects.particle ?? {};
  const fallbackTextConfig = getRuntimeConfig().resolveActionTextConfigFromEffect?.(baseActionConfig, textEffect)
    ?? baseActionConfig;

  return {
    ...fallbackTextConfig,
    textEnabled: textEffect.enabled !== false,
    textColor: textEffect.color ?? baseActionConfig.textColor,
    fontSize: textEffect.fontSize ?? baseActionConfig.fontSize,
    textWeight: mapFontWeightToWorkbench(textEffect.fontWeight ?? 800),
    textOffsetX: textEffect.offsetX ?? baseActionConfig.textOffsetX,
    textOffsetY: textEffect.offsetY ?? baseActionConfig.textOffsetY,
    textDuration: textEffect.durationMs ?? baseActionConfig.textDuration,
    ripple: rippleEffect.enabled !== false,
    rippleSize: rippleEffect.size ?? baseActionConfig.rippleSize,
    rippleDuration: rippleEffect.durationMs ?? baseActionConfig.rippleDuration,
    particle: particleEffect.enabled !== false,
    particleCount: particleEffect.count ?? baseActionConfig.particleCount,
    particleSize: particleEffect.size ?? baseActionConfig.particleSize,
    particleSpread: particleEffect.baseDistance ?? baseActionConfig.particleSpread,
    particleDuration: particleEffect.durationMs ?? baseActionConfig.particleDuration,
    holdMs: clickConfig.trigger?.cooldownMs ?? baseActionConfig.holdMs,
  };
}

function buildDraftActionConfigs(baseDraft, themePack) {
  const storedActionConfigs = themePack?.workbenchDraft?.actionConfigs || {};
  const leftClickBehaviorConfig = themePack?.behavior?.click
    ? buildLeftClickBehaviorActionConfig(baseDraft.actionConfigs.leftClick, themePack)
    : {};

  return Object.fromEntries(
    ACTIONS.map((action) => {
      const baseActionConfig = baseDraft.actionConfigs[action.id];
      const storedActionConfig = storedActionConfigs[action.id] || {};
      const behaviorActionConfig = action.id === "leftClick" ? leftClickBehaviorConfig : {};
      return [
        action.id,
        mergeActionConfig(baseActionConfig, storedActionConfig, behaviorActionConfig),
      ];
    })
  );
}

export function themePackToThemeLibraryItem(themePack, fallbackIndex = 0) {
  return buildThemeLibraryItem(themePack, fallbackIndex);
}

function buildDraftCursorState(baseDraft, themePack, stateId) {
  const legacyAsset = themePack?.workbenchDraft?.cursorStateAssets?.[stateId] || {};
  const cursorState = themePack?.cursorStates?.[stateId] || {};

  return {
    mode:
      themePack?.cursorStates?.[stateId]
        ? toWorkbenchCursorMode(stateId, cursorState.mode)
        : (themePack?.workbenchDraft?.cursorModes?.[stateId] || baseDraft.cursorModes[stateId]),
    actionId:
      themePack?.cursorStates?.[stateId]?.actionId
      || themePack?.workbenchDraft?.cursorStateActions?.[stateId]
      || baseDraft.cursorStateActions[stateId],
    asset: {
      ...baseDraft.cursorStateAssets[stateId],
      ...legacyAsset,
      imageDataUrl: cursorState.imageDataUrl || legacyAsset.imageDataUrl || baseDraft.cursorStateAssets[stateId].imageDataUrl,
      hotspotX: cursorState.hotspotX ?? legacyAsset.hotspotX ?? baseDraft.cursorStateAssets[stateId].hotspotX,
      hotspotY: cursorState.hotspotY ?? legacyAsset.hotspotY ?? baseDraft.cursorStateAssets[stateId].hotspotY,
      size: cursorState.size ?? legacyAsset.size ?? baseDraft.cursorStateAssets[stateId].size,
    },
  };
}

function buildDraftCursorMaps(baseDraft, themePack) {
  const draftStates = CURSOR_STATES.map((state) => [state.id, buildDraftCursorState(baseDraft, themePack, state.id)]);
  return {
    cursorModes: Object.fromEntries(draftStates.map(([stateId, stateDraft]) => [stateId, stateDraft.mode])),
    cursorStateActions: Object.fromEntries(draftStates.map(([stateId, stateDraft]) => [stateId, stateDraft.actionId])),
    cursorStateAssets: Object.fromEntries(draftStates.map(([stateId, stateDraft]) => [stateId, stateDraft.asset])),
  };
}

function buildDraftFromThemePack(themePack) {
  const themeId = themePack?.id;
  const baseDraft = createThemeDraft(themeId);
  const cursorDraft = buildDraftCursorMaps(baseDraft, themePack);

  return {
    ...baseDraft,
    ...(themePack?.workbenchDraft || {}),
    cursorModes: cursorDraft.cursorModes,
    cursorStateActions: cursorDraft.cursorStateActions,
    cursorStateAssets: cursorDraft.cursorStateAssets,
    actionConfigs: buildDraftActionConfigs(baseDraft, themePack),
  };
}

export function draftFromThemePack(themePack) {
  return buildDraftFromThemePack(themePack);
}

export function buildThemeLibrary(config) {
  const themePacks = Array.isArray(config?.themePacks) ? config.themePacks : [];
  return themePacks.map((themePack, index) => themePackToThemeLibraryItem(themePack, index));
}

function resolveSelectedThemeId(themeLibrary, draftsByTheme, activeThemePackId) {
  if (activeThemePackId && draftsByTheme[activeThemePackId]) return activeThemePackId;
  return themeLibrary[0]?.id || THEMES[0]?.id || "";
}

export function createWorkbenchThemeState(themeLibrary = THEMES) {
  const nextThemeLibrary = Array.isArray(themeLibrary) && themeLibrary.length ? themeLibrary : THEMES;
  const nextDraftsByTheme = buildThemeDrafts(nextThemeLibrary);
  return {
    themeLibrary: nextThemeLibrary,
    draftsByTheme: nextDraftsByTheme,
    selectedThemeId: resolveSelectedThemeId(nextThemeLibrary, nextDraftsByTheme),
  };
}

function toWorkbenchSiteMode(mode) {
  if (mode === "enabled") return "当前启用";
  if (mode === "disabled") return "当前禁用";
  return "跟随全局";
}

function toStoredSiteMode(mode) {
  if (mode === "当前启用") return "enabled";
  if (mode === "当前禁用") return "disabled";
  return "inherit";
}

export function hydrateWorkbenchState(config, site) {
  const storedThemePacks = Array.isArray(config?.themePacks) ? config.themePacks : [];
  const currentSiteRule = getRuntimeConfig().getSiteRule?.(config, site.host) ?? { mode: "inherit" };
  const siteMode = currentSiteRule.mode ?? "inherit";
  const workbenchSiteMode = toWorkbenchSiteMode(siteMode);
  const themeLibrary = buildThemeLibrary(config);
  const baseThemeState = createWorkbenchThemeState(themeLibrary);
  const draftsByTheme = {
    ...baseThemeState.draftsByTheme,
  };

  storedThemePacks.forEach((themePack) => {
    draftsByTheme[themePack.id] = buildDraftFromThemePack(themePack);
  });

  const selectedThemeId = resolveSelectedThemeId(themeLibrary, draftsByTheme, config.activeThemePackId);
  const workspaceAliasMap = {
    workspace: "workbench",
    diagnostics: "diagnostics",
    assets: "workbench",
  };
  const workspaceId = workspaceAliasMap[config.editor?.lastWorkspace] || config.editor?.lastWorkspace || "workbench";
  const selectedActionId = ACTIONS.some((item) => item.id === config.editor?.lastActionId) ? config.editor.lastActionId : "leftClick";
  const selectedCursorStateId = CURSOR_STATES.some((item) => item.id === config.editor?.lastCursorState) ? config.editor.lastCursorState : "default";

  return {
    workspaceId,
    selection: {
      themeId: selectedThemeId,
      actionId: selectedActionId,
      cursorStateId: selectedCursorStateId,
    },
    siteMode: workbenchSiteMode,
    siteThemeId: currentSiteRule.themePackId || selectedThemeId,
    themeLibrary,
    siteRulesByHost: {
      ...(config.siteRules?.byHost || {}),
    },
    ui: {
      enabled: config.enabled !== false,
      unsaved: false,
      siteFilter: "",
    },
    site,
    draftsByTheme,
  };
}

function getStoredThemePack(config, themeId) {
  return config.themePacks.find((item) => item.id === themeId) ?? getDefaultConfig().themePacks?.find((item) => item.id === themeId) ?? null;
}

function buildStoredThemePack(themeId, draft, previousConfig, themeRecord) {
  const previousThemePack = getStoredThemePack(previousConfig, themeId) ?? {};
  const previousEffects = previousThemePack.behavior?.click?.effects ?? {};
  const actionConfig = draft.actionConfigs.leftClick;
  const textConfig = getActionTextConfig(actionConfig);
  const particleConfig = getActionParticleConfig(actionConfig);
  const rippleConfig = getActionRippleConfig(actionConfig);
  const triggerConfig = getActionTriggerConfig(actionConfig);
  const orderedTextTags = getOrderedActionTextTags(actionConfig);
  const storedTextEffect = getRuntimeConfig().buildStoredTextEffectPayload?.(textConfig, orderedTextTags) ?? {
    kind: textConfig.textKind === "文本飘字" ? "text" : "number",
    numberStyle: textConfig.textStyle,
    mode: textConfig.textMode === "模板模式" ? "template" : "default",
    template: textConfig.textTemplate,
    tags: orderedTextTags,
    tagPlayMode: textConfig.textTagPlayMode,
    comboEnabled: textConfig.comboEnabled,
    content: textConfig.textKind === "数字飘字" ? "" : (orderedTextTags[0] || textConfig.textContent || ""),
  };

  return {
    ...previousThemePack,
    id: themeId,
    name: themeRecord?.name ?? previousThemePack.name ?? themeId,
    description: themeRecord?.description ?? themeRecord?.summary ?? previousThemePack.description ?? "",
    kind: themeRecord?.kind === "内置" ? "builtin" : previousThemePack.kind || "custom",
    workbenchDraft: {
      actionConfigs: pickStoredWorkbenchActionConfigs(draft.actionConfigs),
    },
    cursorStates: Object.fromEntries(
      CURSOR_STATES.map((state) => [
        state.id,
        {
          ...toExtensionCursorState(draft.cursorModes[state.id], draft.cursorStateActions?.[state.id]),
          imageDataUrl: draft.cursorStateAssets?.[state.id]?.imageDataUrl || "",
          hotspotX: draft.cursorStateAssets?.[state.id]?.hotspotX ?? 16,
          hotspotY: draft.cursorStateAssets?.[state.id]?.hotspotY ?? 32,
          size: draft.cursorStateAssets?.[state.id]?.size ?? 48,
        },
      ])
    ),
    behavior: {
      ...previousThemePack.behavior,
      click: {
        ...previousThemePack.behavior?.click,
        enabled: textConfig.textEnabled || particleConfig.particle || rippleConfig.ripple,
        trigger: {
          ...previousThemePack.behavior?.click?.trigger,
          button: "left",
          cooldownMs: triggerConfig.holdMs,
        },
        effects: {
          ...previousEffects,
          text: {
            ...previousEffects.text,
            enabled: textConfig.textEnabled,
            ...storedTextEffect,
            color: textConfig.textColor,
            fontSize: textConfig.fontSize,
            fontWeight: mapFontWeightToStored(textConfig.textWeight),
            offsetX: textConfig.textOffsetX,
            offsetY: textConfig.textOffsetY,
            durationMs: textConfig.textDuration,
          },
          ripple: {
            ...previousEffects.ripple,
            enabled: rippleConfig.ripple,
            size: rippleConfig.rippleSize,
            durationMs: rippleConfig.rippleDuration,
          },
          particle: {
            ...previousEffects.particle,
            enabled: particleConfig.particle,
            count: particleConfig.particleCount,
            size: particleConfig.particleSize,
            baseDistance: particleConfig.particleSpread,
            durationMs: particleConfig.particleDuration,
          },
        },
      },
    },
  };
}

export function buildPreviewThemePackFromWorkbench(previousConfig, state) {
  return buildStoredThemePackFromWorkbench(previousConfig, state, state.selection.themeId);
}

export function buildStoredThemePackFromWorkbench(previousConfig, state, themeId = state.selection.themeId) {
  return buildStoredThemePack(
    themeId,
    state.draftsByTheme[themeId],
    previousConfig,
    state.themeLibrary.find((item) => item.id === themeId)
  );
}

export function buildStoredConfigFromWorkbench(previousConfig, state) {
  const nextThemePacks = (state.themeLibrary || []).map((theme) =>
    buildStoredThemePackFromWorkbench(previousConfig, state, theme.id)
  );

  const workspaceId = state.workspaceId === "workbench" ? "workspace" : state.workspaceId;
  const siteMode = toStoredSiteMode(state.siteMode);
  const runtime = getRuntimeConfig();
  const nextConfig = {
    ...previousConfig,
    enabled: state.ui.enabled,
    activeThemePackId: state.selection.themeId,
    activeSchemeId: state.selection.themeId,
    themePacks: nextThemePacks,
    schemes: nextThemePacks,
    siteRules: {
      ...(previousConfig.siteRules || {}),
      byHost: {
        ...(state.siteRulesByHost || {}),
      },
    },
    editor: {
      ...(previousConfig.editor || {}),
      lastWorkspace: workspaceId,
      lastActionId: state.selection.actionId,
      lastCursorState: state.selection.cursorStateId,
    },
  };

  if (state.site.host && typeof runtime.setSiteRuleMode === "function") {
    const nextConfigWithMode = runtime.setSiteRuleMode(nextConfig, state.site.host, siteMode);
    if (siteMode === "enabled" && typeof runtime.setSiteRuleThemePackId === "function") {
      return normalizeStoredConfig(runtime.setSiteRuleThemePackId(nextConfigWithMode, state.site.host, state.siteThemeId || state.selection.themeId));
    }
    return normalizeStoredConfig(nextConfigWithMode);
  }

  return normalizeStoredConfig(nextConfig);
}
