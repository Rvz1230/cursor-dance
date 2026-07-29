import {
  THEMES,
  createThemeDraft,
} from "../model/workbenchSchema";
import {
  createWorkbenchThemeState,
} from "../lib/extensionConfig";
import {
  normalizeKeyFeedbackConfig,
} from "@/desktop/renderer/engine/key-feedback-types";

export const INITIAL_THEME_STATE = createWorkbenchThemeState(THEMES);

export const initialState = {
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
          dirtyThemes: {},
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
        ui: { ...state.ui, unsaved: true, saveError: "" },
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
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    }
    case "theme/library-remove": {
      const { themeId, nextSelectedThemeId } = action.payload;
      const nextDraftsByTheme = { ...state.draftsByTheme };
      delete nextDraftsByTheme[themeId];
      const nextDirtyThemes = { ...state.ui.dirtyThemes };
      delete nextDirtyThemes[themeId];
      return {
        ...state,
        themeLibrary: state.themeLibrary.filter((theme) => theme.id !== themeId),
        draftsByTheme: nextDraftsByTheme,
        selection: {
          ...state.selection,
          themeId: nextSelectedThemeId || state.selection.themeId,
        },
        ui: { ...state.ui, unsaved: true, saveError: "", dirtyThemes: nextDirtyThemes },
      };
    }
    case "theme/library-rename": {
      const { themeId, name } = action.payload;
      return {
        ...state,
        themeLibrary: state.themeLibrary.map((theme) =>
          theme.id === themeId ? { ...theme, name } : theme
        ),
        ui: { ...state.ui, unsaved: true, saveError: "", dirtyThemes: { ...state.ui.dirtyThemes, [themeId]: true } },
      };
    }
    case "theme/library-update-icon": {
      const { themeId, icon } = action.payload;
      return {
        ...state,
        themeLibrary: state.themeLibrary.map((theme) =>
          theme.id === themeId ? { ...theme, icon } : theme
        ),
        ui: { ...state.ui, unsaved: true, saveError: "", dirtyThemes: { ...state.ui.dirtyThemes, [themeId]: true } },
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
      return {
        ...state,
        [collection]: [...state[collection], newRule],
        ui: { ...state.ui, unsaved: true, saveError: "" },
      };
    }
    case "rules/update": {
      const collection = action.payload?.collection === "appRules" ? "appRules" : "siteRules";
      const { id, updates } = action.payload;
      return {
        ...state,
        [collection]: state[collection].map((rule) =>
          rule.id === id ? { ...rule, ...updates } : rule
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
      return {
        ...state,
        ui: { ...state.ui, unsaved: true, saveError: "", dirtyThemes: { ...state.ui.dirtyThemes, [themeId]: true } },
        draftsByTheme: {
          ...state.draftsByTheme,
          [themeId]: action.payload(state.draftsByTheme[themeId]),
        },
      };
    }
    case "theme/reset-current": {
      const themeId = state.selection.themeId;
      const resetDraft = createThemeDraft(themeId);
      const currentDraft = state.draftsByTheme[themeId];
      const resetActionConfigs = currentDraft?.resetActionConfigs || resetDraft.resetActionConfigs;
      const resetKeyFeedbackConfig = normalizeKeyFeedbackConfig(currentDraft?.resetKeyFeedbackConfig || resetDraft.resetKeyFeedbackConfig);
      return {
        ...state,
        ui: { ...state.ui, unsaved: true, saveError: "", dirtyThemes: { ...state.ui.dirtyThemes, [themeId]: true } },
        draftsByTheme: {
          ...state.draftsByTheme,
          [themeId]: {
            ...resetDraft,
            actionConfigs: resetActionConfigs,
            resetActionConfigs,
            keyFeedbackConfig: resetKeyFeedbackConfig,
            resetKeyFeedbackConfig,
          },
        },
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
        draftsByTheme: {
          ...state.draftsByTheme,
          [themeId]: draft,
        },
      };
    }
    case "key-feedback/update": {
      const themeId = state.selection.themeId;
      const currentDraft = state.draftsByTheme[themeId] || createThemeDraft(themeId);
      return {
        ...state,
        ui: { ...state.ui, unsaved: true, saveError: "", dirtyThemes: { ...state.ui.dirtyThemes, [themeId]: true } },
        draftsByTheme: {
          ...state.draftsByTheme,
          [themeId]: {
            ...currentDraft,
            keyFeedbackConfig: normalizeKeyFeedbackConfig({
              ...(currentDraft.keyFeedbackConfig || {}),
              ...action.payload,
            }),
          },
        },
      };
    }
    default:
      return state;
  }
}
