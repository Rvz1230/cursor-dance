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

export function getActionPatchMergeKey(
  actionId: string,
  patch: WorkbenchActionConfig,
): string {
  return `${actionId}:${Object.keys(patch).sort().join(",")}`;
}
