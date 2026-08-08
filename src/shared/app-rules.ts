/** @platform shared — desktop application rule schema and pure matching helpers. */

import type { ContextRule, ContextRuleAction } from "./domain/cursor-dance";
import { isContextRuleActionEffective } from "./context-rule-actions";

export type AppRuleTarget = "bundle" | "process" | "title";
type AppRulePatternType = "exact" | "glob";
type AppRuleKind = "application" | "advanced";

export interface AppRulePattern {
  type: AppRulePatternType;
  value: string;
  target?: AppRuleTarget;
}

export type AppRuleAction = "disable" | { enable: boolean; theme?: string };

export interface AppRule {
  id: string;
  kind?: AppRuleKind;
  pattern: AppRulePattern;
  action: AppRuleAction;
  enabled?: boolean;
  /** Theme restored when an application rule is enabled again. */
  preferredTheme?: string;
}

export interface ActiveAppInfo {
  bundleId?: string;
  processName: string;
  title: string;
}

interface ActiveWindowOwner {
  name: string;
  bundleId?: string;
}

interface DesktopWindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ActiveWindowSnapshot =
  | {
      authorized: true;
      owner: ActiveWindowOwner;
      title: string;
      processName: string;
      bounds?: DesktopWindowBounds;
      /** Explicit element-level AX probe result. Undefined means not probed. */
      elementAccessAvailable?: boolean;
    }
  | {
      authorized: false;
      message: string;
    };

export function matchAppPattern(
  info: ActiveAppInfo,
  pattern: AppRulePattern | null | undefined,
): boolean {
  if (!pattern || typeof pattern !== "object" || !pattern.type || typeof pattern.value !== "string") {
    return false;
  }

  const target: AppRuleTarget = pattern.target === "bundle"
    ? "bundle"
    : pattern.target === "title"
      ? "title"
      : "process";
  const haystack = target === "bundle" ? info.bundleId : target === "title" ? info.title : info.processName;
  const normalizedValue = pattern.value.trim().toLowerCase();
  const normalizedHaystack = (haystack || "").trim().toLowerCase();
  if (!normalizedHaystack || !normalizedValue) return false;

  if (pattern.type === "exact") return normalizedHaystack === normalizedValue;
  if (pattern.type !== "glob") return false;

  const expression = "^" + normalizedValue
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*+/g, ".*")
    .replace(/\?/g, ".") + "$";
  try {
    return new RegExp(expression).test(normalizedHaystack);
  } catch {
    return false;
  }
}

export function isDirectApplicationRule(rule: Pick<AppRule, "kind" | "pattern">): boolean {
  return rule.kind === "application"
    || (rule.kind !== "advanced" && rule.pattern.type === "exact" && (
      (rule.pattern.target || "process") === "process" || rule.pattern.target === "bundle"
    ));
}

export function orderAppRulesByPriority<T extends Pick<AppRule, "kind" | "pattern">>(
  rules: readonly T[],
): T[] {
  return [
    ...rules.filter(isDirectApplicationRule),
    ...rules.filter((rule) => !isDirectApplicationRule(rule)),
  ];
}

export function isAppRuleActionEffective(action: AppRuleAction, globalEnabled: boolean): boolean {
  if (action === "disable") {
    return isContextRuleActionEffective({ type: "disable" }, globalEnabled);
  }
  if (action.enable !== true) return false;
  return isContextRuleActionEffective({
    type: "enable",
    ...(action.theme ? { themeId: action.theme } : {}),
  }, globalEnabled);
}

export function resolveAppRule(
  rules: AppRule[] | null | undefined,
  info: ActiveAppInfo,
  globalEnabled?: boolean,
): AppRuleAction | null {
  if (!Array.isArray(rules)) return null;

  const orderedRules = orderAppRulesByPriority(rules);
  for (const rule of orderedRules) {
    if (!rule || rule.enabled === false || !matchAppPattern(info, rule.pattern)) continue;
    if (globalEnabled !== undefined && !isAppRuleActionEffective(rule.action, globalEnabled)) continue;
    if (rule.action === "disable") return "disable";
    if (rule.action?.enable === true) {
      return {
        enable: true,
        theme: typeof rule.action.theme === "string" ? rule.action.theme : undefined,
      };
    }
  }
  return null;
}

export function activeAppInfoFromSnapshot(snapshot: ActiveWindowSnapshot | null | undefined): ActiveAppInfo | null {
  return snapshot?.authorized
    ? {
        bundleId: snapshot.owner.bundleId,
        processName: snapshot.processName,
        title: snapshot.title,
      }
    : null;
}

export function resolveDesktopContextAction(
  rules: readonly ContextRule[] | null | undefined,
  info: ActiveAppInfo | null | undefined,
  globalEnabled?: boolean,
): ContextRuleAction | null {
  if (!Array.isArray(rules) || !info) return null;
  const desktopRules = rules.filter((rule): rule is Extract<ContextRule, { context: "desktop" }> => (
    rule.context === "desktop"
  ));
  const orderedRules = [
    ...desktopRules.filter((rule) => isDirectApplicationRule({
      kind: rule.kind,
      pattern: rule.match,
    })),
    ...desktopRules.filter((rule) => !isDirectApplicationRule({
      kind: rule.kind,
      pattern: rule.match,
    })),
  ];
  for (const rule of orderedRules) {
    const actionIsEffective = globalEnabled === undefined
      || isContextRuleActionEffective(rule.action, globalEnabled);
    if (
      rule.enabled
      && actionIsEffective
      && matchAppPattern(info, rule.match)
    ) {
      return rule.action;
    }
  }
  return null;
}
