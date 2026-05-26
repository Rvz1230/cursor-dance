import {
  THEMES,
  createThemeDraft,
} from "../model/workbenchSchema.js";
import {
  createWorkbenchThemeState,
  DEFAULT_WORKBENCH_SITE_MODE,
  SITE_MODE_ENABLED,
  SITE_MODE_DISABLED,
  SITE_MODE_FOLLOW,
} from "../lib/extensionConfig.js";

export const INITIAL_THEME_STATE = createWorkbenchThemeState(THEMES);

export const initialState = {
  workspaceId: "workbench",
  selection: {
    themeId: INITIAL_THEME_STATE.selectedThemeId,
    actionId: "leftClick",
    cursorStateId: "default",
  },
  siteMode: DEFAULT_WORKBENCH_SITE_MODE,
  siteThemeId: "",
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
  themeLibrary: INITIAL_THEME_STATE.themeLibrary,
  draftsByTheme: INITIAL_THEME_STATE.draftsByTheme,
};

export function reducer(state, action) {
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
      return {
        ...state,
        selection: { ...state.selection, themeId: action.payload },
        siteThemeId: state.siteMode === SITE_MODE_ENABLED ? state.siteThemeId : action.payload,
        ui: { ...state.ui, saveError: "" },
      };
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
        siteThemeId: select && state.siteMode !== SITE_MODE_ENABLED ? theme.id : state.siteThemeId,
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    }
    case "theme/library-remove": {
      const { themeId, nextSelectedThemeId } = action.payload;
      const nextDraftsByTheme = { ...state.draftsByTheme };
      delete nextDraftsByTheme[themeId];
      return {
        ...state,
        themeLibrary: state.themeLibrary.filter((theme) => theme.id !== themeId),
        draftsByTheme: nextDraftsByTheme,
        selection: {
          ...state.selection,
          themeId: nextSelectedThemeId || state.selection.themeId,
        },
        siteThemeId: state.siteThemeId === themeId ? (nextSelectedThemeId || state.selection.themeId) : state.siteThemeId,
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    }
    case "theme/library-rename": {
      const { themeId, name } = action.payload;
      return {
        ...state,
        themeLibrary: state.themeLibrary.map((theme) =>
          theme.id === themeId ? { ...theme, name } : theme
        ),
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    }
    case "theme/library-update-icon": {
      const { themeId, icon } = action.payload;
      return {
        ...state,
        themeLibrary: state.themeLibrary.map((theme) =>
          theme.id === themeId ? { ...theme, icon } : theme
        ),
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
      const nextRulesByHost = { ...state.siteRulesByHost };
      if (state.site.host) {
        if (action.payload === SITE_MODE_FOLLOW) {
          delete nextRulesByHost[state.site.host];
        } else {
          nextRulesByHost[state.site.host] = {
            ...(nextRulesByHost[state.site.host] || {}),
            mode: action.payload === SITE_MODE_ENABLED ? "enabled" : "disabled",
          };
          if (action.payload !== SITE_MODE_ENABLED) {
            delete nextRulesByHost[state.site.host].themePackId;
          } else if (!nextRulesByHost[state.site.host].themePackId) {
            nextRulesByHost[state.site.host].themePackId = state.siteThemeId || state.selection.themeId;
          }
        }
      }
      return {
        ...state,
        siteMode: action.payload,
        siteThemeId:
          action.payload === SITE_MODE_ENABLED
            ? (nextRulesByHost[state.site.host]?.themePackId || state.siteThemeId || state.selection.themeId)
            : state.selection.themeId,
        siteRulesByHost: nextRulesByHost,
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    }
    case "site-theme/set": {
      const nextThemeId = action.payload;
      const nextRulesByHost = { ...state.siteRulesByHost };
      if (state.site.host) {
        const currentRule = nextRulesByHost[state.site.host] || {};
        nextRulesByHost[state.site.host] = {
          ...currentRule,
          mode: "enabled",
          themePackId: nextThemeId,
        };
      }
      return {
        ...state,
        siteMode: SITE_MODE_ENABLED,
        siteThemeId: nextThemeId,
        siteRulesByHost: nextRulesByHost,
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    }
    case "site-rules/remove-host": {
      const nextRulesByHost = { ...state.siteRulesByHost };
      delete nextRulesByHost[action.payload];
      const currentHostRemoved = action.payload === state.site.host;
      return {
        ...state,
        siteRulesByHost: nextRulesByHost,
        siteMode: currentHostRemoved ? DEFAULT_WORKBENCH_SITE_MODE : state.siteMode,
        siteThemeId: currentHostRemoved ? state.selection.themeId : state.siteThemeId,
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    }
    case "site-rules/clear-all":
      return {
        ...state,
        siteMode: DEFAULT_WORKBENCH_SITE_MODE,
        siteThemeId: state.selection.themeId,
        siteRulesByHost: {},
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    case "site-rules/remove-hosts": {
      const nextRulesByHost = { ...state.siteRulesByHost };
      action.payload.forEach((host) => delete nextRulesByHost[host]);
      const currentHostRemoved = action.payload.includes(state.site.host);
      return {
        ...state,
        siteRulesByHost: nextRulesByHost,
        siteMode: currentHostRemoved ? DEFAULT_WORKBENCH_SITE_MODE : state.siteMode,
        siteThemeId: currentHostRemoved ? state.selection.themeId : state.siteThemeId,
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    }
    case "site-rules/add-host": {
      const { host, mode, themePackId } = action.payload;
      if (!host) return state;
      const normalizedHost = host.trim().toLowerCase();
      if (!normalizedHost) return state;
      const nextRulesByHost = { ...state.siteRulesByHost };
      nextRulesByHost[normalizedHost] = {
        mode,
        ...(mode === "enabled" && themePackId ? { themePackId } : {}),
      };
      const isCurrentHost = normalizedHost === state.site.host;
      return {
        ...state,
        siteRulesByHost: nextRulesByHost,
        siteMode: isCurrentHost
          ? (mode === "enabled" ? SITE_MODE_ENABLED : mode === "disabled" ? SITE_MODE_DISABLED : DEFAULT_WORKBENCH_SITE_MODE)
          : state.siteMode,
        siteThemeId: isCurrentHost && mode === "enabled" && themePackId
          ? themePackId
          : (isCurrentHost ? state.selection.themeId : state.siteThemeId),
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    }
    case "site-rules/update-host": {
      const { host, mode, themePackId } = action.payload;
      if (!host) return state;
      const normalizedHost = host.trim().toLowerCase();
      if (!normalizedHost || !state.siteRulesByHost[normalizedHost]) return state;
      const nextRulesByHost = { ...state.siteRulesByHost };
      const currentRule = { ...nextRulesByHost[normalizedHost] };
      if (mode !== undefined) {
        currentRule.mode = mode;
        if (mode !== "enabled") {
          delete currentRule.themePackId;
        }
      }
      if (themePackId !== undefined) {
        currentRule.themePackId = themePackId;
        currentRule.mode = "enabled";
      }
      nextRulesByHost[normalizedHost] = currentRule;
      const isCurrentHost = normalizedHost === state.site.host;
      return {
        ...state,
        siteRulesByHost: nextRulesByHost,
        siteMode: isCurrentHost
          ? (currentRule.mode === "enabled" ? SITE_MODE_ENABLED : currentRule.mode === "disabled" ? SITE_MODE_DISABLED : DEFAULT_WORKBENCH_SITE_MODE)
          : state.siteMode,
        siteThemeId: isCurrentHost && currentRule.mode === "enabled" && currentRule.themePackId
          ? currentRule.themePackId
          : (isCurrentHost && currentRule.mode !== "enabled" ? state.selection.themeId : state.siteThemeId),
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
          },
        },
      };
    }
    default:
      return state;
  }
}
