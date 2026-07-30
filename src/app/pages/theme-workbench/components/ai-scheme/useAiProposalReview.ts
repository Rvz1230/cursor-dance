import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { ConversationMessage } from "../../lib/storage/ai-conversation";
import type { AiProposal } from "./useAiConversation";

interface ReviewNotification {
  tone: "info" | "success";
  title: string;
  description: string;
}

interface UseAiProposalReviewOptions {
  pendingResult: AiProposal | null;
  previewProposal?: AiProposal | null;
  aiSnapshot?: unknown;
  applyActionConfig?: (patch?: Record<string, unknown>) => void;
  applyProposal?: (proposal: AiProposal) => void;
  onPreviewProposal?: (proposal: AiProposal) => void;
  onClearPreview?: () => void;
  onRevertAiChanges?: () => void;
  notify?: (notification: ReviewNotification) => void;
  setPendingResult: Dispatch<SetStateAction<AiProposal | null>>;
  setMessages: Dispatch<SetStateAction<ConversationMessage[]>>;
}

export function describeAiProposalApplication(proposal: AiProposal): string {
  if (proposal.targets && proposal.targets.length > 1) {
    return `已更新 ${proposal.targets.length} 个动作。`;
  }
  return proposal.diffSummary?.[0] || "配置已更新，可在预览区查看效果。";
}

export function useAiProposalReview({
  pendingResult,
  previewProposal,
  aiSnapshot,
  applyActionConfig,
  applyProposal,
  onPreviewProposal,
  onClearPreview,
  onRevertAiChanges,
  notify,
  setPendingResult,
  setMessages,
}: UseAiProposalReviewOptions) {
  const previewActive = useMemo(
    () => Boolean(pendingResult && previewProposal === pendingResult),
    [pendingResult, previewProposal],
  );

  function applyPendingResult() {
    if (!pendingResult) return;

    if (aiSnapshot) {
      notify?.({
        tone: "info",
        title: "将覆盖之前的 AI 改动",
        description: "撤销点将更新到最新状态，之前的改动将无法单独回退。",
      });
    }

    if (applyProposal) {
      applyProposal(pendingResult);
    } else {
      applyActionConfig?.(pendingResult.patch);
    }
    onClearPreview?.();
    setMessages((current) => [
      ...current,
      { role: "assistant", content: "已应用这次改动到当前动作配置。", kind: "applied" },
    ]);
    notify?.({
      tone: "success",
      title: "已应用 AI 方案",
      description: describeAiProposalApplication(pendingResult),
    });
    setPendingResult(null);
  }

  function discardPendingResult() {
    if (!pendingResult) return;
    setPendingResult(null);
    onClearPreview?.();
    setMessages((current) => [
      ...current,
      { role: "assistant", content: "已放弃这次改动，当前配置保持不变。", kind: "discarded" },
    ]);
  }

  function previewPendingResult() {
    if (!pendingResult) return;
    onPreviewProposal?.(pendingResult);
    notify?.({
      tone: "info",
      title: "正在预览 AI 建议",
      description: "实时预览已切换到 AI 建议配置，应用前不会写入当前配置。",
    });
  }

  function revertAiChanges() {
    onRevertAiChanges?.();
    setMessages((current) => [
      ...current,
      { role: "assistant", content: "已撤销 AI 改动，配置已恢复。", kind: "chat" },
    ]);
  }

  return {
    previewActive,
    applyPendingResult,
    discardPendingResult,
    previewPendingResult,
    revertAiChanges,
  };
}
