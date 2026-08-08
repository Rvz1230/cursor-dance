/** @platform shared — canonical context-rule action semantics. */

import type { ContextRuleAction } from "./domain/cursor-dance";

/**
 * A matching rule only wins when it changes global enablement or overrides the
 * active theme. Follow-global actions deliberately fall through to later rules.
 */
export function isContextRuleActionEffective(
  action: ContextRuleAction,
  globalEnabled: boolean,
): boolean {
  if (action.type === "disable") return globalEnabled;
  return !globalEnabled || Boolean(action.themeId);
}
