import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Check, CheckCircle2, ChevronDown, ChevronRight, Copy, Eye, Loader2, PenLine, RotateCcw, Send, Square, ThumbsDown, ThumbsUp, Trash2, Wrench, X, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Markdown = ReactMarkdown as any;
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { getAiRequestErrorMessage, requestAiSchemeEditStreaming, requestAiAgentRun } from "../lib/aiSchemeAssistant";
import { saveConversation, loadConversation, deleteConversation, sweepExpiredConversations } from "../lib/storage/ai-conversation";
import { saveFeedback } from "../lib/storage/ai-feedback";
import { Panel } from "./WorkbenchControls";

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

function MessageBubble({ message, onEdit, actionId, notify }) {
  const isAssistant = message.role === "assistant";
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef(null);
  const [feedback, setFeedback] = useState(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [showCommentInput, setShowCommentInput] = useState(false);

  useEffect(() => {
    return () => clearTimeout(copyTimerRef.current);
  }, []);

  function handleCopy() {
    if (!navigator?.clipboard?.writeText) return;
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      // Clipboard write failed — silently ignore
    });
  }

  async function handleFeedback(rating) {
    if (feedback === rating) {
      // Cancel current vote
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
        rating: "up",
      });
      notify?.({ tone: "success", title: "感谢反馈！" });
    } else {
      // For thumbs-down, wait for optional comment before saving
      setShowCommentInput(true);
    }
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
    ? { chat: "border-slate-200 bg-slate-100 text-slate-600", proposal: "border-sky-100 bg-sky-50 text-sky-700", applied: "border-emerald-100 bg-emerald-50 text-emerald-700", discarded: "border-slate-200 bg-slate-100 text-slate-500" }[message.kind] || null
    : null;

  return (
    <div className={cn("flex flex-col gap-0.5 group", isAssistant ? "items-start" : "items-end")}>
      {kindLabel ? (
        <span className={cn("mb-0.5 rounded-full border px-2 py-0.5 text-2xs font-medium leading-none", kindTone)}>
          {kindLabel}
        </span>
      ) : null}
      <div
        className={cn(
          "max-w-[86%] rounded-2xl px-3 py-2 text-xs leading-5 text-pretty",
          isAssistant
            ? "border border-slate-200 bg-slate-50 text-slate-700"
            : "bg-slate-900 text-white"
        )}
      >
        {isAssistant ? (
          <div className="prose-cd max-w-none">
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                code: ({ className, children, ...props }) => {
                  const isBlock = /language-/.test(className || "");
                  if (isBlock) {
                    return (
                      <pre className="mt-1 mb-1 overflow-x-auto rounded-lg bg-slate-100 p-2 text-2xs leading-5">
                        <code className={className} {...props}>{children}</code>
                      </pre>
                    );
                  }
                  return (
                    <code className="rounded bg-slate-200/70 px-1 py-0.5 text-2xs font-mono" {...props}>
                      {children}
                    </code>
                  );
                },
                ul: ({ children }) => <ul className="mb-1 list-disc pl-4">{children}</ul>,
                ol: ({ children }) => <ol className="mb-1 list-decimal pl-4">{children}</ol>,
                li: ({ children }) => <li className="text-xs leading-5">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                a: ({ href, children }) => (
                  <a href={href} className="underline underline-offset-2 hover:text-slate-900" target="_blank" rel="noreferrer">
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </Markdown>
          </div>
        ) : (
          <>{message.content}</>
        )}
      </div>
      <div className={cn(
        "flex items-center gap-0 px-1",
        "opacity-0 group-hover:opacity-100 transition-opacity"
      )}>
        <button
          type="button"
          className="inline-flex items-center rounded-md p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          onClick={handleCopy}
          aria-label="复制"
          title="复制"
        >
          {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5 shrink-0" />}
        </button>
        {!isAssistant ? (
          <button
            type="button"
            className="inline-flex items-center rounded-md p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            onClick={() => onEdit?.(message.content)}
            aria-label="编辑"
            title="编辑"
          >
            <PenLine className="size-3.5 shrink-0" />
          </button>
        ) : (
          <>
            <button
              type="button"
              className={cn(
                "inline-flex items-center rounded-md p-1 transition-colors",
                feedback === "up"
                  ? "text-emerald-500 hover:text-emerald-600"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-100",
              )}
              onClick={() => handleFeedback("up")}
              aria-label="有帮助"
              title="有帮助"
            >
              <ThumbsUp className={cn("size-3.5", feedback === "up" && "fill-current")} />
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center rounded-md p-1 transition-colors",
                feedback === "down"
                  ? "text-rose-500 hover:text-rose-600"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-100",
              )}
              onClick={() => handleFeedback("down")}
              aria-label="没有帮助"
              title="没有帮助"
            >
              <ThumbsDown className={cn("size-3.5", feedback === "down" && "fill-current")} />
            </button>
          </>
        )}
      </div>
      {showCommentInput ? (
        <div className="mt-1 flex w-full max-w-[86%] gap-1.5">
          <input
            type="text"
            value={feedbackComment}
            onChange={(e) => setFeedbackComment(e.target.value)}
            placeholder="哪里不对？(选填)"
            className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none placeholder:text-slate-400 focus:border-slate-300"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) handleSubmitComment();
            }}
          />
          <button
            type="button"
            className="shrink-0 rounded-xl bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700"
            onClick={handleSubmitComment}
          >
            发送
          </button>
        </div>
      ) : null}
    </div>
  );
}

function getInitialMessages() {
  return [
    {
      role: "assistant",
      content: "描述你想要的鼠标反馈，我会直接生成或修改当前动作配置。",
      kind: "chat",
    },
  ];
}

function ChangeSummary({ items }) {
  if (!items?.length) {
    return null;
  }

  return (
    <div className="max-h-[76px] space-y-1.5 overflow-y-auto pr-1">
      {items.map((item) => (
        <div key={item} className="flex min-w-0 items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 text-pretty">{item}</span>
        </div>
      ))}
    </div>
  );
}

function SourceBadge({ source }) {
  const label = source?.startsWith("model") ? "模型建议" : source?.includes("api") ? "AI API" : "AI 响应";
  const tone = source?.startsWith("model")
    ? "border-sky-100 bg-sky-50 text-sky-700"
    : source?.includes("api")
      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-slate-50 text-slate-600";
  return <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", tone)}>{label}</span>;
}

function SanitizeHint({ meta }) {
  if (!meta?.droppedFieldCount) return null;
  const droppedList = meta.droppedFields?.length
    ? meta.droppedFields.map((fieldName) => <code key={fieldName} className="rounded bg-amber-100 px-1 py-0.5 text-xs font-mono">{fieldName}</code>)
    : null;
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      已过滤 {meta.droppedFieldCount} 个不受支持字段（{droppedList || "—"}），保留 {meta.acceptedFieldCount} 个可执行字段。
    </div>
  );
}

function SchemeOverview({ scheme }) {
  if (!scheme) return null;
  return (
    <div className="mb-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{scheme.name}</div>
          <div className="mt-1 text-xs leading-5 text-slate-600 text-pretty">{scheme.summary}</div>
        </div>
      </div>
      {scheme.styleTags?.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {scheme.styleTags.map((tag) => (
            <span key={tag} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">{tag}</span>
          ))}
        </div>
      ) : null}
      {scheme.rationale ? <div className="mt-2 text-xs leading-5 text-slate-500 text-pretty">{scheme.rationale}</div> : null}
    </div>
  );
}

function TargetSummary({ targets }) {
  if (!targets?.length) return null;
  return (
    <div className="mb-2 grid gap-1.5">
      {targets.slice(0, 6).map((target) => (
        <div key={`${target.type}-${target.actionId}`} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-2.5 py-2 text-xs">
          <span className="min-w-0 truncate font-medium text-slate-700">{target.label}</span>
          <span className="shrink-0 text-slate-500">{Object.keys(target.patch || {}).length} 项改动</span>
        </div>
      ))}
    </div>
  );
}

function ProposalCard({ result, previewActive }) {
  const diffItems = result?.diffItems || [];
  if (!result) return null;
  const riskLabel = result.riskLevel === "high" ? "高风险" : result.riskLevel === "medium" ? "中风险" : "低风险";
  const riskTone = result.riskLevel === "high"
    ? "border-rose-100 bg-rose-50 text-rose-700"
    : result.riskLevel === "medium"
      ? "border-amber-100 bg-amber-50 text-amber-700"
      : "border-emerald-100 bg-emerald-50 text-emerald-700";

  const replyLineCount = (result.reply || "").split("\n").length;
  const [openSections, setOpenSections] = useState({
    reply: replyLineCount < 3,
    diff: true,
    meta: false,
  });

  function toggleSection(section) {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  function SectionToggle({ label, section, className = "" }) {
    return (
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-colors hover:bg-slate-50",
          className,
        )}
        onClick={() => toggleSection(section)}
      >
        {openSections[section] ? <ChevronDown className="size-3.5 shrink-0 text-slate-400" /> : <ChevronRight className="size-3.5 shrink-0 text-slate-400" />}
        <span className="font-medium text-slate-700">{label}</span>
      </button>
    );
  }

  return (
    <div className="min-h-0 rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">AI 方案提案</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {result.targets?.length > 1 ? `${result.targets.length} 个动作` : result.target?.label || "当前动作"} · {previewActive ? "实时预览正在使用这版建议" : "确认前不会写入当前配置"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {previewActive ? <span className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">预览中</span> : null}
          <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", riskTone)}>{riskLabel}</span>
          <SourceBadge source={result.source} />
        </div>
      </div>

      <SchemeOverview scheme={result.scheme} />

      {/* AI 回复 — collapsible */}
      {result.reply ? (
        <div className="mb-2">
          <SectionToggle label="AI 回复" section="reply" />
          {openSections.reply ? (
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 text-pretty">
              {result.reply}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Warnings — always visible */}
      {result.warnings?.length ? (
        <div className="mb-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          {result.warnings.slice(0, 2).join("；")}
        </div>
      ) : null}

      {/* 改动详情 — collapsible */}
      <div className="mb-2">
        <SectionToggle label={`改动详情${result.targets?.length ? `（${result.targets.length} 个动作）` : ""}`} section="diff" />
        {openSections.diff ? (
          <div className="space-y-2">
            <TargetSummary targets={result.targets} />

            {diffItems.length ? (
              <div className="max-h-[200px] space-y-1.5 overflow-y-auto pr-1">
                {diffItems.slice(0, 12).map((item) => (
                  <div key={item.fieldName} className="grid grid-cols-[82px_minmax(0,1fr)] gap-2 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2 text-xs">
                    <div className="truncate font-medium text-slate-700">{item.label}</div>
                    <div className="min-w-0 text-slate-500">
                      <span className="truncate align-middle">{item.beforeLabel}</span>
                      <span className="mx-1 text-slate-400">-&gt;</span>
                      <span className="truncate font-semibold text-slate-900 align-middle">{item.afterLabel}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                这次没有生成可应用的配置差异。
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* 更多信息 — collapsible */}
      {result.totalTokens != null ? (
        <div>
          <SectionToggle label="更多信息" section="meta" />
          {openSections.meta ? (
            <div className="flex flex-wrap items-center gap-1.5 px-3 py-1 text-2xs text-slate-400">
              <span>消耗 ~{result.totalTokens.toLocaleString()} tokens</span>
              {result.totalCacheHitTokens > 0 ? (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-emerald-600 font-medium">{result.totalCacheHitTokens.toLocaleString()} 缓存命中</span>
                </>
              ) : null}
              <span className="text-slate-300">·</span>
              <span>约 ¥{((result.totalTokens / 1000000) * 1.5).toFixed(4)}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ToolCallBadge({ toolCall, toolResult }) {
  const [expanded, setExpanded] = useState(false);
  const name = toolCall?.name || "未知工具";
  const args = toolCall?.arguments || {};
  const isFinalize = name === "finalize_proposal";

  const labels = {
    apply_config_patch: "修改配置",
    get_current_config: "读取配置",
    finalize_proposal: "生成方案",
    rollback: "回滚",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white text-xs">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="size-3.5 shrink-0 text-slate-400" /> : <ChevronRight className="size-3.5 shrink-0 text-slate-400" />}
        <Wrench className="size-3.5 shrink-0 text-slate-500" />
        <span className="font-medium text-slate-700">{labels[name] || name}</span>
        {toolResult?.ok === false ? (
          <span className="ml-auto rounded-full bg-rose-100 px-1.5 py-0.5 text-rose-700 text-2xs font-medium">失败</span>
        ) : toolResult?.ok ? (
          <span className="ml-auto rounded-full bg-emerald-100 px-1.5 py-0.5 text-emerald-700 text-2xs font-medium">完成</span>
        ) : null}
      </button>
      {expanded ? (
        <div className="border-t border-slate-100 px-3 py-2 space-y-1.5">
          {!isFinalize && Object.keys(args).length > 0 ? (
            <div className="text-slate-500">
              <span className="text-slate-400">参数 </span>
              {Object.entries(args).map(([key, val]) => (
                <span key={key} className="inline-flex gap-1 ml-1">
                  <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-600">{key}</code>
                  <span className="text-slate-400">=</span>
                  <span className="text-slate-700">{typeof val === "object" ? JSON.stringify(val).slice(0, 120) : String(val).slice(0, 80)}</span>
                </span>
              ))}
            </div>
          ) : null}
          {toolResult?.summary ? (
            <div className={cn("leading-5", toolResult.ok === false ? "text-rose-700" : "text-slate-600")}>{toolResult.summary}</div>
          ) : null}
          {toolResult?.effect ? (
            <div className="text-slate-500 leading-5">{toolResult.effect}</div>
          ) : null}
          {toolResult?.error ? (
            <div className="text-rose-600 leading-5">{toolResult.error}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AgentTimeline({ steps, isRunning, totalSteps }) {
  if (!steps?.length && !isRunning) return null;

  const stepLabel = totalSteps > 0 ? `${steps.length} / ${totalSteps}` : `${steps.length} 步`;

  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Bot className="size-4 text-sky-600" />
        <span className="text-sm font-semibold text-sky-800">Agent 步骤</span>
        {isRunning ? (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-100 px-2 py-0.5 text-2xs font-medium text-sky-700">
            <Loader2 className="size-3 animate-spin" />
            运行中
          </span>
        ) : (
          <span className="ml-auto rounded-full border border-sky-200 bg-sky-100 px-2 py-0.5 text-2xs font-medium text-sky-700">{stepLabel}</span>
        )}
      </div>
      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.index} className="rounded-xl border border-sky-100 bg-white p-2.5">
            <div className="flex items-start gap-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-2xs font-bold text-sky-700">{step.index}</span>
              <div className="min-w-0 flex-1">
                {step.thought ? (
                  <div className="text-xs leading-5 text-slate-600 line-clamp-2">{step.thought}</div>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                    思考中
                    <span className="flex gap-0.5">
                      <span className="size-1 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                      <span className="size-1 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                      <span className="size-1 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                    </span>
                  </span>
                )}
              </div>
              {step.durationMs ? (
                <span className="shrink-0 text-2xs text-slate-400">{step.durationMs}ms</span>
              ) : null}
              {step.tokenUsage?.total_tokens ? (
                <span className="shrink-0 text-2xs text-slate-400">{step.tokenUsage.total_tokens} tk</span>
              ) : null}
            </div>
            {step.toolCalls?.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                {step.toolCalls.map((tc, i) => (
                  <ToolCallBadge key={`${tc.name}-${i}`} toolCall={tc} toolResult={step.toolResults?.[i]?.result} />
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {isRunning && (!steps?.length || steps[steps.length - 1]?.toolCalls?.length > 0) ? (
          <div className="flex items-center gap-2 rounded-xl border border-sky-100 bg-white p-2.5">
            <span className="flex gap-1">
              <span className="size-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:0ms]" />
              <span className="size-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:150ms]" />
              <span className="size-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:300ms]" />
            </span>
            <span className="text-xs text-slate-400">等待模型响应</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ModeSwitcher({ useAgent, onToggle, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-2xs font-medium text-slate-500 transition-colors hover:bg-slate-100"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {useAgent ? <Wrench className="size-3" /> : <Zap className="size-3" />}
        {useAgent ? "Agent" : "快速"}
        <ChevronDown className={cn("size-3 opacity-50 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
          <button
            type="button"
            role="option"
            aria-selected={!useAgent}
            className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50"
            onClick={() => { onToggle(false); setOpen(false); }}
          >
            <div className="flex items-center gap-2">
              <Zap className="size-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-800">快速模式</span>
              {!useAgent ? <Check className="ml-auto size-3.5 text-slate-600" /> : null}
            </div>
            <div className="mt-0.5 text-2xs leading-4 text-slate-500 text-pretty">
              一步生成，适合简单需求（调整参数、开关效果）
            </div>
          </button>
          <button
            type="button"
            role="option"
            aria-selected={useAgent}
            className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50 mt-0.5"
            onClick={() => { onToggle(true); setOpen(false); }}
          >
            <div className="flex items-center gap-2">
              <Wrench className="size-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-800">Agent 模式</span>
              {useAgent ? <Check className="ml-auto size-3.5 text-slate-600" /> : null}
            </div>
            <div className="mt-0.5 text-2xs leading-4 text-slate-500 text-pretty">
              分步推理 · 工具调用，适合复杂修改，支持多动作
            </div>
            <div className="mt-1 text-2xs leading-4 text-slate-400">
              可读取/修改多个动作配置，支持撤销
            </div>
          </button>
        </div>
      ) : null}
    </div>
  );
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
  variant = "dock",
}) {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState(getInitialMessages);
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingReply, setStreamingReply] = useState("");
  const [error, setError] = useState("");
  const [pendingResult, setPendingResult] = useState(null);
  const [lastPrompt, setLastPrompt] = useState("");
  const [useAgent, setUseAgent] = useState(false);
  const [agentSteps, setAgentSteps] = useState([]);
  const [agentTotalSteps, setAgentTotalSteps] = useState(0);
  const [agentRunning, setAgentRunning] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const abortRef = useRef(null);
  // Use ref for atomic submit lock — React state batching could allow
  // double-submit when tuningOptions chips are clicked in rapid succession.
  const generatingRef = useRef(false);
  const COOLDOWN_MS = 3000;
  const [cooldownActive, setCooldownActive] = useState(false);
  const cooldownTimerRef = useRef(null);

  // Persist conversation state when switching between actions
  const actionIdRef = useRef(actionId);
  const stateRef = useRef({
    messages,
    pendingResult,
    lastPrompt,
    agentSteps,
    agentTotalSteps,
    useAgent,
  });
  stateRef.current = { messages, pendingResult, lastPrompt, agentSteps, agentTotalSteps, useAgent };

  // Hydrate conversation from storage on mount + save/restore on action switch
  useEffect(() => {
    const prevId = actionIdRef.current;
    const isSwitch = prevId && prevId !== actionId;

    async function syncConversation() {
      if (isSwitch) {
        // Save previous action's conversation
        await saveConversation(prevId, stateRef.current as any);
      }
      // Load new action's conversation (or start fresh)
      const saved = await loadConversation(actionId);
      if (saved) {
        setMessages((saved.messages ?? getInitialMessages()).map((m) => ({ ...m, kind: m.kind || "chat" })));
        setPendingResult(saved.pendingResult ?? null);
        setLastPrompt(saved.lastPrompt ?? "");
        setAgentSteps(saved.agentSteps ?? []);
        setAgentTotalSteps(saved.agentTotalSteps ?? 0);
        setUseAgent(saved.useAgent ?? false);
      } else if (isSwitch) {
        setMessages(getInitialMessages());
        setPendingResult(null);
        setLastPrompt("");
        setAgentSteps([]);
        setAgentTotalSteps(0);
      }
    }

    if (isSwitch || prevId === undefined) {
      syncConversation();
    }

    // Always reset transient state on action switch
    setPrompt("");
    setError("");
    setStreamingReply("");
    setIsGenerating(false);
    setCooldownActive(false);
    clearTimeout(cooldownTimerRef.current);
    setAgentRunning(false);
    setAgentTotalSteps(0);
    setConfirmClear(false);
    abortRef.current = null;

    actionIdRef.current = actionId;
  }, [actionId]);

  // Sweep expired conversations on mount
  useEffect(() => {
    sweepExpiredConversations();
  }, []);

  // Cleanup cooldown timer on unmount
  useEffect(() => {
    return () => clearTimeout(cooldownTimerRef.current);
  }, []);

  // Debounced auto-save when conversation state changes
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveConversation(actionId, stateRef.current as any);
    }, 500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [actionId, messages, pendingResult, lastPrompt, agentSteps, useAgent, agentTotalSteps]);

  const promptExamples = useMemo(() => buildPromptExamples(currentConfig), [currentConfig]);

  const canSubmit = useMemo(() => prompt.trim().length > 0 && !isGenerating && !cooldownActive, [prompt, isGenerating, cooldownActive]);
  const previewActive = Boolean(pendingResult && previewProposal === pendingResult);
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

  async function submitPrompt(nextPrompt = prompt, modeOverride = "modify_action") {
    const trimmedPrompt = nextPrompt.trim();
    if (!trimmedPrompt || generatingRef.current || cooldownActive) return;

    const proposalContext = pendingResult;
    setPrompt("");
    setError("");
    generatingRef.current = true;
    setIsGenerating(true);
    onClearPreview?.();
    onClearAiSnapshot?.();
    setLastPrompt(trimmedPrompt);

    // Regenerate: remove last assistant message and skip duplicate user message
    const isRegen = Boolean(pendingResult) && trimmedPrompt === lastPrompt;
    if (isRegen) {
      setPendingResult(null);
      setMessages((current) => {
        const last = current[current.length - 1];
        if (last?.role === "assistant") return current.slice(0, -1);
        return current;
      });
    } else {
      setMessages((current) => [...current, { role: "user", content: trimmedPrompt, kind: "chat" }]);
    }

    // Create AbortController before async work so cancel is immediately available
    const controller = new AbortController();
    abortRef.current = () => controller.abort();

    try {
      if (useAgent) {
        // Agent mode: step-by-step reasoning + tool calls
        setAgentSteps([]);
        setAgentRunning(true);
        setStreamingReply("");

        const { result: rawResult } = await requestAiAgentRun({
          prompt: trimmedPrompt,
          currentConfig,
          actionConfigs,
          actionLabel,
          actionId,
          taskMode: modeOverride,
          proposalContext,
          signal: controller.signal,
          onEvent: (eventType, data) => {
            if (eventType === "progress" || eventType === "stream_token") {
              setStreamingReply((prev) => prev + (data.text || data.reply || ""));
              // Accumulate incremental token text into the current step's thought
              if (data.text) {
                setAgentSteps((prev) => {
                  const last = prev[prev.length - 1];
                  if (!last) return prev;
                  return [
                    ...prev.slice(0, -1),
                    { ...last, thought: last.thought + data.text },
                  ];
                });
              }
            } else if (eventType === "step_start") {
              if (data.totalSteps) setAgentTotalSteps(data.totalSteps);
              setAgentSteps((prev) => [
                ...prev,
                { index: data.step, thought: "", toolCalls: [], toolResults: [], durationMs: 0 },
              ]);
            } else if (eventType === "tool_call") {
              setAgentSteps((prev) => {
                const last = prev[prev.length - 1];
                if (!last) return prev;
                return [
                  ...prev.slice(0, -1),
                  { ...last, toolCalls: [...last.toolCalls, { name: data.toolName, arguments: data.arguments || {} }] },
                ];
              });
            } else if (eventType === "tool_result") {
              setAgentSteps((prev) => {
                const last = prev[prev.length - 1];
                if (!last) return prev;
                return [
                  ...prev.slice(0, -1),
                  { ...last, toolResults: [...last.toolResults, { name: data.toolName, result: data.result }] },
                ];
              });
            } else if (eventType === "step_end") {
              setAgentSteps((prev) => {
                const last = prev[prev.length - 1];
                if (!last) return prev;
                return [...prev.slice(0, -1), { ...last, durationMs: data.durationMs || last.durationMs }];
              });
            }
          },
        });

        setAgentRunning(false);
        setStreamingReply("");

        const proposal = {
          ...rawResult,
          actionId,
          taskMode: modeOverride,
          source: "agent",
          proposalId: rawResult.proposalId || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        };
        setPendingResult(proposal);
        setMessages((current) => [...current, { role: "assistant", content: proposal.reply || "Agent 已完成方案生成。", kind: "proposal" }]);
        notify?.({
          tone: "info",
          title: "Agent 已生成方案提案",
          description: proposal.scheme?.summary || proposal.diffSummary?.[0] || "请确认后再应用。",
        });
      } else {
        // Fast mode: one-shot streaming
        setStreamingReply("");
        const { result } = await requestAiSchemeEditStreaming({
          prompt: trimmedPrompt,
          currentConfig,
          actionLabel,
          actionId,
          taskMode: modeOverride,
          proposalContext,
          signal: controller.signal,
          onProgress: (replyText) => {
            setStreamingReply(replyText);
          },
        });

        setStreamingReply("");
        const proposal = {
          ...result,
          actionId,
          taskMode: modeOverride,
          proposalId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        };
        setPendingResult(proposal);
        setMessages((current) => [...current, { role: "assistant", content: proposal.reply, kind: "proposal" }]);
        notify?.({
          tone: "info",
          title: "AI 已生成方案提案",
          description: result.scheme?.summary || result.diffSummary?.[0] || "请确认后再应用。",
        });
      }
    } catch (caughtError) {
      setAgentRunning(false);
      if (controller.signal.aborted) {
        // User cancelled — silently ignore the error
      } else {
        const message = getAiRequestErrorMessage(caughtError);
        setError(message);
      }
    } finally {
      generatingRef.current = false;
      setIsGenerating(false);
      abortRef.current = null;
      // 启动冷却计时，防止快速连续发请求
      setCooldownActive(true);
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = setTimeout(() => setCooldownActive(false), COOLDOWN_MS);
    }
  }

  function cancelGeneration() {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    generatingRef.current = false;
    const partialContent = streamingReply;
    setAgentRunning(false);
    setIsGenerating(false);
    setStreamingReply("");
    if (partialContent.trim()) {
      setMessages((current) => [...current, { role: "assistant", content: partialContent, kind: "chat" }]);
    } else {
      setMessages((current) => [...current, { role: "assistant", content: "已取消本次生成。", kind: "chat" }]);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
      event.preventDefault();
      submitPrompt();
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    submitPrompt();
  }

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
      applyActionConfig(pendingResult.patch);
    }
    onClearPreview?.();
    setMessages((current) => [...current, { role: "assistant", content: "已应用这次改动到当前动作配置。", kind: "applied" }]);
    notify?.({
      tone: "success",
      title: "已应用 AI 方案",
      description: pendingResult.targets?.length > 1 ? `已更新 ${pendingResult.targets.length} 个动作。` : pendingResult.diffSummary?.[0] || "配置已更新，可在预览区查看效果。",
    });
    setPendingResult(null);
  }

  function discardPendingResult() {
    if (!pendingResult) return;
    setPendingResult(null);
    onClearPreview?.();
    setMessages((current) => [...current, { role: "assistant", content: "已放弃这次改动，当前配置保持不变。", kind: "discarded" }]);
  }

  function clearConversation() {
    setPrompt("");
    setError("");
    setPendingResult(null);
    setLastPrompt("");
    setAgentSteps([]);
    setAgentTotalSteps(0);
    generatingRef.current = false;
    setAgentRunning(false);
    setIsGenerating(false);
    setStreamingReply("");
    setMessages(getInitialMessages());
    deleteConversation(actionId);
    onClearPreview?.();
    notify?.({
      tone: "info",
      title: "已清空 AI 对话",
      description: "当前动作配置保持不变。",
    });
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
          <ModeSwitcher useAgent={useAgent} onToggle={setUseAgent} disabled={isGenerating} />
          {confirmClear ? (
            <div className="flex items-center gap-1 rounded-xl bg-rose-50 px-2 py-1">
              <span className="text-2xs font-medium text-rose-700">确认清空？</span>
              <button
                type="button"
                className="inline-flex size-6 items-center justify-center rounded-lg bg-white text-rose-600 transition-colors hover:bg-rose-100"
                onClick={() => {
                  clearConversation();
                  setConfirmClear(false);
                }}
                aria-label="确认清空"
              >
                <Check className="size-3.5" />
              </button>
              <button
                type="button"
                className="inline-flex size-6 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100"
                onClick={() => setConfirmClear(false)}
                aria-label="取消清空"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-xl text-slate-400 hover:text-rose-600"
              onClick={() => setConfirmClear(true)}
              disabled={isGenerating}
              aria-label="清空 AI 对话"
              title="清空 AI 对话"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
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
                <MessageBubble key={`${message.role}-${index}-${message.content}`} message={message} onEdit={setPrompt} actionId={actionId} notify={notify} />
              </motion.div>
            ))}
          </AnimatePresence>
          {isGenerating ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="flex justify-start">
                <div className="max-w-[86%] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">
                  {streamingReply ? (
                    <div className="prose-cd max-w-none">
                      <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                          code: ({ className, children, ...props }) => {
                            const isBlock = /language-/.test(className || "");
                            if (isBlock) {
                              return (
                                <pre className="mt-1 mb-1 overflow-x-auto rounded-lg bg-slate-100 p-2 text-2xs leading-5">
                                  <code className={className} {...props}>{children}</code>
                                </pre>
                              );
                            }
                            return (
                              <code className="rounded bg-slate-200/70 px-1 py-0.5 text-2xs font-mono" {...props}>
                                {children}
                              </code>
                            );
                          },
                          ul: ({ children }) => <ul className="mb-1 list-disc pl-4">{children}</ul>,
                          ol: ({ children }) => <ol className="mb-1 list-decimal pl-4">{children}</ol>,
                          li: ({ children }) => <li className="text-xs leading-5">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        }}
                      >
                        {streamingReply}
                      </Markdown>
                      <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-sky-400 align-middle" />
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-slate-500">
                      <span className="flex gap-1">
                        <span className="size-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                        <span className="size-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                        <span className="size-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                      </span>
                      <span className="text-slate-400">
                        {useAgent && agentRunning ? "Agent 正在分析需求" : "AI 正在生成"}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ) : null}

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <AgentTimeline steps={agentSteps} isRunning={agentRunning} totalSteps={agentTotalSteps} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <ProposalCard result={pendingResult} previewActive={previewActive} />
            <SanitizeHint meta={pendingResult?.sanitizeMeta} />
            <ChangeSummary items={pendingResult?.diffSummary} />
          </motion.div>

          {pendingResult?.tuningOptions?.length ? (
            <div className="flex flex-wrap gap-2">
              {pendingResult.tuningOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition-[transform,color,background-color,border-color,box-shadow] hover:bg-white active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                  onClick={() => {
                    submitPrompt(option, "tune_proposal");
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
                  onClick={() => submitPrompt(example)}
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
              onClick={() => {
                onRevertAiChanges?.();
                setMessages((current) => [...current, { role: "assistant", content: "已撤销 AI 改动，配置已恢复。", kind: "chat" }]);
              }}
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
              className="max-h-[112px] min-h-[48px] w-full resize-none bg-transparent px-1 py-1.5 text-sm leading-5 text-slate-800 outline-none placeholder:text-slate-400"
            />
            {isGenerating ? (
              <button
                type="button"
                className="absolute bottom-2 right-2 inline-flex size-9 items-center justify-center rounded-xl bg-rose-500 text-white transition-[transform,background-color] hover:bg-rose-600 active:scale-[0.97]"
                onClick={cancelGeneration}
                aria-label="停止生成"
                title="停止生成"
              >
                <Square className="size-3.5" aria-hidden="true" />
              </button>
            ) : (
              <Button className="absolute bottom-2 right-2 size-9 rounded-xl px-0 disabled:opacity-30 transition-opacity" type="submit" disabled={!canSubmit} aria-label="发送给 AI 方案助手" title={cooldownActive ? "冷却中 (3 秒)" : "发送 (↵)"}>
                <Send className="size-4" aria-hidden="true" />
              </Button>
            )}
          </div>
          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <span className="flex-1 text-pretty">{error}</span>
              {lastPrompt ? (
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-100 active:scale-[0.97]"
                  onClick={() => {
                    setError("");
                    submitPrompt(lastPrompt);
                  }}
                >
                  重试
                </button>
              ) : null}
            </div>
          ) : null}
        </form>
      </div>
    </Panel>
  );
}
