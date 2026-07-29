import { validateCursorDanceConfigV4 } from "../../shared/config-schema-v4";

/**
 * A globally disabled config can still opt specific applications back in.
 * Keep overlay windows alive in that case and let each renderer evaluate the
 * current application; otherwise hiding them is the cheapest idle state.
 */
export function shouldKeepOverlaysVisible(config: unknown): boolean {
  const validation = validateCursorDanceConfigV4(config);
  if (validation.ok === false) return true;
  if (validation.value.enabled) return true;
  return validation.value.contextRules.some(
    (rule) => rule.context === "desktop" && rule.enabled && rule.action.type === "enable",
  );
}
