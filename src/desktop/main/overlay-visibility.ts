import { validateCursorDanceConfigV4 } from "../../shared/config-schema-v4";
import {
  activeAppInfoFromSnapshot,
  resolveDesktopContextAction,
  type ActiveWindowSnapshot,
} from "../../shared/app-rules";

/**
 * Resolve effective desktop visibility in the main process so disabled
 * contexts stop receiving input IPC and can be background-throttled.
 */
export function shouldKeepOverlaysVisible(
  config: unknown,
  activeWindow?: ActiveWindowSnapshot | null,
): boolean {
  const validation = validateCursorDanceConfigV4(config);
  if (validation.ok === false) return true;
  const action = resolveDesktopContextAction(
    validation.value.contextRules,
    activeAppInfoFromSnapshot(activeWindow),
    validation.value.enabled,
  );
  if (action?.type === "disable") return false;
  if (action?.type === "enable") return true;
  return validation.value.enabled;
}
