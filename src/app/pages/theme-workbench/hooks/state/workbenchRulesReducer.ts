import type { AppRule } from "@/shared/app-rules";
import type {
  SiteRule,
  WorkbenchAction,
  WorkbenchState,
} from "../workbenchStateTypes";
import { markUnsaved } from "./workbenchStateOperations";

export function reduceWorkbenchRulesState(
  state: WorkbenchState,
  action: WorkbenchAction,
): WorkbenchState {
  switch (action.type) {
    case "rules/add": {
      const collection = action.payload.collection === "appRules" ? "appRules" : "siteRules";
      const rule = action.payload.rule;
      if (!rule || !rule.pattern || !rule.action) return state;
      const newRule = {
        ...rule,
        id: rule.id || ("r" + (Date.now().toString(36) + Math.random().toString(36).slice(2, 6))),
        pattern: { ...rule.pattern },
        action: rule.action,
        enabled: rule.enabled !== false,
      };
      return markUnsaved(collection === "appRules"
        ? {
            ...state,
            domain: { ...state.domain, appRules: [...state.domain.appRules, newRule as AppRule] },
          }
        : {
            ...state,
            domain: { ...state.domain, siteRules: [...state.domain.siteRules, newRule as SiteRule] },
          });
    }
    case "rules/update": {
      const collection = action.payload.collection === "appRules" ? "appRules" : "siteRules";
      const { id, updates } = action.payload;
      return markUnsaved(collection === "appRules"
        ? {
            ...state,
            domain: {
              ...state.domain,
              appRules: state.domain.appRules.map((rule) =>
                rule.id === id ? { ...rule, ...(updates as Partial<AppRule>) } : rule
              ),
            },
          }
        : {
            ...state,
            domain: {
              ...state.domain,
              siteRules: state.domain.siteRules.map((rule) =>
                rule.id === id ? { ...rule, ...(updates as Partial<SiteRule>) } : rule
              ),
            },
          });
    }
    case "rules/delete": {
      const collection = action.payload.collection === "appRules" ? "appRules" : "siteRules";
      return markUnsaved({
        ...state,
        domain: {
          ...state.domain,
          [collection]: state.domain[collection].filter((rule) => rule.id !== action.payload.id),
        },
      });
    }
    case "rules/reorder": {
      const collection = action.payload.collection === "appRules" ? "appRules" : "siteRules";
      const { from, to } = action.payload;
      const nextRules = [...state.domain[collection]];
      const [moved] = nextRules.splice(from, 1);
      nextRules.splice(to, 0, moved);
      return markUnsaved({
        ...state,
        domain: { ...state.domain, [collection]: nextRules },
      });
    }
    case "rules/toggle": {
      const collection = action.payload.collection === "appRules" ? "appRules" : "siteRules";
      return markUnsaved({
        ...state,
        domain: {
          ...state.domain,
          [collection]: state.domain[collection].map((rule) =>
            rule.id === action.payload.id ? { ...rule, enabled: !rule.enabled } : rule
          ),
        },
      });
    }
    case "rules/clear-all": {
      const collection = action.payload.collection === "appRules" ? "appRules" : "siteRules";
      return markUnsaved({
        ...state,
        domain: { ...state.domain, [collection]: [] },
      });
    }
    default:
      return state;
  }
}
