import { useEffect, useMemo, useReducer, useRef } from "react";
import {
  ACTIONS,
  CURSOR_STATES,
  THEMES,
  WORKSPACES,
  buildDefaultCursorStateActions,
  buildDefaultCursorStateAssets,
  buildThemeDrafts,
  createThemeDraft,
  getConflictsForAction,
} from "../model/workbenchSchema.js";
import {
  buildPreviewThemePackFromWorkbench,
  buildStoredConfigFromWorkbench,
  draftFromThemePack,
  hydrateWorkbenchState,
  previewThemePack,
  readActiveSiteContext,
  readExtensionConfig,
  readRecentCursorAssets,
  subscribeExtensionConfig,
  themePackToThemeLibraryItem,
  writeRecentCursorAsset,
  writeExtensionConfig,
} from "../lib/extensionConfig.js";

const initialState = {
  workspaceId: "workbench",
  selection: {
    themeId: THEMES[0].id,
    actionId: "leftClick",
    cursorStateId: "default",
  },
  ui: {
    enabled: true,
    unsaved: true,
    siteFilter: "",
    isHydrated: false,
    isSaving: false,
    saveError: "",
  },
  site: {
    host: "example.com",
    isSupportedPage: false,
    tabId: null,
  },
  recentCursorAssets: [],
  siteRulesByHost: {},
  themeLibrary: THEMES,
  draftsByTheme: buildThemeDrafts(),
};

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function slugifyThemeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function buildUniqueThemeId(name, existingIds) {
  const base = slugifyThemeName(name) || "custom-theme";
  if (!existingIds.has(base)) return base;
  let index = 2;
  while (existingIds.has(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}

function resolveImportedThemePack(rawValue) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    throw new Error("导入失败：JSON 需要是一个主题对象。");
  }

  const candidate = rawValue.themePack || rawValue.theme || rawValue.pack || rawValue.cursordanceTheme || rawValue;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("导入失败：没有识别到可用的主题包。");
  }

  if (!candidate.workbenchDraft && !candidate.behavior && !candidate.cursorStates) {
    throw new Error("导入失败：主题包里缺少行为配置。");
  }

  return candidate;
}

function reducer(state, action) {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        ...action.payload,
        ui: {
          ...state.ui,
          ...action.payload.ui,
          isHydrated: true,
          isSaving: false,
          saveError: "",
        },
      };
    case "workspace/set":
      return {
        ...state,
        workspaceId: action.payload,
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    case "theme/select":
      return { ...state, selection: { ...state.selection, themeId: action.payload }, ui: { ...state.ui, saveError: "" } };
    case "theme/library-add": {
      const { theme, draft, select = true } = action.payload;
      return {
        ...state,
        themeLibrary: [...state.themeLibrary, theme],
        draftsByTheme: {
          ...state.draftsByTheme,
          [theme.id]: draft,
        },
        selection: select ? { ...state.selection, themeId: theme.id } : state.selection,
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    }
    case "action/select":
      return {
        ...state,
        selection: { ...state.selection, actionId: action.payload },
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    case "cursor-state/select":
      return {
        ...state,
        selection: { ...state.selection, cursorStateId: action.payload },
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    case "global-enabled/set":
      return { ...state, ui: { ...state.ui, enabled: action.payload, unsaved: true, saveError: "" } };
    case "site-filter/set":
      return { ...state, ui: { ...state.ui, siteFilter: action.payload } };
    case "site-mode/set": {
      const nextDrafts = Object.fromEntries(
        Object.entries(state.draftsByTheme).map(([themeId, themeDraft]) => [
          themeId,
          {
            ...themeDraft,
            siteMode: action.payload,
          },
        ])
      );
      const nextRulesByHost = { ...state.siteRulesByHost };
      if (state.site.host) {
        if (action.payload === "跟随全局") {
          delete nextRulesByHost[state.site.host];
        } else {
          nextRulesByHost[state.site.host] = {
            ...(nextRulesByHost[state.site.host] || {}),
            mode: action.payload === "当前启用" ? "enabled" : "disabled",
          };
        }
      }
      return {
        ...state,
        draftsByTheme: nextDrafts,
        siteRulesByHost: nextRulesByHost,
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    }
    case "site-rules/clear-all":
      return {
        ...state,
        siteRulesByHost: {},
        draftsByTheme: Object.fromEntries(
          Object.entries(state.draftsByTheme).map(([themeId, themeDraft]) => [
            themeId,
            {
              ...themeDraft,
              siteMode: "跟随全局",
            },
          ])
        ),
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    case "site-rules/remove-hosts": {
      const nextRulesByHost = { ...state.siteRulesByHost };
      action.payload.forEach((host) => delete nextRulesByHost[host]);
      const currentHostRemoved = action.payload.includes(state.site.host);
      return {
        ...state,
        siteRulesByHost: nextRulesByHost,
        draftsByTheme: currentHostRemoved
          ? Object.fromEntries(
              Object.entries(state.draftsByTheme).map(([themeId, themeDraft]) => [
                themeId,
                {
                  ...themeDraft,
                  siteMode: "跟随全局",
                },
              ])
            )
          : state.draftsByTheme,
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    }
    case "save/start":
      return { ...state, ui: { ...state.ui, isSaving: true, saveError: "" } };
    case "save/success":
      return { ...state, ui: { ...state.ui, unsaved: false, isSaving: false, saveError: "" } };
    case "save/error":
      return { ...state, ui: { ...state.ui, isSaving: false, saveError: action.payload || "保存失败" } };
    case "recent-assets/set":
      return { ...state, recentCursorAssets: action.payload };
    case "theme/update-current": {
      const themeId = state.selection.themeId;
      return {
        ...state,
        ui: { ...state.ui, unsaved: true, saveError: "" },
        draftsByTheme: {
          ...state.draftsByTheme,
          [themeId]: action.payload(state.draftsByTheme[themeId]),
        },
      };
    }
    case "theme/reset-current": {
      const themeId = state.selection.themeId;
      return {
        ...state,
        ui: { ...state.ui, unsaved: true, saveError: "" },
        draftsByTheme: {
          ...state.draftsByTheme,
          [themeId]: {
            ...createThemeDraft(themeId),
            siteMode: state.draftsByTheme[themeId].siteMode,
          },
        },
      };
    }
    default:
      return state;
  }
}

export function useThemeWorkbenchState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const configRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const [config, site, recentCursorAssets] = await Promise.all([readExtensionConfig(), readActiveSiteContext(), readRecentCursorAssets()]);
      if (cancelled) return;
      configRef.current = config;
      dispatch({ type: "hydrate", payload: { ...hydrateWorkbenchState(config, site), recentCursorAssets } });
    }

    hydrate();

    const unsubscribe = subscribeExtensionConfig(async (nextConfigOrUpdater) => {
      const site = await readActiveSiteContext();
      const nextConfig =
        typeof nextConfigOrUpdater === "function"
          ? nextConfigOrUpdater(configRef.current ?? {})
          : nextConfigOrUpdater;
      configRef.current = nextConfig;
      if (cancelled) return;
      dispatch({ type: "hydrate", payload: hydrateWorkbenchState(nextConfig, site) });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const selected = state.selection;
  const activeTheme = useMemo(
    () => state.themeLibrary.find((item) => item.id === selected.themeId) ?? state.themeLibrary[0] ?? THEMES[0],
    [selected.themeId, state.themeLibrary]
  );
  const draft = state.draftsByTheme[selected.themeId];
  const currentActionConfig = draft.actionConfigs[selected.actionId];
  const currentConflicts = getConflictsForAction(selected.actionId, draft.actionConfigs);
  const isWorkbench = state.workspaceId === "workbench";

  function updateCurrentTheme(updater) {
    dispatch({ type: "theme/update-current", payload: updater });
  }

  async function saveChanges() {
    dispatch({ type: "save/start" });
    try {
      const nextConfig = buildStoredConfigFromWorkbench(configRef.current ?? (await readExtensionConfig()), state);
      const savedConfig = await writeExtensionConfig(nextConfig);
      configRef.current = savedConfig;
      dispatch({ type: "save/success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存失败，请重试";
      dispatch({ type: "save/error", payload: message });
    }
  }

  async function previewActiveTheme() {
    const currentConfig = configRef.current ?? (await readExtensionConfig());
    const previewTheme = buildPreviewThemePackFromWorkbench(currentConfig, state);
    await previewThemePack(selected.themeId, previewTheme, selected.actionId);
  }

  async function rememberRecentCursorAsset(assetRecord) {
    const nextRecentAssets = await writeRecentCursorAsset(assetRecord);
    dispatch({ type: "recent-assets/set", payload: nextRecentAssets });
  }

  function createTheme({ name, description = "", basedOnThemeId = "blank" }) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error("请先填写主题名称。");
    }

    const existingIds = new Set(state.themeLibrary.map((item) => item.id));
    const themeId = buildUniqueThemeId(trimmedName, existingIds);
    const baseDraft =
      basedOnThemeId === "blank"
        ? createThemeDraft(themeId)
        : cloneValue(state.draftsByTheme[basedOnThemeId] || createThemeDraft(themeId));
    const basedOnTheme = state.themeLibrary.find((item) => item.id === basedOnThemeId);

    dispatch({
      type: "theme/library-add",
      payload: {
        theme: {
          id: themeId,
          name: trimmedName,
          kind: "自定义",
          summary: description.trim() || (basedOnThemeId === "blank" ? "从空白模板开始。" : `基于 ${basedOnTheme?.name || "当前主题"} 创建。`),
          description: description.trim(),
          tone: basedOnTheme?.tone || "amber",
        },
        draft: baseDraft,
      },
    });
  }

  function importThemeFromText(text, fileName = "") {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("导入失败：文件不是合法的 JSON。");
    }

    const importedThemePack = resolveImportedThemePack(parsed);
    const fallbackName = fileName.replace(/\.[^.]+$/, "").trim();
    const resolvedName = importedThemePack.name || fallbackName || "导入主题";
    const existingIds = new Set(state.themeLibrary.map((item) => item.id));
    const nextId = buildUniqueThemeId(importedThemePack.id || resolvedName, existingIds);
    const siteMode = state.draftsByTheme[selected.themeId]?.siteMode || "跟随全局";
    const nextThemePack = {
      ...cloneValue(importedThemePack),
      id: nextId,
      name: resolvedName,
      kind: importedThemePack.kind || "custom",
    };

    dispatch({
      type: "theme/library-add",
      payload: {
        theme: themePackToThemeLibraryItem(nextThemePack, state.themeLibrary.length),
        draft: draftFromThemePack(nextThemePack, siteMode),
      },
    });
  }

  return {
    state,
    selected,
    themes: state.themeLibrary,
    activeTheme,
    draft,
    currentActionConfig,
    currentConflicts,
    isWorkbench,
    workspaceItems: WORKSPACES,
    actionItems: ACTIONS,
    cursorStates: CURSOR_STATES,
    recentCursorAssets: state.recentCursorAssets,
    setWorkspaceId: (value) => dispatch({ type: "workspace/set", payload: value }),
    setThemeId: (value) => dispatch({ type: "theme/select", payload: value }),
    setActionId: (value) => dispatch({ type: "action/select", payload: value }),
    setCursorStateId: (value) => dispatch({ type: "cursor-state/select", payload: value }),
    setEnabled: (value) => dispatch({ type: "global-enabled/set", payload: value }),
    saveChanges,
    previewActiveTheme,
    createTheme,
    importThemeFromText,
    resetCurrentTheme: () => dispatch({ type: "theme/reset-current" }),
    setSiteFilter: (value) => dispatch({ type: "site-filter/set", payload: value }),
    updateActionConfig: (patch) =>
      updateCurrentTheme((current) => ({
        ...current,
        actionConfigs: {
          ...current.actionConfigs,
          [selected.actionId]: {
            ...current.actionConfigs[selected.actionId],
            ...patch,
          },
        },
      })),
    updateCursorMode: (mode) =>
      updateCurrentTheme((current) => ({
        ...current,
        cursorModes: {
          ...current.cursorModes,
          [selected.cursorStateId]: mode,
        },
      })),
    updateCursorStateAction: (actionId) =>
      updateCurrentTheme((current) => ({
        ...current,
        cursorStateActions: {
          ...current.cursorStateActions,
          [selected.cursorStateId]: actionId,
        },
      })),
    updateCursorStateAsset: (patch) =>
      updateCurrentTheme((current) => ({
        ...current,
        cursorModes:
          selected.cursorStateId !== "default"
            ? {
                ...current.cursorModes,
                [selected.cursorStateId]: "覆盖",
              }
            : current.cursorModes,
        cursorStateAssets: {
          ...current.cursorStateAssets,
          [selected.cursorStateId]: {
            ...current.cursorStateAssets[selected.cursorStateId],
            ...patch,
          },
        },
      })),
    rememberRecentCursorAsset,
    copyDefaultCursorStateAsset: () =>
      updateCurrentTheme((current) => ({
        ...current,
        cursorModes:
          selected.cursorStateId !== "default"
            ? {
                ...current.cursorModes,
                [selected.cursorStateId]: "覆盖",
              }
            : current.cursorModes,
        cursorStateAssets: {
          ...current.cursorStateAssets,
          [selected.cursorStateId]: {
            ...current.cursorStateAssets.default,
          },
        },
      })),
    resetCurrentCursorState: () => {
      const stateMeta = CURSOR_STATES.find((item) => item.id === selected.cursorStateId);
      if (!stateMeta) return;
      updateCurrentTheme((current) => ({
        ...current,
        cursorModes: {
          ...current.cursorModes,
          [selected.cursorStateId]: stateMeta.defaultMode,
        },
        cursorStateActions: {
          ...current.cursorStateActions,
          [selected.cursorStateId]: buildDefaultCursorStateActions()[selected.cursorStateId],
        },
        cursorStateAssets: {
          ...current.cursorStateAssets,
          [selected.cursorStateId]: buildDefaultCursorStateAssets()[selected.cursorStateId],
        },
      }));
    },
    resetAllCursorStates: () =>
      updateCurrentTheme((current) => ({
        ...current,
        cursorModes: Object.fromEntries(CURSOR_STATES.map((item) => [item.id, item.defaultMode])),
        cursorStateActions: buildDefaultCursorStateActions(),
        cursorStateAssets: buildDefaultCursorStateAssets(),
      })),
    setSiteMode: (mode) => dispatch({ type: "site-mode/set", payload: mode }),
    clearAllSiteRules: () => dispatch({ type: "site-rules/clear-all" }),
    clearFilteredSiteRules: (hosts) => dispatch({ type: "site-rules/remove-hosts", payload: hosts }),
  };
}
