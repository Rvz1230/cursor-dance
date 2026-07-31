import type { AppRule } from "@/shared/app-rules";
import type {
  ContextRuleActionV4,
  ContextRuleV4,
  WebContextRuleV4,
} from "@/shared/config-schema-v4";
import type { SiteRule, WorkbenchRuleAction } from "../../hooks/workbenchStateTypes";

type DesktopContextRuleV4 = Extract<ContextRuleV4, { context: "desktop" }>;

function contextActionToWorkbench(action: ContextRuleActionV4): WorkbenchRuleAction {
  return action.type === "disable"
    ? "disable"
    : { enable: true, ...(action.themeId ? { theme: action.themeId } : {}) };
}

function webRuleToWorkbench(rule: WebContextRuleV4): SiteRule {
  const path = rule.match.path || "";
  return {
    id: rule.id,
    enabled: rule.enabled,
    pattern: path
      ? { type: "path", hostType: rule.match.type, value: `${rule.match.host}${path}` }
      : { type: rule.match.type, value: rule.match.host },
    action: contextActionToWorkbench(rule.action),
  };
}

function desktopRuleToWorkbench(rule: DesktopContextRuleV4): AppRule {
  return {
    id: rule.id,
    enabled: rule.enabled,
    pattern: {
      type: rule.match.type,
      target: rule.match.target,
      value: rule.match.value,
    },
    action: contextActionToWorkbench(rule.action),
  };
}

export function contextRulesToWorkbench(rules: readonly ContextRuleV4[]): {
  siteRules: SiteRule[];
  appRules: AppRule[];
} {
  return {
    siteRules: rules
      .filter((rule): rule is WebContextRuleV4 => rule.context === "web")
      .map(webRuleToWorkbench),
    appRules: rules
      .filter((rule): rule is DesktopContextRuleV4 => rule.context === "desktop")
      .map(desktopRuleToWorkbench),
  };
}

function workbenchActionToContext(action: WorkbenchRuleAction): ContextRuleActionV4 {
  return action === "disable"
    ? { type: "disable" }
    : { type: "enable", ...(action.theme ? { themeId: action.theme } : {}) };
}

function splitWebPattern(value: string): { host: string; path?: string } {
  const normalized = value.trim();
  const slashIndex = normalized.indexOf("/");
  return slashIndex < 0
    ? { host: normalized }
    : { host: normalized.slice(0, slashIndex), path: normalized.slice(slashIndex) };
}

/**
 * 工作台站点规则的 pattern → v4 match。
 *
 * 导出是为了让「规则匹配测试器」与生产解析走同一份语义，
 * 避免测试器和实际生效结果给出不同答案。
 */
export function workbenchWebPatternToMatch(pattern: SiteRule["pattern"]): WebContextRuleV4["match"] {
  const isPathRule = pattern.type === "path";
  return {
    type: pattern.type === "glob" || (isPathRule && pattern.hostType === "glob")
      ? "glob"
      : "exact",
    ...splitWebPattern(pattern.value),
  };
}

function workbenchWebRuleToContext(rule: SiteRule): WebContextRuleV4 {
  return {
    id: rule.id,
    context: "web",
    enabled: rule.enabled !== false,
    match: workbenchWebPatternToMatch(rule.pattern),
    action: workbenchActionToContext(rule.action),
  };
}

function workbenchDesktopRuleToContext(rule: AppRule): DesktopContextRuleV4 {
  return {
    id: rule.id,
    context: "desktop",
    enabled: rule.enabled !== false,
    match: {
      type: rule.pattern.type === "glob" ? "glob" : "exact",
      target: rule.pattern.target === "title" ? "title" : "process",
      value: rule.pattern.value || "",
    },
    action: workbenchActionToContext(rule.action),
  };
}

export function workbenchRulesToContext(
  siteRules: SiteRule[],
  appRules: AppRule[],
): ContextRuleV4[] {
  return [
    ...siteRules.map(workbenchWebRuleToContext),
    ...appRules.map(workbenchDesktopRuleToContext),
  ];
}
