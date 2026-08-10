import { normalizeKeyFeedbackConfig } from "@/shared/config/key-feedback";
import { createThemeDraft } from "../../model/workbenchSchema";
import { findWorkbenchTheme } from "../workbenchThemeSelectors";
import type { WorkbenchAction, WorkbenchState } from "../workbenchStateTypes";
import {
  markThemeDirty,
  markUnsaved,
  clearThemeDirty,
  replaceTheme,
} from "./workbenchStateOperations";

export function reduceWorkbenchThemeState(
  state: WorkbenchState,
  action: WorkbenchAction,
): WorkbenchState {
  switch (action.type) {
    case "theme/select":
      if (state.domain.activeThemeId === action.payload) return state;
      return markUnsaved({
        ...state,
        domain: { ...state.domain, activeThemeId: action.payload },
      });
    case "theme/add": {
      const { theme, select = true } = action.payload;
      return markUnsaved({
        ...state,
        domain: {
          ...state.domain,
          themes: [...state.domain.themes, theme],
          activeThemeId: select ? theme.meta.id : state.domain.activeThemeId,
        },
      });
    }
    case "theme/remove": {
      const { themeId, nextSelectedThemeId } = action.payload;
      return clearThemeDirty({
        ...state,
        domain: {
          ...state.domain,
          themes: state.domain.themes.filter((theme) => theme.meta.id !== themeId),
          activeThemeId: nextSelectedThemeId || state.domain.activeThemeId,
        },
      }, themeId, { preserveUnsaved: true });
    }
    case "theme/rename": {
      const { themeId, name } = action.payload;
      return markThemeDirty({
        ...state,
        domain: {
          ...state.domain,
          themes: replaceTheme(state.domain.themes, themeId, (theme) => ({
            ...theme,
            meta: { ...theme.meta, name },
          })),
        },
      }, themeId);
    }
    case "theme/update-icon": {
      const { themeId, icon } = action.payload;
      return markThemeDirty({
        ...state,
        domain: {
          ...state.domain,
          themes: replaceTheme(state.domain.themes, themeId, (theme) => ({
            ...theme,
            meta: { ...theme.meta, icon },
          })),
        },
      }, themeId);
    }
    case "theme/update-current": {
      const themeId = state.domain.activeThemeId;
      if (!findWorkbenchTheme(state.domain.themes, themeId)) return state;
      return markThemeDirty({
        ...state,
        domain: {
          ...state.domain,
          themes: replaceTheme(state.domain.themes, themeId, (theme) => ({
            ...theme,
            draft: action.payload(theme.draft),
          })),
        },
      }, themeId);
    }
    case "theme/update-by-id": {
      const { themeId, updater } = action.payload;
      if (!findWorkbenchTheme(state.domain.themes, themeId)) return state;
      return markThemeDirty({
        ...state,
        domain: {
          ...state.domain,
          themes: replaceTheme(state.domain.themes, themeId, (theme) => ({
            ...theme,
            draft: updater(theme.draft),
          })),
        },
      }, themeId);
    }
    case "theme/reset-current": {
      const themeId = state.domain.activeThemeId;
      const currentDraft = findWorkbenchTheme(state.domain.themes, themeId)?.draft;
      if (!currentDraft) return state;
      const resetDraft = createThemeDraft(themeId);
      const resetActionConfigs = currentDraft.resetActionConfigs || resetDraft.resetActionConfigs;
      const resetKeyFeedbackConfig = normalizeKeyFeedbackConfig(
        currentDraft.resetKeyFeedbackConfig || resetDraft.resetKeyFeedbackConfig,
      );
      return markThemeDirty({
        ...state,
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
      }, themeId);
    }
    case "theme/discard-changes": {
      const { themeId, draft } = action.payload;
      return clearThemeDirty({
        ...state,
        domain: {
          ...state.domain,
          themes: replaceTheme(state.domain.themes, themeId, (theme) => ({ ...theme, draft })),
        },
      }, themeId, { preserveUnsaved: false });
    }
    default:
      return state;
  }
}
