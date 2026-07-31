import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Check, Copy, PenLine, ThumbsDown, ThumbsUp } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/components/ui/utils";
import type { ConversationMessage } from "../../lib/storage/ai-conversation";
import { saveFeedback } from "../../lib/storage/ai-feedback";

const AiMarkdownRenderer = lazy(() => import("./AiMarkdownRenderer").then((module) => ({
  default: module.AiMarkdownRenderer,
})));

interface Notification {
  tone: "success";
  title: string;
}

interface AiConversationMessageProps {
  message: ConversationMessage;
  actionId: string;
  onEdit?(content: string): void;
  notify?(notification: Notification): void;
}

function AiMarkdown({ children }: { children: string }) {
  return (
    <Suspense fallback={<span className="whitespace-pre-wrap">{children}</span>}>
      <AiMarkdownRenderer>{children}</AiMarkdownRenderer>
    </Suspense>
  );
}

export function AiConversationMessage({
  message,
  onEdit,
  actionId,
  notify,
}: AiConversationMessageProps) {
  const isAssistant = message.role === "assistant";
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [showCommentInput, setShowCommentInput] = useState(false);

  useEffect(() => () => {
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  function handleCopy() {
    if (!navigator.clipboard?.writeText) return;
    void navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      // Clipboard feedback is non-critical.
    });
  }

  async function handleFeedback(rating: "up" | "down") {
    if (feedback === rating) {
      setFeedback(null);
      if (rating === "down") {
        setShowCommentInput(false);
        setFeedbackComment("");
      }
      return;
    }

    setFeedback(rating);
    if (rating === "up") {
      await saveFeedback({
        actionId,
        messageContent: message.content,
        rating,
      });
      notify?.({ tone: "success", title: "感谢反馈！" });
      return;
    }
    setShowCommentInput(true);
  }

  async function handleSubmitComment() {
    await saveFeedback({
      actionId,
      messageContent: message.content,
      rating: "down",
      comment: feedbackComment || undefined,
    });
    setShowCommentInput(false);
    setFeedbackComment("");
    notify?.({ tone: "success", title: "感谢反馈，我们会持续改进" });
  }

  const kindLabel = isAssistant && message.kind
    ? { chat: "AI 对话", proposal: "AI 建议", applied: "已应用", discarded: "已放弃" }[message.kind] || null
    : null;
  const kindTone = isAssistant && message.kind
    ? {
        chat: "border-slate-200 bg-slate-100 text-slate-600",
        proposal: "border-sky-100 bg-sky-50 text-sky-700",
        applied: "border-emerald-100 bg-emerald-50 text-emerald-700",
        discarded: "border-slate-200 bg-slate-100 text-slate-500",
      }[message.kind] || null
    : null;

  return (
    <div className={cn("group flex flex-col gap-0.5", isAssistant ? "items-start" : "items-end")}>
      {kindLabel ? (
        <span className={cn("mb-0.5 rounded-full border px-2 py-0.5 text-2xs font-medium leading-none", kindTone)}>
          {kindLabel}
        </span>
      ) : null}
      <div
        className={cn(
          "max-w-[86%] rounded-2xl px-3 py-2 text-pretty text-xs leading-5",
          isAssistant
            ? "border border-slate-200 bg-slate-50 text-slate-700"
            : "bg-slate-900 text-white",
        )}
      >
        {isAssistant ? (
          <div className="prose-cd max-w-none">
            <AiMarkdown>{message.content}</AiMarkdown>
          </div>
        ) : message.content}
      </div>
      <div className="flex items-center gap-0 px-1 opacity-0 transition-opacity group-hover:opacity-100">
        <IconButton
          className="rounded-md p-1 text-slate-400 hover:text-slate-600"
          onClick={handleCopy}
          label="复制"
          tooltip="复制"
        >
          {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5 shrink-0" />}
        </IconButton>
        {!isAssistant ? (
          <IconButton
            className="rounded-md p-1 text-slate-400 hover:text-slate-600"
            onClick={() => onEdit?.(message.content)}
            label="编辑"
            tooltip="编辑"
          >
            <PenLine className="size-3.5 shrink-0" />
          </IconButton>
        ) : (
          <>
            <IconButton
              className={cn(
                "rounded-md p-1",
                feedback === "up"
                  ? "text-emerald-500 hover:bg-transparent hover:text-emerald-600"
                  : "text-slate-400 hover:text-slate-600",
              )}
              onClick={() => void handleFeedback("up")}
              label="有帮助"
              tooltip="有帮助"
            >
              <ThumbsUp className={cn("size-3.5", feedback === "up" && "fill-current")} />
            </IconButton>
            <IconButton
              className={cn(
                "rounded-md p-1",
                feedback === "down"
                  ? "text-rose-500 hover:bg-transparent hover:text-rose-600"
                  : "text-slate-400 hover:text-slate-600",
              )}
              onClick={() => void handleFeedback("down")}
              label="没有帮助"
              tooltip="没有帮助"
            >
              <ThumbsDown className={cn("size-3.5", feedback === "down" && "fill-current")} />
            </IconButton>
          </>
        )}
      </div>
      {showCommentInput ? (
        <div className="mt-1 flex w-full max-w-[86%] gap-1.5">
          <input
            type="text"
            value={feedbackComment}
            onChange={(event) => setFeedbackComment(event.target.value)}
            placeholder="哪里不对？(选填)"
            className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none placeholder:text-slate-400 focus:border-slate-300"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                void handleSubmitComment();
              }
            }}
          />
          <button
            type="button"
            className="shrink-0 rounded-xl bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700"
            onClick={() => void handleSubmitComment()}
          >
            发送
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AiStreamingMessage({ content, loadingLabel }: { content: string; loadingLabel: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[86%] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
        {content ? (
          <div className="prose-cd max-w-none">
            <AiMarkdown>{content}</AiMarkdown>
            <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-sky-400 align-middle" />
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <span className="flex gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:150ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:300ms]" />
            </span>
            <span className="text-slate-400">{loadingLabel}</span>
          </span>
        )}
      </div>
    </div>
  );
}
