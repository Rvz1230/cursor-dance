import { useEffect, useMemo, useState } from "react";
import type { AiProposal } from "../components/ai-scheme/useAiConversation";
import { mergeActionConfig } from "../lib/aiSchemeAssistant";

type ActionConfig = Record<string, unknown>;
type ActionConfigs = Record<string, ActionConfig>;

interface AiPreviewNotification {
  tone: "info";
  title: string;
  description: string;
}

interface UseWorkbenchAiPreviewOptions {
  themeId: string;
  actionConfigs?: ActionConfigs;
  updateActionConfigs(patchesByActionId: ActionConfigs): void;
  notify(notification: AiPreviewNotification): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getProposalActionPatches(proposal: AiProposal | null): ActionConfigs {
  return Object.fromEntries(
    (proposal?.targets || []).flatMap((target) => {
      if (!isRecord(target) || target.type !== "action" || typeof target.actionId !== "string") return [];
      if (!isRecord(target.patch) || !Object.keys(target.patch).length) return [];
      return [[target.actionId, target.patch]];
    }),
  );
}

export function buildAiPreviewActionConfigs(
  actionConfigs: ActionConfigs | undefined,
  proposal: AiProposal | null,
): ActionConfigs | undefined {
  if (!actionConfigs || !proposal) return actionConfigs;
  const patches = getProposalActionPatches(proposal);
  if (!Object.keys(patches).length) return actionConfigs;
  return Object.entries(patches).reduce(
    (configs, [actionId, patch]) => ({
      ...configs,
      [actionId]: mergeActionConfig(configs[actionId], patch),
    }),
    actionConfigs,
  );
}

export function createAiActionSnapshot(
  actionConfigs: ActionConfigs,
  patchesByActionId: ActionConfigs,
): ActionConfigs {
  return Object.fromEntries(
    Object.keys(patchesByActionId).map((actionId) => [actionId, { ...actionConfigs[actionId] }]),
  );
}

export function hasAiPreviewForAction(proposal: AiProposal | null, actionId: string): boolean {
  return Boolean(getProposalActionPatches(proposal)[actionId]);
}

export function useWorkbenchAiPreview({
  themeId,
  actionConfigs,
  updateActionConfigs,
  notify,
}: UseWorkbenchAiPreviewOptions) {
  const [previewProposal, setPreviewProposal] = useState<AiProposal | null>(null);
  const [aiSnapshot, setAiSnapshot] = useState<ActionConfigs | null>(null);
  const previewActionConfigsMap = useMemo(
    () => buildAiPreviewActionConfigs(actionConfigs, previewProposal),
    [actionConfigs, previewProposal],
  );

  useEffect(() => {
    // Preview and undo snapshots belong to one theme and must never cross the
    // theme boundary after the user changes the active theme.
    setPreviewProposal(null);
    setAiSnapshot(null);
  }, [themeId]);

  function applyProposal(proposal: AiProposal): void {
    if (!actionConfigs) return;
    const patchesByActionId = getProposalActionPatches(proposal);
    if (!Object.keys(patchesByActionId).length) return;
    setAiSnapshot(createAiActionSnapshot(actionConfigs, patchesByActionId));
    setPreviewProposal(null);
    updateActionConfigs(patchesByActionId);
  }

  function revertAiChanges(): void {
    if (!aiSnapshot) return;
    updateActionConfigs(aiSnapshot);
    setAiSnapshot(null);
    notify({
      tone: "info",
      title: "已撤销 AI 改动",
      description: "配置已恢复到应用 AI 方案之前的状态。",
    });
  }

  return {
    previewProposal,
    aiSnapshot,
    previewActionConfigsMap,
    setPreviewProposal,
    clearPreview: () => setPreviewProposal(null),
    clearAiSnapshot: () => setAiSnapshot(null),
    isPreviewingAction: (actionId: string) => hasAiPreviewForAction(previewProposal, actionId),
    applyProposal,
    revertAiChanges,
  };
}
