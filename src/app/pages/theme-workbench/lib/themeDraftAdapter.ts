import {
  ACTIONS,
  CURSOR_STATES,
  THEMES,
  buildThemeDrafts,
  buildThemeLibraryItem,
  createThemeDraft,
  mergeActionConfig,
  pickStoredWorkbenchActionConfigs,
} from "../model/workbenchSchema";
import { getDefaultConfig, normalizeStoredConfig } from "./runtimeConfig";

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
    ACTIONS.map((action) => {
      const baseActionConfig = baseDraft.actionConfigs[action.id];
      const storedActionConfig = storedActionConfigs[action.id] || {};
      return [
        action.id,
        mergeActionConfig(baseActionConfig, storedActionConfig),
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
  const workspaceAliasMap = {
    workspace: "workbench",
    diagnostics: "diagnostics",
    assets: "workbench",
  };
  const resolvedWorkspace = workspaceAliasMap[config.editor?.lastWorkspace] || config.editor?.lastWorkspace || "workbench";
  const PRIMARY_WORKSPACES = ["workbench", "states"];
  const workspaceId = PRIMARY_WORKSPACES.includes(resolvedWorkspace) ? resolvedWorkspace : "workbench";
  const selectedActionId = ACTIONS.some((item) => item.id === config.editor?.lastActionId) ? config.editor.lastActionId : "leftClick";
  const selectedCursorStateId = CURSOR_STATES.some((item) => item.id === config.editor?.lastCursorState) ? config.editor.lastCursorState : "default";

  return {
    workspaceId,
    selection: {
      themeId: selectedThemeId,
      actionId: selectedActionId,
      cursorStateId: selectedCursorStateId,
    },
    siteRules: Array.isArray(config.siteRules) ? config.siteRules : [],
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

function buildStoredThemePack(themeId, draft, previousConfig, themeRecord) {
  const previousThemePack = getStoredThemePack(previousConfig, themeId) ?? {};
  const storedAtmosphere = draft.atmosphere ?? previousThemePack?.workbenchDraft?.atmosphere;

  return {
    ...previousThemePack,
    id: themeId,
    name: themeRecord?.name ?? previousThemePack.name ?? themeId,
    icon: themeRecord?.icon ?? previousThemePack.icon ?? "Wand2",
    description: themeRecord?.description ?? themeRecord?.summary ?? previousThemePack.description ?? "",
    kind: themeRecord?.kind === "内置" ? "builtin" : previousThemePack.kind || "custom",
    workbenchDraft: {
      actionConfigs: pickStoredWorkbenchActionConfigs(draft.actionConfigs),
      ...(storedAtmosphere ? { atmosphere: storedAtmosphere } : {}),
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
  const nextConfig = {
    ...previousConfig,
    enabled: state.ui.enabled,
    activeThemePackId: state.selection.themeId,
    activeSchemeId: state.selection.themeId,
    themePacks: nextThemePacks,
    schemes: nextThemePacks,
    siteRules: Array.isArray(state.siteRules) ? state.siteRules : [],
    editor: {
      ...(previousConfig.editor || {}),
      lastWorkspace: workspaceId,
      lastActionId: state.selection.actionId,
      lastCursorState: state.selection.cursorStateId,
    },
  };

  return normalizeStoredConfig(nextConfig);
}
