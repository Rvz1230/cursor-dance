import { useMemo, useState } from "react";
import { Bot, Check, CheckCircle2, Eye, Loader2, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { cn } from "@/components/ui/utils.js";
import { requestAiSchemeEdit } from "../lib/aiSchemeAssistant.js";
import { Panel } from "./WorkbenchControls.jsx";

const PROMPT_EXAMPLES = [
  "适合写代码的简约蓝色点击效果，不要声音",
  "赛博朋克一点，但不要太花",
  "再低调一点，粒子少一点",
];

const TASK_MODES = [
  { id: "modify_action", label: "修改当前动作" },
  { id: "generate_action", label: "生成动作方案" },
  { id: "explain_config", label: "解释配置" },
];

function MessageBubble({ message }) {
  const isAssistant = message.role === "assistant";
  return (
    <div className={cn("flex", isAssistant ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[86%] rounded-2xl px-3 py-2 text-xs leading-5 text-pretty",
          isAssistant
            ? "border border-slate-200 bg-slate-50 text-slate-700"
            : "bg-slate-900 text-white"
        )}
      >
        {message.content}
      </div>
    </div>
  );
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
  const label = source?.startsWith("model") ? "模型建议" : source?.includes("api") ? "本地 API" : "本地原型";
  const tone = source?.startsWith("model")
    ? "border-sky-100 bg-sky-50 text-sky-700"
    : source?.includes("api")
      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-slate-50 text-slate-600";
  return <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", tone)}>{label}</span>;
}

function SanitizeHint({ meta }) {
  if (!meta?.droppedFieldCount) return null;
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      已过滤 {meta.droppedFieldCount} 个不受支持字段，保留 {meta.acceptedFieldCount} 个可执行字段。
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

  return (
    <div className="min-h-0 rounded-2xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">配置变更提案</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {result.target?.label || "当前动作"} · {previewActive ? "实时预览正在使用这版建议" : "确认前不会写入当前配置"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {previewActive ? <span className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">预览中</span> : null}
          <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", riskTone)}>{riskLabel}</span>
          <SourceBadge source={result.source} />
        </div>
      </div>

      {result.reply ? <div className="mb-2 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 text-pretty">{result.reply}</div> : null}
      {result.warnings?.length ? (
        <div className="mb-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          {result.warnings.slice(0, 2).join("；")}
        </div>
      ) : null}

      {diffItems.length ? (
        <div className="max-h-[148px] space-y-1.5 overflow-y-auto pr-1">
          {diffItems.slice(0, 8).map((item) => (
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
  );
}

export function AiSchemePanel({
  actionId,
  actionLabel,
  currentConfig,
  applyActionConfig,
  previewProposal,
  onPreviewProposal,
  onClearPreview,
  notify,
  variant = "dock",
}) {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "描述你想要的鼠标反馈，我会直接生成或修改当前动作配置。",
    },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [pendingResult, setPendingResult] = useState(null);
  const [lastPrompt, setLastPrompt] = useState("");
  const [taskMode, setTaskMode] = useState("modify_action");

  const canSubmit = useMemo(() => prompt.trim().length > 0 && !isGenerating, [prompt, isGenerating]);
  const previewActive = Boolean(pendingResult && previewProposal === pendingResult);

  async function submitPrompt(nextPrompt = prompt) {
    const trimmedPrompt = nextPrompt.trim();
    if (!trimmedPrompt || isGenerating) return;

    setPrompt("");
    setError("");
    setIsGenerating(true);
    setPendingResult(null);
    onClearPreview?.();
    setLastPrompt(trimmedPrompt);
    setMessages((current) => [...current, { role: "user", content: trimmedPrompt }]);

    try {
      const result = await requestAiSchemeEdit({
        prompt: trimmedPrompt,
        currentConfig,
        actionLabel,
        actionId,
        taskMode,
      });

      const proposal = {
        ...result,
        actionId,
        taskMode,
        proposalId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      };
      setPendingResult(proposal);
      setMessages((current) => [...current, { role: "assistant", content: proposal.reply }]);
      notify?.({
        tone: "info",
        title: "AI 已生成改动建议",
        description: result.diffSummary?.[0] || "请确认后再应用到当前动作。",
      });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "生成失败，请稍后重试。";
      setError(message);
      setMessages((current) => [...current, { role: "assistant", content: "这次没有成功应用配置，请调整描述后再试一次。" }]);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    submitPrompt();
  }

  function applyPendingResult() {
    if (!pendingResult) return;
    applyActionConfig(pendingResult.patch);
    onClearPreview?.();
    setMessages((current) => [...current, { role: "assistant", content: "已应用这次改动到当前动作配置。" }]);
    notify?.({
      tone: "success",
      title: "已应用 AI 改动",
      description: pendingResult.diffSummary?.[0] || "配置已更新，可在预览区查看效果。",
    });
    setPendingResult(null);
  }

  function discardPendingResult() {
    if (!pendingResult) return;
    setPendingResult(null);
    onClearPreview?.();
    setMessages((current) => [...current, { role: "assistant", content: "已放弃这次改动，当前配置保持不变。" }]);
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
      iconTone="bg-emerald-100 text-emerald-700"
      summary={`正在操作：${actionLabel}`}
      className={cn("shadow-sm", variant === "full" ? "flex h-full min-h-0 flex-col" : "max-h-[380px] shrink-0")}
      contentClassName={cn("min-h-0 overflow-hidden", variant === "full" && "flex flex-1 flex-col")}
      action={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
          <Sparkles className="size-3.5" aria-hidden="true" />
          Proposal
        </span>
      }
    >
      <div className={cn("flex min-h-0 flex-col gap-3", variant === "full" && "flex-1")}>
        <div className="grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1">
          {TASK_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={cn(
                "h-8 rounded-xl px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2",
                taskMode === mode.id ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:bg-white/70"
              )}
              onClick={() => setTaskMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className={cn("space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2", variant === "full" ? "min-h-[112px] max-h-[180px]" : "min-h-[92px] max-h-[132px]")}>
          {messages.slice(-5).map((message, index) => (
            <MessageBubble key={`${message.role}-${index}-${message.content}`} message={message} />
          ))}
          {isGenerating ? (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                正在生成配置建议
              </div>
            </div>
          ) : null}
        </div>

        <ProposalCard result={pendingResult} previewActive={previewActive} />
        <SanitizeHint meta={pendingResult?.sanitizeMeta} />

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {PROMPT_EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
              onClick={() => submitPrompt(example)}
              disabled={isGenerating}
            >
              {example}
            </button>
          ))}
        </div>

        <form className="grid gap-2" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="ai-scheme-prompt">描述想要的鼠标效果</label>
          <div className="relative rounded-[22px] border border-slate-200 bg-slate-50 p-2 pr-13 shadow-inner shadow-slate-200/50 focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-slate-950/10">
            <textarea
              id="ai-scheme-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="例如：科技感一点、低调、不要声音、粒子少一点"
              rows={2}
              className="max-h-[92px] min-h-[48px] w-full resize-none bg-transparent px-1 py-1.5 text-sm leading-5 text-slate-800 outline-none placeholder:text-slate-400"
            />
            <Button className="absolute bottom-2 right-2 size-10 rounded-2xl px-0" type="submit" disabled={!canSubmit} aria-label="发送给 AI 方案助手">
              {isGenerating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
            </Button>
          </div>
          {error ? <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div> : null}
        </form>

        {pendingResult ? (
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-2">
            <Button variant={previewActive ? "default" : "outline"} className="rounded-2xl px-3" onClick={previewPendingResult}>
              <Eye className="mr-2 size-4" aria-hidden="true" />
              预览
            </Button>
            <Button className="rounded-2xl bg-emerald-700 hover:bg-emerald-800" onClick={applyPendingResult}>
              <Check className="mr-2 size-4" aria-hidden="true" />
              应用改动
            </Button>
            <Button variant="outline" size="icon" className="size-10 rounded-2xl" onClick={() => submitPrompt(lastPrompt)} disabled={!lastPrompt || isGenerating} aria-label="重新生成">
              <RotateCcw className="size-4" aria-hidden="true" />
            </Button>
            <Button variant="outline" size="icon" className="size-10 rounded-2xl text-rose-600" onClick={discardPendingResult} aria-label="放弃改动">
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ) : null}

        <ChangeSummary items={pendingResult?.diffSummary} />
      </div>
    </Panel>
  );
}
