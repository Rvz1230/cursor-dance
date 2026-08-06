import type { AppRule } from "@/shared/app-rules";
import type {
  NewAppRule,
  NewSiteRule,
  SiteRule,
  WorkbenchDispatch,
} from "./workbenchStateTypes";

export function createWorkbenchRuleCommands(dispatch: WorkbenchDispatch) {
  return {
    addSiteRule: (rule: NewSiteRule) =>
      dispatch({ type: "rules/add", payload: { collection: "siteRules", rule } }),
    updateSiteRule: (id: string, updates: Partial<SiteRule>) =>
      dispatch({ type: "rules/update", payload: { collection: "siteRules", id, updates } }),
    deleteSiteRule: (id: string) =>
      dispatch({ type: "rules/delete", payload: { collection: "siteRules", id } }),
    reorderSiteRules: (from: number, to: number) =>
      dispatch({ type: "rules/reorder", payload: { collection: "siteRules", from, to } }),
    toggleSiteRule: (id: string) =>
      dispatch({ type: "rules/toggle", payload: { collection: "siteRules", id } }),
    clearAllSiteRules: () =>
      dispatch({ type: "rules/clear-all", payload: { collection: "siteRules" } }),
    addAppRule: (rule: NewAppRule) =>
      dispatch({ type: "rules/add", payload: { collection: "appRules", rule } }),
    updateAppRule: (id: string, updates: Partial<AppRule>) =>
      dispatch({ type: "rules/update", payload: { collection: "appRules", id, updates } }),
    deleteAppRule: (id: string) =>
      dispatch({ type: "rules/delete", payload: { collection: "appRules", id } }),
    reorderAppRules: (from: number, to: number) =>
      dispatch({ type: "rules/reorder", payload: { collection: "appRules", from, to } }),
    toggleAppRule: (id: string) =>
      dispatch({ type: "rules/toggle", payload: { collection: "appRules", id } }),
    clearAllAppRules: () =>
      dispatch({ type: "rules/clear-all", payload: { collection: "appRules" } }),
  };
}
