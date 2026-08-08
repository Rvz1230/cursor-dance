import {
  cloneValue,
  defaultConfig,
  normalizeConfig,
} from "@/shared/config/default-config";
import { resolveWebContextRule } from "@/shared/web-context-rules";
import {
  workbenchRulesToContext,
  workbenchWebPatternToMatch,
} from "./theme-draft/contextRuleAdapter";

function matchPattern(host, path, pattern) {
  if (!pattern || typeof pattern !== "object") return false;
  return Boolean(resolveWebContextRule([{
    id: "workbench-match-test",
    context: "web",
    enabled: true,
    match: workbenchWebPatternToMatch(pattern),
    action: { type: "enable" },
  }], host, path));
}

function resolveSiteRule(rules, host, path = "/", globalEnabled?: boolean) {
  if (!Array.isArray(rules) || rules.length === 0) return null;
  const action = resolveWebContextRule(
    workbenchRulesToContext(rules, []),
    host,
    path,
    globalEnabled,
  );
  if (action?.type === "disable") return "disable";
  if (action?.type === "enable") {
    return { enable: true, ...(action.themeId ? { theme: action.themeId } : {}) };
  }
  return null;
}

const runtimeConfig = {
  normalizeConfig,
  matchPattern,
  resolveSiteRule,
  cloneValue,
};

export function getDefaultConfig() {
  return defaultConfig;
}

export function getRuntimeConfig() {
  return runtimeConfig;
}

export function normalizeStoredConfig(value: unknown) {
  return normalizeConfig(value, defaultConfig);
}
