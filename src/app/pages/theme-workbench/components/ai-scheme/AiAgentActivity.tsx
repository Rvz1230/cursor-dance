import { useEffect, useRef, useState } from "react";
import { Bot, Check, ChevronDown, ChevronRight, Loader2, Wrench, Zap } from "lucide-react";
import { cn } from "@/components/ui/utils";

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

export function AiAgentTimeline({ steps, isRunning, totalSteps }) {
  if (!steps?.length && !isRunning) return null;

  const stepLabel = totalSteps > 0 ? `${steps.length} / ${totalSteps}` : `${steps.length} 步`;

  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Bot className="size-4 text-sky-600" />
        <span className="text-xs font-medium text-sky-700">Agent 步骤</span>
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
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-2xs font-semibold text-sky-700">{step.index}</span>
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

export function AiModeSwitcher({ useAgent, onToggle, disabled }) {
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
              <span className="text-xs font-medium text-slate-600">快速模式</span>
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
              <span className="text-xs font-medium text-slate-600">Agent 模式</span>
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

