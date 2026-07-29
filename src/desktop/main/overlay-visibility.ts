import { normalizeAppRules } from "../../shared/app-rules";

/**
 * A globally disabled config can still opt specific applications back in.
 * Keep overlay windows alive in that case and let each renderer evaluate the
 * current application; otherwise hiding them is the cheapest idle state.
 */
export function shouldKeepOverlaysVisible(config: unknown): boolean {
  if (!config || typeof config !== "object") return true;
  const candidate = config as { enabled?: unknown; appRules?: unknown; siteRules?: unknown };
  if (candidate.enabled !== false) return true;
  const legacyAppRules = Array.isArray(candidate.siteRules)
    ? candidate.siteRules.filter((rule) => {
        const target = (rule as { pattern?: { target?: unknown } })?.pattern?.target;
        return target === "process" || target === "title";
      })
    : [];
  return normalizeAppRules(candidate.appRules ?? legacyAppRules).some(
    (rule) => rule.enabled !== false && rule.action !== "disable" && rule.action.enable === true,
  );
}
