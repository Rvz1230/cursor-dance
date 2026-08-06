/** @platform shared — desktop application rule schema and pure matching helpers. */

import type { ContextRule, ContextRuleAction } from "./domain/cursor-dance";

export type AppRuleTarget = "process" | "title";
export type AppRulePatternType = "exact" | "glob";

export interface AppRulePattern {
  type: AppRulePatternType;
  value: string;
  target?: AppRuleTarget;
}

export type AppRuleAction = "disable" | { enable: boolean; theme?: string };

export interface AppRule {
  id: string;
  pattern: AppRulePattern;
  action: AppRuleAction;
  enabled?: boolean;
}

export interface ActiveAppInfo {
  processName: string;
  title: string;
}

interface ActiveWindowOwner {
  name: string;
  bundleId?: string;
}

export type ActiveWindowSnapshot =
  | {
      authorized: true;
      owner: ActiveWindowOwner;
      title: string;
      processName: string;
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

  const target: AppRuleTarget = pattern.target === "title" ? "title" : "process";
  const haystack = target === "title" ? info.title : info.processName;
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

export function resolveAppRule(
  rules: AppRule[] | null | undefined,
  info: ActiveAppInfo,
): AppRuleAction | null {
  if (!Array.isArray(rules)) return null;

  for (const rule of rules) {
    if (!rule || rule.enabled === false || !matchAppPattern(info, rule.pattern)) continue;
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
    ? { processName: snapshot.processName, title: snapshot.title }
    : null;
}

export function resolveDesktopContextAction(
  rules: readonly ContextRule[] | null | undefined,
  info: ActiveAppInfo | null | undefined,
): ContextRuleAction | null {
  if (!Array.isArray(rules) || !info) return null;
  for (const rule of rules) {
    if (
      rule.context === "desktop"
      && rule.enabled
      && matchAppPattern(info, rule.match)
    ) {
      return rule.action;
    }
  }
  return null;
}
