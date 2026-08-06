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
  domain: {
    enabled: true,
    activeThemeId: INITIAL_THEME_STATE.selectedThemeId,
    themes: INITIAL_THEME_STATE.themes,
    siteRules: [],
    appRules: [],
  },
  editor: {
    workspaceId: "workbench",
    actionId: "leftClick",
    cursorStateId: "default",
  },
  status: {
    unsaved: true,
    isHydrated: false,
    isSaving: false,
    saveError: "",
    dirtyThemes: {},
  },
  runtime: {
    site: {
      host: "example.com",
      isSupportedPage: false,
      tabId: null,
    },
    recentCursorAssets: [],
  },
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
        domain: { ...state.domain, ...action.payload.domain },
        editor: { ...state.editor, ...action.payload.editor },
        runtime: { ...state.runtime, ...action.payload.runtime },
        status: {
          ...state.status,
          ...action.payload.status,
          isHydrated: true,
          isSaving: false,
          saveError: "",
          dirtyThemes: {},
        },
      };
    case "workspace/set":
      if (state.editor.workspaceId === action.payload) return state;
      return {
        ...state,
        editor: { ...state.editor, workspaceId: action.payload },
      };
    case "theme/select":
      if (state.domain.activeThemeId === action.payload) return state;
      return {
        ...state,
        domain: { ...state.domain, activeThemeId: action.payload },
        status: { ...state.status, unsaved: true, saveError: "" },
      };
    case "theme/add": {
      const { theme, select = true } = action.payload;
      return {
        ...state,
        domain: {
          ...state.domain,
          themes: [...state.domain.themes, theme],
          activeThemeId: select ? theme.meta.id : state.domain.activeThemeId,
        },
        status: { ...state.status, unsaved: true, saveError: "" },
      };
    }
    case "theme/remove": {
      const { themeId, nextSelectedThemeId } = action.payload;
      const nextDirtyThemes = { ...state.status.dirtyThemes };
      delete nextDirtyThemes[themeId];
      return {
        ...state,
        domain: {
          ...state.domain,
          themes: state.domain.themes.filter((theme) => theme.meta.id !== themeId),
          activeThemeId: nextSelectedThemeId || state.domain.activeThemeId,
        },
        status: { ...state.status, unsaved: true, saveError: "", dirtyThemes: nextDirtyThemes },
      };
    }
    case "theme/rename": {
      const { themeId, name } = action.payload;
      return {
        ...state,
        domain: {
          ...state.domain,
          themes: replaceTheme(state.domain.themes, themeId, (theme) => ({
            ...theme,
            meta: { ...theme.meta, name },
          })),
        },
        status: { ...state.status, unsaved: true, saveError: "", dirtyThemes: { ...state.status.dirtyThemes, [themeId]: true } },
      };
    }
    case "theme/update-icon": {
      const { themeId, icon } = action.payload;
      return {
        ...state,
        domain: {
          ...state.domain,
          themes: replaceTheme(state.domain.themes, themeId, (theme) => ({
            ...theme,
            meta: { ...theme.meta, icon },
          })),
        },
        status: { ...state.status, unsaved: true, saveError: "", dirtyThemes: { ...state.status.dirtyThemes, [themeId]: true } },
      };
    }
    case "action/select":
      if (state.editor.actionId === action.payload) return state;
      return {
        ...state,
        editor: { ...state.editor, actionId: action.payload },
      };
    case "cursor-state/select":
      if (state.editor.cursorStateId === action.payload) return state;
      return {
        ...state,
        editor: { ...state.editor, cursorStateId: action.payload },
      };
    case "global-enabled/set":
      if (state.domain.enabled === action.payload) return state;
      return {
        ...state,
        domain: { ...state.domain, enabled: action.payload },
        status: { ...state.status, unsaved: true, saveError: "" },
      };
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
            domain: { ...state.domain, appRules: [...state.domain.appRules, newRule as AppRule] },
            status: { ...state.status, unsaved: true, saveError: "" },
          }
        : {
            ...state,
            domain: { ...state.domain, siteRules: [...state.domain.siteRules, newRule as SiteRule] },
            status: { ...state.status, unsaved: true, saveError: "" },
          };
    }
    case "rules/update": {
      const collection = action.payload?.collection === "appRules" ? "appRules" : "siteRules";
      const { id, updates } = action.payload;
      if (collection === "appRules") {
        return {
          ...state,
          domain: {
            ...state.domain,
            appRules: state.domain.appRules.map((rule) =>
              rule.id === id ? { ...rule, ...(updates as Partial<AppRule>) } : rule
            ),
          },
          status: { ...state.status, unsaved: true, saveError: "" },
        };
      }
      return {
        ...state,
        domain: {
          ...state.domain,
          siteRules: state.domain.siteRules.map((rule) =>
            rule.id === id ? { ...rule, ...(updates as Partial<SiteRule>) } : rule
          ),
        },
        status: { ...state.status, unsaved: true, saveError: "" },
      };
    }
    case "rules/delete": {
      const collection = action.payload?.collection === "appRules" ? "appRules" : "siteRules";
      const ruleId = action.payload?.id;
      return {
        ...state,
        domain: {
          ...state.domain,
          [collection]: state.domain[collection].filter((rule) => rule.id !== ruleId),
        },
        status: { ...state.status, unsaved: true, saveError: "" },
      };
    }
    case "rules/reorder": {
      const collection = action.payload?.collection === "appRules" ? "appRules" : "siteRules";
      const { from, to } = action.payload;
      const nextRules = [...state.domain[collection]];
      const [moved] = nextRules.splice(from, 1);
      nextRules.splice(to, 0, moved);
      return {
        ...state,
        domain: { ...state.domain, [collection]: nextRules },
        status: { ...state.status, unsaved: true, saveError: "" },
      };
    }
    case "rules/toggle": {
      const collection = action.payload?.collection === "appRules" ? "appRules" : "siteRules";
      const ruleId = action.payload?.id;
      return {
        ...state,
        domain: {
          ...state.domain,
          [collection]: state.domain[collection].map((rule) =>
            rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
          ),
        },
        status: { ...state.status, unsaved: true, saveError: "" },
      };
    }
    case "rules/clear-all": {
      const collection = action.payload?.collection === "appRules" ? "appRules" : "siteRules";
      return {
        ...state,
        domain: { ...state.domain, [collection]: [] },
        status: { ...state.status, unsaved: true, saveError: "" },
      };
    }
    case "save/start":
      return { ...state, status: { ...state.status, isSaving: true, saveError: "" } };
    case "save/success":
      if (action.payload?.preserveUnsaved) {
        return {
          ...state,
          status: { ...state.status, isSaving: false, saveError: "" },
        };
      }
      return {
        ...state,
        status: { ...state.status, unsaved: false, isSaving: false, saveError: "", dirtyThemes: {} },
      };
    case "save/error":
      return { ...state, status: { ...state.status, isSaving: false, saveError: action.payload || "保存失败" } };
    case "recent-assets/set":
      return { ...state, runtime: { ...state.runtime, recentCursorAssets: action.payload } };
    case "theme/update-current": {
      const themeId = state.domain.activeThemeId;
      const currentTheme = findWorkbenchTheme(state.domain.themes, themeId);
      if (!currentTheme) return state;
      return {
        ...state,
        status: { ...state.status, unsaved: true, saveError: "", dirtyThemes: { ...state.status.dirtyThemes, [themeId]: true } },
        domain: {
          ...state.domain,
          themes: replaceTheme(state.domain.themes, themeId, (theme) => ({
            ...theme,
            draft: action.payload(theme.draft),
          })),
        },
      };
    }
    case "theme/reset-current": {
      const themeId = state.domain.activeThemeId;
      const resetDraft = createThemeDraft(themeId);
      const currentDraft = findWorkbenchTheme(state.domain.themes, themeId)?.draft;
      if (!currentDraft) return state;
      const resetActionConfigs = currentDraft?.resetActionConfigs || resetDraft.resetActionConfigs;
      const resetKeyFeedbackConfig = normalizeKeyFeedbackConfig(currentDraft?.resetKeyFeedbackConfig || resetDraft.resetKeyFeedbackConfig);
      return {
        ...state,
        status: { ...state.status, unsaved: true, saveError: "", dirtyThemes: { ...state.status.dirtyThemes, [themeId]: true } },
        domain: {
          ...state.domain,
          themes: replaceTheme(state.domain.themes, themeId, (theme) => ({
            ...theme,
            draft: {
              ...resetDraft,
              actionConfigs: resetActionConfigs,
              resetActionConfigs,
              keyFeedbackConfig: resetKeyFeedbackConfig,
              resetKeyFeedbackConfig,
            },
          })),
        },
      };
    }
    case "theme/discard-changes": {
      const { themeId, draft } = action.payload;
      const nextDirtyThemes = { ...state.status.dirtyThemes };
      delete nextDirtyThemes[themeId];
      const hasDirty = Object.keys(nextDirtyThemes).length > 0;
      return {
        ...state,
        status: { ...state.status, unsaved: hasDirty, dirtyThemes: nextDirtyThemes },
        domain: {
          ...state.domain,
          themes: replaceTheme(state.domain.themes, themeId, (theme) => ({ ...theme, draft })),
        },
      };
    }
    case "key-feedback/update": {
      const themeId = state.domain.activeThemeId;
      const currentDraft = findWorkbenchTheme(state.domain.themes, themeId)?.draft;
      if (!currentDraft) return state;
      return {
        ...state,
        status: { ...state.status, unsaved: true, saveError: "", dirtyThemes: { ...state.status.dirtyThemes, [themeId]: true } },
        domain: {
          ...state.domain,
          themes: replaceTheme(state.domain.themes, themeId, (theme) => ({
            ...theme,
            draft: {
              ...currentDraft,
              keyFeedbackConfig: normalizeKeyFeedbackConfig({
                ...(currentDraft.keyFeedbackConfig || {}),
                ...action.payload,
              }),
            },
          })),
        },
      };
    }
    default:
      return state;
  }
}
