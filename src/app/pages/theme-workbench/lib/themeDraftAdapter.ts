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

interface BuildStoredThemePackOptions {
  includeAtmosphere?: boolean;
}

const LEGACY_CURSOR_STATE_TO_SKIN_STATE = {
  default: "default",
  pointer: "pointer",
  text: "text",
  wait: "busy",
  notAllowed: "notAllowed",
};

const LEGACY_CURSOR_STATE_IDS = ["default", "pointer", "text", "help", "wait", "notAllowed"];

function inferCursorSkinMimeType(dataUrl) {
  if (typeof dataUrl !== "string") return "image/unknown";
  if (dataUrl.startsWith("data:image/png")) return "image/png";
  if (dataUrl.startsWith("data:image/svg+xml")) return "image/svg+xml";
  if (dataUrl.startsWith("data:image/webp")) return "image/webp";
  return "image/unknown";
}

function cursorSkinStateFromAsset(asset) {
  if (!asset?.imageDataUrl) return null;
  const size = Number.isFinite(asset.size) ? asset.size : 48;
  return {
    image: {
      kind: "dataUrl",
      mimeType: asset.mimeType || inferCursorSkinMimeType(asset.imageDataUrl),
      dataUrl: asset.imageDataUrl,
      width: asset.sourceWidth || size,
      height: asset.sourceHeight || size,
    },
    hotspot: {
      x: Number.isFinite(asset.hotspotX) ? asset.hotspotX : 0,
      y: Number.isFinite(asset.hotspotY) ? asset.hotspotY : 0,
    },
    size: { mode: "fixedBox", boxSize: size },
  };
}

function cursorSkinStateFromLegacyCursorState(cursorState) {
  if (!cursorState?.imageDataUrl) return null;
  return cursorSkinStateFromAsset({
    imageDataUrl: cursorState.imageDataUrl,
    hotspotX: cursorState.hotspotX,
    hotspotY: cursorState.hotspotY,
    size: cursorState.size,
  });
}

function assetFromCursorSkinState(skinState) {
  if (!skinState?.image?.dataUrl) return null;
  const size = skinState.size?.mode === "fixedBox" ? (skinState.size.boxSize || 48) : Math.max(skinState.image.width || 48, skinState.image.height || 48);
  return {
    imageDataUrl: skinState.image.dataUrl,
    hotspotX: skinState.hotspot?.x ?? 0,
    hotspotY: skinState.hotspot?.y ?? 0,
    size,
    sourceWidth: skinState.image.width || size,
    sourceHeight: skinState.image.height || size,
    mimeType: skinState.image.mimeType,
  };
}

function normalizeDraftCursorSkin(baseDraft, themePack, cursorDraft) {
  const persistedSkin = themePack?.cursorSkin ?? themePack?.workbenchDraft?.cursorSkin;
  const storedSkin = persistedSkin ?? baseDraft.cursorSkin;
  const states = { ...(storedSkin?.states || {}) };

  // cursorSkin 一旦持久化，就以它为唯一真相源；空 states 可能是用户主动清除的结果。
  // 只有旧配置完全没有 cursorSkin 时，才从兼容字段执行一次迁移。
  if (!persistedSkin) {
    Object.entries(themePack?.cursorStates || {}).forEach(([legacyStateId, cursorState]) => {
      const skinStateId = LEGACY_CURSOR_STATE_TO_SKIN_STATE[legacyStateId];
      if (!skinStateId || states[skinStateId]) return;
      const skinState = cursorSkinStateFromLegacyCursorState(cursorState);
      if (skinState) states[skinStateId] = skinState;
    });

    Object.entries(cursorDraft.cursorStateAssets || {}).forEach(([stateId, asset]) => {
      if (states[stateId]) return;
      const skinState = cursorSkinStateFromAsset(asset);
      if (skinState) states[stateId] = skinState;
    });
  }

  return {
    version: 1,
    enabled: storedSkin?.enabled !== false,
    transitionMs: Number.isFinite(storedSkin?.transitionMs) ? storedSkin.transitionMs : 80,
    states,
  };
}

function toWorkbenchCursorMode(stateId, mode) {
  if (stateId === "default") return "源";
  return mode === "override" ? "覆盖" : "继承";
}

function toExtensionCursorState(mode, actionId) {
  return {
    mode: mode === "覆盖" ? "override" : "inherit",
    actionId: typeof actionId === "string" ? actionId : "leftClick",
  };
}

function buildDraftActionConfigs(baseDraft, themePack) {
  const storedActionConfigs = themePack?.workbenchDraft?.actionConfigs || {};

  return Object.fromEntries(
    PLATFORM_ACTIONS.map((action) => {
      const baseActionConfig = baseDraft.actionConfigs[action.id];
      const storedActionConfig = storedActionConfigs[action.id] || {};
      return [
        action.id,
        mergeActionConfig(baseActionConfig, storedActionConfig),
      ];
    })
  );
}

function buildResetActionConfigs(baseDraft, themePack, actionConfigs) {
  const storedResetActionConfigs = themePack?.workbenchDraft?.resetActionConfigs;
  if (storedResetActionConfigs) {
    return buildDraftActionConfigs(baseDraft, { workbenchDraft: { actionConfigs: storedResetActionConfigs } });
  }
  const isBuiltInTheme = THEMES.some((theme) => theme.id === themePack?.id);
  return isBuiltInTheme ? buildDraftActionConfigs(baseDraft, undefined) : buildDraftActionConfigs({ actionConfigs }, undefined);
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
  const draftStates = CURSOR_STATES.map((state) => [state.id, buildDraftCursorState(baseDraft, themePack, state.id)] as const);
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
  const cursorSkin = normalizeDraftCursorSkin(baseDraft, themePack, cursorDraft);
  const actionConfigs = buildDraftActionConfigs(baseDraft, themePack);
  const keyFeedbackConfig = normalizeKeyFeedbackConfig(themePack?.workbenchDraft?.keyFeedbackConfig || baseDraft.keyFeedbackConfig);
  const resetKeyFeedbackConfig = normalizeKeyFeedbackConfig(themePack?.workbenchDraft?.resetKeyFeedbackConfig || keyFeedbackConfig);

  return {
    ...baseDraft,
    ...(themePack?.workbenchDraft || {}),
    cursorModes: cursorDraft.cursorModes,
    cursorStateActions: cursorDraft.cursorStateActions,
    cursorStateAssets: cursorDraft.cursorStateAssets,
    cursorSkin,
    keyFeedbackConfig,
    resetKeyFeedbackConfig,
    actionConfigs,
    resetActionConfigs: buildResetActionConfigs(baseDraft, themePack, actionConfigs),
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
    selectedThemeId: resolveSelectedThemeId(nextThemeLibrary, nextDraftsByTheme, undefined),
  };
}

export function hydrateWorkbenchState(config, site) {
  const storedThemePacks = Array.isArray(config?.themePacks) ? config.themePacks : [];
  const themeLibrary = buildThemeLibrary(config);
  const baseThemeState = createWorkbenchThemeState(themeLibrary);
  const draftsByTheme = {
    ...baseThemeState.draftsByTheme,
  };

  storedThemePacks.forEach((themePack) => {
    draftsByTheme[themePack.id] = buildDraftFromThemePack(themePack);
  });

  const selectedThemeId = resolveSelectedThemeId(themeLibrary, draftsByTheme, config.activeThemePackId);
  if (config.keyFeedbackConfig) {
    storedThemePacks.forEach((themePack) => {
      if (themePack?.workbenchDraft?.keyFeedbackConfig) return;
      draftsByTheme[themePack.id] = {
        ...(draftsByTheme[themePack.id] || createThemeDraft(themePack.id)),
        keyFeedbackConfig: normalizeKeyFeedbackConfig(config.keyFeedbackConfig),
        resetKeyFeedbackConfig: normalizeKeyFeedbackConfig(config.keyFeedbackConfig),
      };
    });
  }
  const workspaceAliasMap = {
    workspace: "workbench",
    states: "states",
    sites: "sites",
    diagnostics: "diagnostics",
    keyboard: "keyboard",
    assets: "workbench",
  };
  const resolvedWorkspace = workspaceAliasMap[config.editor?.lastWorkspace] || config.editor?.lastWorkspace || "workbench";
  const PRIMARY_WORKSPACES = ["workbench", "states", "sites", "keyboard"];
  const workspaceId = PRIMARY_WORKSPACES.includes(resolvedWorkspace) ? resolvedWorkspace : "workbench";
  const selectedActionId = PLATFORM_ACTIONS.some((item) => item.id === config.editor?.lastActionId) ? config.editor.lastActionId : "leftClick";
  const lastCursorState = config.editor?.lastCursorState === "wait" ? "busy" : config.editor?.lastCursorState;
  const selectedCursorStateId = CURSOR_STATES.some((item) => item.id === lastCursorState) ? lastCursorState : "default";

  return {
    workspaceId,
    selection: {
      themeId: selectedThemeId,
      actionId: selectedActionId,
      cursorStateId: selectedCursorStateId,
    },
    siteRules: Array.isArray(config.siteRules) ? config.siteRules : [],
    appRules: Array.isArray(config.appRules) ? config.appRules : [],
    themeLibrary,
    ui: {
      enabled: config.enabled !== false,
      unsaved: false,
    },
    site,
    draftsByTheme,
  };
}

function getStoredThemePack(config, themeId) {
  return config.themePacks.find((item) => item.id === themeId) ?? getDefaultConfig().themePacks?.find((item) => item.id === themeId) ?? null;
}

function buildStoredCursorStates(draft) {
  const hasCursorSkin = draft.cursorSkin && typeof draft.cursorSkin === "object";
  return Object.fromEntries(
    LEGACY_CURSOR_STATE_IDS.map((stateId) => {
      const skinStateId = LEGACY_CURSOR_STATE_TO_SKIN_STATE[stateId];
      const skinAsset = skinStateId ? assetFromCursorSkinState(draft.cursorSkin?.states?.[skinStateId]) : null;
      const draftAsset = draft.cursorStateAssets?.[stateId] || {};
      // 新模型存在时，缺失状态表示用户主动清除；不能再从旧草稿素材回填。
      const asset = hasCursorSkin ? skinAsset : (skinAsset || draftAsset);

      return [
        stateId,
        {
          ...toExtensionCursorState(draft.cursorModes?.[stateId], draft.cursorStateActions?.[stateId]),
          imageDataUrl: asset?.imageDataUrl || "",
          hotspotX: asset?.hotspotX ?? 16,
          hotspotY: asset?.hotspotY ?? 32,
          size: asset?.size ?? 48,
        },
      ];
    })
  );
}

function buildStoredThemePack(
  themeId,
  draft,
  previousConfig,
  themeRecord,
  options: BuildStoredThemePackOptions = {},
) {
  const previousThemePack = getStoredThemePack(previousConfig, themeId) ?? {};
  const includeAtmosphere = options.includeAtmosphere ?? !isDesktop();
  const storedAtmosphere = includeAtmosphere
    ? draft.atmosphere ?? previousThemePack?.workbenchDraft?.atmosphere
    : undefined;

  return {
    ...previousThemePack,
    id: themeId,
    name: themeRecord?.name ?? previousThemePack.name ?? themeId,
    icon: themeRecord?.icon ?? previousThemePack.icon ?? "Wand2",
    description: themeRecord?.description ?? themeRecord?.summary ?? previousThemePack.description ?? "",
    kind: themeRecord?.kind === "内置" ? "builtin" : previousThemePack.kind || "custom",
    workbenchDraft: {
      actionConfigs: pickStoredWorkbenchActionConfigs(draft.actionConfigs),
      resetActionConfigs: pickStoredWorkbenchActionConfigs(draft.resetActionConfigs || draft.actionConfigs),
      cursorSkin: draft.cursorSkin,
      keyFeedbackConfig: normalizeKeyFeedbackConfig(draft.keyFeedbackConfig),
      resetKeyFeedbackConfig: normalizeKeyFeedbackConfig(draft.resetKeyFeedbackConfig || draft.keyFeedbackConfig),
      ...(storedAtmosphere ? { atmosphere: storedAtmosphere } : {}),
    },
    cursorSkin: draft.cursorSkin,
    cursorStates: buildStoredCursorStates(draft),
  };
}

export function buildPreviewThemePackFromWorkbench(previousConfig, state) {
  return buildStoredThemePackFromWorkbench(previousConfig, state, state.selection.themeId);
}

export function buildStoredThemePackFromWorkbench(
  previousConfig,
  state,
  themeId = state.selection.themeId,
  options: BuildStoredThemePackOptions = {},
) {
  return buildStoredThemePack(
    themeId,
    state.draftsByTheme[themeId],
    previousConfig,
    state.themeLibrary.find((item) => item.id === themeId),
    options,
  );
}

export function buildStoredConfigFromWorkbench(previousConfig, state) {
  const nextThemePacks = (state.themeLibrary || []).map((theme) =>
    buildStoredThemePackFromWorkbench(previousConfig, state, theme.id)
  );

  const workspaceId = state.workspaceId === "workbench" ? "workspace" : state.workspaceId;
  const nextConfig = {
    ...previousConfig,
    enabled: state.ui.enabled,
    activeThemePackId: state.selection.themeId,
    activeSchemeId: state.selection.themeId,
    themePacks: nextThemePacks,
    schemes: nextThemePacks,
    siteRules: Array.isArray(state.siteRules) ? state.siteRules : [],
    appRules: Array.isArray(state.appRules) ? state.appRules : [],
    editor: {
      ...(previousConfig.editor || {}),
      lastWorkspace: workspaceId,
      lastActionId: state.selection.actionId,
      lastCursorState: state.selection.cursorStateId,
    },
  };

  return normalizeStoredConfig(nextConfig);
}
