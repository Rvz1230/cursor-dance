import type {
  ContextRule,
  ContextRuleAction,
  WebContextRule,
} from "./domain/cursor-dance";

type WebHostPattern = WebContextRule["match"];

function isWebHostPattern(value: unknown): value is WebHostPattern {
  if (!value || typeof value !== "object") return false;
  const pattern = value as Partial<WebHostPattern>;
  return (pattern.type === "exact" || pattern.type === "glob")
    && typeof pattern.host === "string"
    && (pattern.path === undefined || typeof pattern.path === "string");
}

export function matchHostPattern(host: unknown, pattern: unknown): boolean {
  if (!isWebHostPattern(pattern)) return false;
  const candidate = typeof host === "string" ? host.trim().toLowerCase() : "";
  const expected = pattern.host.trim().toLowerCase();
  if (!candidate || !expected) return false;
  if (pattern.type === "exact") return candidate === expected;

  const expression = `^${expected
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "<<<GLOB_STAR_STAR>>>")
    .replace(/\*/g, "[^.]*")
    .replace(/<<<GLOB_STAR_STAR>>>/g, ".*")
    .replace(/\?/g, ".")}$`;
  try {
    return new RegExp(expression).test(candidate);
  } catch {
    return false;
  }
}

function isEnabledWebRule(rule: unknown): rule is WebContextRule {
  if (!rule || typeof rule !== "object") return false;
  const candidate = rule as Partial<ContextRule>;
  const action = candidate.action as Partial<ContextRuleAction> | undefined;
  return candidate.context === "web"
    && candidate.enabled === true
    && isWebHostPattern(candidate.match)
    && (action?.type === "disable" || action?.type === "enable");
}

export function findWebContextRule(
  rules: unknown,
  host: unknown,
  path: unknown,
): WebContextRule | null {
  if (!Array.isArray(rules)) return null;
  const pathname = typeof path === "string" && path.startsWith("/") ? path : `/${path || ""}`;
  for (const rule of rules) {
    if (!isEnabledWebRule(rule)) continue;
    if (!matchHostPattern(host, rule.match)) continue;
    if (rule.match.path && !pathname.startsWith(rule.match.path)) continue;
    return rule;
  }
  return null;
}

export function resolveWebContextRule(
  rules: unknown,
  host: unknown,
  path: unknown,
): ContextRuleAction | null {
  return findWebContextRule(rules, host, path)?.action || null;
}
