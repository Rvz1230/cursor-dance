import type {
  ActiveAppInfo,
  ActiveWindowSnapshot,
  AppRule,
  AppRuleAction,
  AppRulePattern,
} from "@/shared/app-rules";
import {
  activeAppInfoFromSnapshot,
  isAppRuleActionEffective,
  isDirectApplicationRule,
  matchAppPattern,
  orderAppRulesByPriority,
} from "@/shared/app-rules";

export interface ApplicationCandidate {
  key: string;
  name: string;
  processName: string;
  title: string;
  bundleId?: string;
  iconDataUrl?: string;
}

export type RuleMatchState = "idle" | "active" | "shadowed";

export interface AppRuleDecision {
  enabled: boolean;
  action: AppRuleAction | null;
  ruleId: string | null;
}

export function applicationFromSnapshot(
  snapshot: ActiveWindowSnapshot | null | undefined,
): ApplicationCandidate | null {
  if (!snapshot?.authorized) return null;
  const processName = snapshot.processName.trim();
  if (!processName) return null;
  const bundleId = snapshot.owner.bundleId?.trim() || undefined;
  return {
    key: (bundleId || processName).toLocaleLowerCase(),
    name: snapshot.owner.name.trim() || processName,
    processName,
    title: snapshot.title.trim(),
    ...(bundleId ? { bundleId } : {}),
  };
}

export function rememberApplication(
  applications: readonly ApplicationCandidate[],
  snapshot: ActiveWindowSnapshot | null | undefined,
  limit = 8,
): ApplicationCandidate[] {
  const candidate = applicationFromSnapshot(snapshot);
  if (!candidate) return [...applications];
  return [candidate, ...applications.filter((item) => item.key !== candidate.key)].slice(0, limit);
}

export function isApplicationRule(rule: AppRule): boolean {
  return isDirectApplicationRule(rule);
}

export function applicationPattern(application: ApplicationCandidate): AppRulePattern {
  const bundleId = application.bundleId?.trim();
  return bundleId
    ? { target: "bundle", type: "exact", value: bundleId }
    : { target: "process", type: "exact", value: application.processName.trim() };
}

export function applicationRuleMatchesCandidate(
  rule: AppRule,
  application: ApplicationCandidate,
): boolean {
  if (!isApplicationRule(rule)) return false;
  const target = rule.pattern.target || "process";
  const candidateValue = target === "bundle" ? application.bundleId : application.processName;
  return Boolean(candidateValue)
    && rule.pattern.value.trim().toLocaleLowerCase() === candidateValue?.trim().toLocaleLowerCase();
}

export function applicationCandidateForRule(
  rule: AppRule,
  applications: readonly ApplicationCandidate[],
): ApplicationCandidate {
  return applications.find((application) => (
    applicationRuleMatchesCandidate(rule, application)
  )) || {
    key: `rule:${rule.id}`,
    name: rule.pattern.value,
    processName: rule.pattern.value,
    title: "",
  };
}

export function isVoidApplicationRule(rule: AppRule, globalEnabled: boolean): boolean {
  return rule.enabled !== false && (
    globalEnabled
      ? rule.action !== "disable" && !rule.action.theme
      : rule.action === "disable"
  );
}

export function resolveRuleMatchStates(
  rules: readonly AppRule[],
  info: ActiveAppInfo | null,
  globalEnabled?: boolean,
): Map<string, RuleMatchState> {
  const result = new Map<string, RuleMatchState>();
  if (!info) return result;
  const orderedRules = orderAppRulesByPriority(rules);
  const matching = orderedRules.filter((rule) => (
    rule.enabled !== false
    && (globalEnabled === undefined || isAppRuleActionEffective(rule.action, globalEnabled))
    && matchAppPattern(info, rule.pattern)
  ));
  matching.forEach((rule, index) => result.set(rule.id, index === 0 ? "active" : "shadowed"));
  return result;
}

export function resolveAppRuleDecision(
  rules: readonly AppRule[],
  snapshot: ActiveWindowSnapshot | null | undefined,
  globalEnabled: boolean,
): AppRuleDecision | null {
  const info = activeAppInfoFromSnapshot(snapshot);
  if (!info) return null;
  const orderedRules = orderAppRulesByPriority(rules);
  const rule = orderedRules.find((candidate) => (
    candidate.enabled !== false
    && isAppRuleActionEffective(candidate.action, globalEnabled)
    && matchAppPattern(info, candidate.pattern)
  ));
  if (!rule) return { enabled: globalEnabled, action: null, ruleId: null };
  return {
    enabled: rule.action !== "disable",
    action: rule.action,
    ruleId: rule.id,
  };
}
