import { normalizeKeyFeedbackConfig, type KeyFeedbackConfig } from "@/shared/config/key-feedback";
import type {
  WorkbenchActionConfig,
  WorkbenchThemeDraft,
} from "../workbenchStateTypes";

export function applyActionConfigPatch(
  draft: WorkbenchThemeDraft,
  actionId: string,
  patch: WorkbenchActionConfig,
): WorkbenchThemeDraft {
  return {
    ...draft,
    actionConfigs: {
      ...draft.actionConfigs,
      [actionId]: {
        ...draft.actionConfigs[actionId],
        ...patch,
      },
    },
  };
}

export function applyActionConfigPatches(
  draft: WorkbenchThemeDraft,
  patchesByActionId: Record<string, WorkbenchActionConfig>,
): WorkbenchThemeDraft {
  return {
    ...draft,
    actionConfigs: Object.entries(patchesByActionId).reduce(
      (actionConfigs, [actionId, patch]) => ({
        ...actionConfigs,
        [actionId]: {
          ...actionConfigs[actionId],
          ...patch,
        },
      }),
      draft.actionConfigs,
    ),
  };
}

export function applyAtmospherePatch(
  draft: WorkbenchThemeDraft,
  patch: Record<string, unknown>,
): WorkbenchThemeDraft {
  return {
    ...draft,
    atmosphere: { ...draft.atmosphere, ...patch },
  };
}

export function applyKeyFeedbackConfigPatch(
  draft: WorkbenchThemeDraft,
  patch: Partial<KeyFeedbackConfig>,
): WorkbenchThemeDraft {
  return {
    ...draft,
    keyFeedbackConfig: normalizeKeyFeedbackConfig({
      ...draft.keyFeedbackConfig,
      ...patch,
    }),
  };
}

export function getKeyFeedbackPatchMergeKey(
  patch: Partial<KeyFeedbackConfig>,
): string | undefined {
  const keys = Object.keys(patch).sort();
  return keys.length === 1 ? `key-feedback:${keys[0]}` : undefined;
}

export function getActionPatchMergeKey(
  actionId: string,
  patch: WorkbenchActionConfig,
): string {
  return `${actionId}:${Object.keys(patch).sort().join(",")}`;
}
