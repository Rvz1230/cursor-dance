import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Check, Eye, RotateCcw, Send, Settings, Square, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { InlineStatus } from "@/components/ui/inline-status";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/components/ui/utils";
import { Panel } from "@/components/ui/panel";
import {
  AiConversationMessage,
  AiStreamingMessage,
} from "./ai-scheme/AiConversationMessage";
import { AiAgentTimeline, AiModeSwitcher } from "./ai-scheme/AiAgentActivity";
import { AiProposalPresentation } from "./ai-scheme/AiProposalPresentation";
import { useAiConversation } from "./ai-scheme/useAiConversation";
import { useAiProposalReview } from "./ai-scheme/useAiProposalReview";
import { useAiProposalRun } from "./ai-scheme/useAiProposalRun";

function buildPromptExamples(currentConfig) {
  const examples = [];
  const config = currentConfig || {};

  if (config.sound && config.volume > 40) {
    examples.push("关掉声音效果");
  }
  if (!config.sound) {
    examples.push("加一点音效反馈");
  }
  if (config.particleCount > 25) {
    examples.push("粒子少一点，低调一些");
  }
  if (!config.particle) {
    examples.push("加一些粒子特效");
  }
  if (config.rippleSize > 90) {
    examples.push("波纹小一点");
  }
  if (config.shake > 30) {
    examples.push("去掉光标震动");
  }
  if (config.textKind === "数字飘字") {
    examples.push("改成文本飘字");
  }
  if (config.textKind === "文本飘字") {
    examples.push("切换回数字 +1 模式");
  }

  // Always include fallback examples
  const fallbacks = [
    "适合写代码的简约蓝色点击效果",
    "赛博朋克风格，但不要太花",
  ];

  // Take up to 3 contextual examples, fill with fallbacks
  return [...examples.slice(0, 3), ...fallbacks].slice(0, 4);
}

export function AiSchemePanel({
  actionId,
  actionLabel,
  currentConfig,
  actionConfigs,
  applyActionConfig,
  applyProposal,
  previewProposal,
  onPreviewProposal,
  onClearPreview,
  notify,
  aiSnapshot,
  onRevertAiChanges,
  onClearAiSnapshot,
  onOpenAiSettings,
  variant = "dock",
}) {
  const [prompt, setPrompt] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const {
    messages,
    setMessages,
    pendingResult,
    setPendingResult,
    lastPrompt,
    setLastPrompt,
    agentSteps,
    setAgentSteps,
    agentTotalSteps,
    setAgentTotalSteps,
    useAgent,
    setUseAgent,
    clearConversation: clearStoredConversation,
  } = useAiConversation(actionId);
  const {
    isGenerating,
    streamingReply,
    error,
    cooldownActive,
    agentRunning,
    startPrompt,
    cancelGeneration,
    resetRun,
  } = useAiProposalRun({
    actionId,
    actionLabel,
    currentConfig,
    actionConfigs,
    useAgent,
    pendingResult,
    lastPrompt,
    setPendingResult,
    setLastPrompt,
    setMessages,
    setAgentSteps,
    setAgentTotalSteps,
    onClearPreview,
    onClearAiSnapshot,
    notify,
  });
  const {
    previewActive,
    applyPendingResult,
    discardPendingResult,
    previewPendingResult,
    revertAiChanges,
  } = useAiProposalReview({
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
  });

  // Reset request-only UI state when switching actions. Conversation state is
  // loaded and persisted independently by useAiConversation.
  useEffect(() => {
    setPrompt("");
    resetRun();
    setConfirmClear(false);
  }, [actionId, resetRun]);

  const promptExamples = useMemo(() => buildPromptExamples(currentConfig), [currentConfig]);

  const canSubmit = useMemo(() => prompt.trim().length > 0 && !isGenerating && !cooldownActive, [prompt, isGenerating, cooldownActive]);
  const canOpenProviderSettings = Boolean(onOpenAiSettings && error.includes("API Key"));
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-resize textarea (useLayoutEffect avoids initial paint flash)
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    // When empty, let CSS default handle the height — avoids wrong initial scrollHeight
    if (!prompt) {
      el.style.height = "";
      return;
    }
    // Reset to "auto" so scrollHeight reflects actual content, not a previously clamped height
    el.style.height = "auto";
    // Clamp to [min-h-[48px], max-h-[112px]]
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 48), 112)}px`;
  }, [prompt]);

  // Auto-focus textarea after generation completes
  const wasGenerating = useRef(false);
  useEffect(() => {
    if (wasGenerating.current && !isGenerating) {
      textareaRef.current?.focus();
    }
    wasGenerating.current = isGenerating;
  }, [isGenerating]);

  // Auto-scroll to bottom only when user is already near the bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Only auto-scroll if user is within 50px of the bottom
    const threshold = 50;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isGenerating, streamingReply, agentSteps]);

  function submitPrompt(nextPrompt = prompt, modeOverride = "modify_action") {
    if (startPrompt(nextPrompt, modeOverride)) setPrompt("");
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      void submitPrompt();
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    void submitPrompt();
  }

  function clearConversation() {
    setPrompt("");
    resetRun();
    clearStoredConversation();
    onClearPreview?.();
    notify?.({
      tone: "info",
      title: "已清空 AI 对话",
      description: "当前动作配置保持不变。",
    });
  }

  return (
    <Panel
      title="AI 方案助手"
      icon={Bot}
      iconTone="bg-sky-500 text-white"
      summary={`${actionLabel} · 内嵌对话`}
      className={cn("shadow-sm", variant === "full" ? "flex h-full min-h-0 flex-col" : "max-h-[380px] shrink-0")}
      contentClassName={cn("min-h-0 overflow-hidden !p-0", variant === "full" && "flex flex-1 flex-col")}
      action={(
        <div className="flex items-center gap-1.5">
          <AiModeSwitcher useAgent={useAgent} onToggle={setUseAgent} disabled={isGenerating} />
          {onOpenAiSettings ? (
            <Tooltip content="AI 服务设置" side="top">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-xl text-slate-400 hover:text-slate-700"
                onClick={onOpenAiSettings}
                aria-label="AI 服务设置"
              >
                <Settings className="size-4" aria-hidden="true" />
              </Button>
            </Tooltip>
          ) : null}
          {confirmClear ? (
            <div className="flex items-center gap-1 rounded-xl bg-rose-50 px-2 py-1">
              <span className="text-2xs font-medium text-rose-700">确认清空？</span>
              <IconButton
                className="size-6 rounded-lg bg-white text-rose-600 hover:bg-rose-100 hover:text-rose-600"
                onClick={() => {
                  clearConversation();
                  setConfirmClear(false);
                }}
                label="确认清空"
              >
                <Check className="size-3.5" />
              </IconButton>
              <IconButton
                className="size-6 rounded-lg text-slate-500"
                onClick={() => setConfirmClear(false)}
                label="取消清空"
              >
                <X className="size-3.5" />
              </IconButton>
            </div>
          ) : (
            <IconButton
              className="size-8 rounded-xl text-slate-400 hover:text-rose-600"
              onClick={() => setConfirmClear(true)}
              disabled={isGenerating}
              label="清空 AI 对话"
              tooltip="清空 AI 对话"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </IconButton>
          )}
        </div>
      )}
    >
      <div className={cn("flex min-h-0 flex-col bg-white", variant === "full" && "flex-1")}>
        <div ref={scrollRef} className={cn("min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 scroll-smooth", variant === "full" ? "h-full" : "max-h-[220px]")}>
          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <motion.div
                key={`msg-${index}`}
                layout="position"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <AiConversationMessage message={message} onEdit={setPrompt} actionId={actionId} notify={notify} />
              </motion.div>
            ))}
          </AnimatePresence>
          {isGenerating ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <AiStreamingMessage
                content={streamingReply}
                loadingLabel={useAgent && agentRunning ? "Agent 正在分析需求" : "AI 正在生成"}
              />
            </motion.div>
          ) : null}

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <AiAgentTimeline steps={agentSteps} isRunning={agentRunning} totalSteps={agentTotalSteps} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <AiProposalPresentation result={pendingResult} previewActive={previewActive} />
          </motion.div>

          {pendingResult?.tuningOptions?.length ? (
            <div className="flex flex-wrap gap-2">
              {pendingResult.tuningOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition-[transform,color,background-color,border-color,box-shadow] hover:bg-white active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                  onClick={() => {
                    void submitPrompt(option, "tune_proposal");
                  }}
                  disabled={isGenerating || cooldownActive}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : messages.length <= 1 ? (
            <div className="flex flex-wrap gap-2">
              {promptExamples.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition-[transform,color,background-color,border-color,box-shadow] hover:border-slate-300 hover:bg-white active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                  onClick={() => void submitPrompt(example)}
                  disabled={isGenerating || cooldownActive}
                >
                  {example}
                </button>
              ))}
            </div>
          ) : !pendingResult && !isGenerating ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              描述你想要的鼠标效果，AI 将生成可直接预览和应用的配置方案。
            </div>
          ) : null}
        </div>

        {pendingResult ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2">
            <Button variant={previewActive ? "default" : "outline"} className="rounded-xl px-3" onClick={previewPendingResult}>
              <Eye className="mr-2 size-4" aria-hidden="true" />
              预览
            </Button>
            <Button className="rounded-xl bg-slate-950 hover:bg-slate-800" onClick={applyPendingResult}>
              <Check className="mr-2 size-4" aria-hidden="true" />
              应用改动
            </Button>
            <Button variant="outline" className="rounded-xl px-3" onClick={() => submitPrompt(lastPrompt)} disabled={!lastPrompt || isGenerating || cooldownActive} aria-label="重新生成">
              <RotateCcw className="mr-1.5 size-4" aria-hidden="true" />
              重新生成
            </Button>
            <Button variant="outline" className="rounded-xl px-3 text-rose-600 hover:text-rose-700" onClick={discardPendingResult} aria-label="放弃改动">
              <X className="mr-1.5 size-4" aria-hidden="true" />
              放弃
            </Button>
          </div>
        ) : null}

        {!pendingResult && aiSnapshot ? (
          <div className="border-t border-slate-100 px-3 py-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 active:scale-[0.97]"
              onClick={revertAiChanges}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              撤销 AI 改动
            </button>
          </div>
        ) : null}

        <form className="border-t border-slate-100 p-3" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="ai-scheme-prompt">描述想要的鼠标效果</label>
          <div className={cn(
            "relative rounded-2xl border bg-slate-50 p-2 pr-12 shadow-inner shadow-slate-200/50 transition-[border-color,box-shadow]",
            isGenerating
              ? "border-sky-200 shadow-inner shadow-sky-100/50"
              : "border-slate-200 focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-slate-950/10"
          )}>
            <textarea
              ref={textareaRef}
              id="ai-scheme-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={cooldownActive ? "冷却中，请稍候…" : "例如：科技感一点、低调、不要声音、粒子少一点"}
              rows={1}
              className="max-h-[112px] min-h-[48px] w-full resize-none bg-transparent px-1 py-1.5 text-sm leading-5 text-slate-700 outline-none placeholder:text-slate-400"
            />
            {isGenerating ? (
              <IconButton
                className="absolute bottom-2 right-2 size-9 rounded-xl bg-rose-500 text-white hover:bg-rose-600 hover:text-white"
                onClick={cancelGeneration}
                label="停止生成"
                tooltip="停止生成"
              >
                <Square className="size-3.5" aria-hidden="true" />
              </IconButton>
            ) : (
              <Tooltip content={cooldownActive ? "冷却中 (3 秒)" : "发送 (↵)"} side="top">
                <Button className="absolute bottom-2 right-2 size-9 rounded-xl px-0 disabled:opacity-30 transition-opacity" type="submit" disabled={!canSubmit} aria-label="发送给 AI 方案助手">
                  <Send className="size-4" aria-hidden="true" />
                </Button>
              </Tooltip>
            )}
          </div>
          {error ? (
            <InlineStatus tone="error" role="alert">
              <span>{error}</span>
              {canOpenProviderSettings ? (
                <button
                  type="button"
                  className="ml-2 shrink-0 rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-100 active:scale-[0.97]"
                  onClick={onOpenAiSettings}
                >
                  打开 AI 设置
                </button>
              ) : null}
              {lastPrompt ? (
                <button
                  type="button"
                  className="ml-2 shrink-0 rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-100 active:scale-[0.97]"
                  onClick={() => {
                    void submitPrompt(lastPrompt);
                  }}
                >
                  重试
                </button>
              ) : null}
            </InlineStatus>
          ) : null}
        </form>
      </div>
    </Panel>
  );
}
