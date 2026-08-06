import {
  THEMES,
  createThemeDraft,
} from "../model/workbenchSchema";
import {
  createWorkbenchThemeState,
} from "../lib/workbenchConfig";
import {
  normalizeKeyFeedbackConfig,
} from "@/shared/config/key-feedback";
import type {
  AppRule,
} from "@/shared/app-rules";
import type {
  SiteRule,
  WorkbenchAction,
  WorkbenchState,
  WorkbenchTheme,
} from "./workbenchStateTypes";
import { findWorkbenchTheme } from "./workbenchThemeSelectors";

export const INITIAL_THEME_STATE = createWorkbenchThemeState(THEMES);

export const initialState: WorkbenchState = {
  workspaceId: "workbench",
  selection: {
    themeId: INITIAL_THEME_STATE.selectedThemeId,
    actionId: "leftClick",
    cursorStateId: "default",
  },
  siteRules: [],
  appRules: [],
  ui: {
    enabled: true,
    unsaved: true,
    isHydrated: false,
    isSaving: false,
    saveError: "",
    dirtyThemes: {},
  },
  site: {
    host: "example.com",
    isSupportedPage: false,
    tabId: null,
  },
  recentCursorAssets: [],
  themes: INITIAL_THEME_STATE.themes,
};

function replaceTheme(
  themes: WorkbenchTheme[],
  themeId: string,
  updater: (theme: WorkbenchTheme) => WorkbenchTheme,
): WorkbenchTheme[] {
  return themes.map((theme) => theme.meta.id === themeId ? updater(theme) : theme);
}

export function reducer(state: WorkbenchState, action: WorkbenchAction): WorkbenchState {
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
          dirtyThemes: {},
        },
      };
    case "workspace/set":
      if (state.workspaceId === action.payload) return state;
      return {
        ...state,
        workspaceId: action.payload,
      };
    case "theme/select":
      if (state.selection.themeId === action.payload) return state;
      return {
        ...state,
        selection: { ...state.selection, themeId: action.payload },
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    case "theme/add": {
      const { theme, select = true } = action.payload;
      return {
        ...state,
        themes: [...state.themes, theme],
        selection: select ? { ...state.selection, themeId: theme.meta.id } : state.selection,
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    }
    case "theme/remove": {
      const { themeId, nextSelectedThemeId } = action.payload;
      const nextDirtyThemes = { ...state.ui.dirtyThemes };
      delete nextDirtyThemes[themeId];
      return {
        ...state,
        themes: state.themes.filter((theme) => theme.meta.id !== themeId),
        selection: {
          ...state.selection,
          themeId: nextSelectedThemeId || state.selection.themeId,
        },
        ui: { ...state.ui, unsaved: true, saveError: "", dirtyThemes: nextDirtyThemes },
      };
    }
    case "theme/rename": {
      const { themeId, name } = action.payload;
      return {
        ...state,
        themes: replaceTheme(state.themes, themeId, (theme) => ({
          ...theme,
          meta: { ...theme.meta, name },
        })),
        ui: { ...state.ui, unsaved: true, saveError: "", dirtyThemes: { ...state.ui.dirtyThemes, [themeId]: true } },
      };
    }
    case "theme/update-icon": {
      const { themeId, icon } = action.payload;
      return {
        ...state,
        themes: replaceTheme(state.themes, themeId, (theme) => ({
          ...theme,
          meta: { ...theme.meta, icon },
        })),
        ui: { ...state.ui, unsaved: true, saveError: "", dirtyThemes: { ...state.ui.dirtyThemes, [themeId]: true } },
      };
    }
    case "action/select":
      if (state.selection.actionId === action.payload) return state;
      return {
        ...state,
        selection: { ...state.selection, actionId: action.payload },
      };
    case "cursor-state/select":
      if (state.selection.cursorStateId === action.payload) return state;
      return {
        ...state,
        selection: { ...state.selection, cursorStateId: action.payload },
      };
    case "global-enabled/set":
      if (state.ui.enabled === action.payload) return state;
      return { ...state, ui: { ...state.ui, enabled: action.payload, unsaved: true, saveError: "" } };
    case "rules/add": {
      const collection = action.payload?.collection === "appRules" ? "appRules" : "siteRules";
      const rule = action.payload?.rule;
      if (!rule || !rule.pattern || !rule.action) return state;
      const newRule = {
        id: rule.id || ("r" + (Date.now().toString(36) + Math.random().toString(36).slice(2, 6))),
        pattern: { ...rule.pattern },
        action: rule.action,
        enabled: rule.enabled !== false,
      };
      return collection === "appRules"
        ? {
            ...state,
            appRules: [...state.appRules, newRule as AppRule],
            ui: { ...state.ui, unsaved: true, saveError: "" },
          }
        : {
            ...state,
            siteRules: [...state.siteRules, newRule as SiteRule],
            ui: { ...state.ui, unsaved: true, saveError: "" },
          };
    }
    case "rules/update": {
      const collection = action.payload?.collection === "appRules" ? "appRules" : "siteRules";
      const { id, updates } = action.payload;
      if (collection === "appRules") {
        return {
          ...state,
          appRules: state.appRules.map((rule) =>
            rule.id === id ? { ...rule, ...(updates as Partial<AppRule>) } : rule
          ),
          ui: { ...state.ui, unsaved: true, saveError: "" },
        };
      }
      return {
        ...state,
        siteRules: state.siteRules.map((rule) =>
          rule.id === id ? { ...rule, ...(updates as Partial<SiteRule>) } : rule
        ),
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    }
    case "rules/delete": {
      const collection = action.payload?.collection === "appRules" ? "appRules" : "siteRules";
      const ruleId = action.payload?.id;
      return {
        ...state,
        [collection]: state[collection].filter((rule) => rule.id !== ruleId),
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    }
    case "rules/reorder": {
      const collection = action.payload?.collection === "appRules" ? "appRules" : "siteRules";
      const { from, to } = action.payload;
      const nextRules = [...state[collection]];
      const [moved] = nextRules.splice(from, 1);
      nextRules.splice(to, 0, moved);
      return {
        ...state,
        [collection]: nextRules,
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    }
    case "rules/toggle": {
      const collection = action.payload?.collection === "appRules" ? "appRules" : "siteRules";
      const ruleId = action.payload?.id;
      return {
        ...state,
        [collection]: state[collection].map((rule) =>
          rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
        ),
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    }
    case "rules/clear-all": {
      const collection = action.payload?.collection === "appRules" ? "appRules" : "siteRules";
      return {
        ...state,
        [collection]: [],
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    }
    case "save/start":
      return { ...state, ui: { ...state.ui, isSaving: true, saveError: "" } };
    case "save/success":
      if (action.payload?.preserveUnsaved) {
        return {
          ...state,
          ui: { ...state.ui, isSaving: false, saveError: "" },
        };
      }
      return {
        ...state,
        ui: { ...state.ui, unsaved: false, isSaving: false, saveError: "", dirtyThemes: {} },
      };
    case "save/error":
      return { ...state, ui: { ...state.ui, isSaving: false, saveError: action.payload || "保存失败" } };
    case "recent-assets/set":
      return { ...state, recentCursorAssets: action.payload };
    case "theme/update-current": {
      const themeId = state.selection.themeId;
      const currentTheme = findWorkbenchTheme(state.themes, themeId);
      if (!currentTheme) return state;
      return {
        ...state,
        ui: { ...state.ui, unsaved: true, saveError: "", dirtyThemes: { ...state.ui.dirtyThemes, [themeId]: true } },
        themes: replaceTheme(state.themes, themeId, (theme) => ({
          ...theme,
          draft: action.payload(theme.draft),
        })),
      };
    }
    case "theme/reset-current": {
      const themeId = state.selection.themeId;
      const resetDraft = createThemeDraft(themeId);
      const currentDraft = findWorkbenchTheme(state.themes, themeId)?.draft;
      const resetActionConfigs = currentDraft?.resetActionConfigs || resetDraft.resetActionConfigs;
      const resetKeyFeedbackConfig = normalizeKeyFeedbackConfig(currentDraft?.resetKeyFeedbackConfig || resetDraft.resetKeyFeedbackConfig);
      return {
        ...state,
        ui: { ...state.ui, unsaved: true, saveError: "", dirtyThemes: { ...state.ui.dirtyThemes, [themeId]: true } },
        themes: replaceTheme(state.themes, themeId, (theme) => ({
          ...theme,
          draft: {
            ...resetDraft,
            actionConfigs: resetActionConfigs,
            resetActionConfigs,
            keyFeedbackConfig: resetKeyFeedbackConfig,
            resetKeyFeedbackConfig,
          },
        })),
      };
    }
    case "theme/discard-changes": {
      const { themeId, draft } = action.payload;
      const nextDirtyThemes = { ...state.ui.dirtyThemes };
      delete nextDirtyThemes[themeId];
      const hasDirty = Object.keys(nextDirtyThemes).length > 0;
      return {
        ...state,
        ui: { ...state.ui, unsaved: hasDirty, dirtyThemes: nextDirtyThemes },
        themes: replaceTheme(state.themes, themeId, (theme) => ({ ...theme, draft })),
      };
    }
    case "key-feedback/update": {
      const themeId = state.selection.themeId;
      const currentDraft = findWorkbenchTheme(state.themes, themeId)?.draft || createThemeDraft(themeId);
      return {
        ...state,
        ui: { ...state.ui, unsaved: true, saveError: "", dirtyThemes: { ...state.ui.dirtyThemes, [themeId]: true } },
        themes: replaceTheme(state.themes, themeId, (theme) => ({
          ...theme,
          draft: {
            ...currentDraft,
            keyFeedbackConfig: normalizeKeyFeedbackConfig({
              ...(currentDraft.keyFeedbackConfig || {}),
              ...action.payload,
            }),
          },
        })),
      };
    }
    default:
      return state;
  }
}
