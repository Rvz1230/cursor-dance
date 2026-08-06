import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/components/ui/utils";

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

function ProposalOverview({ proposal }) {
  if (!proposal) return null;
  return (
    <div className="mb-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm text-slate-700">{proposal.name}</div>
          <div className="mt-1 text-xs leading-5 text-slate-600 text-pretty">{proposal.summary}</div>
        </div>
      </div>
      {proposal.styleTags?.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {proposal.styleTags.map((tag) => (
            <span key={tag} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">{tag}</span>
          ))}
        </div>
      ) : null}
      {proposal.rationale ? <div className="mt-2 text-xs leading-5 text-slate-500 text-pretty">{proposal.rationale}</div> : null}
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
  if (!result) return null;

  return <ProposalCardContent result={result} previewActive={previewActive} />;
}

function ProposalCardContent({ result, previewActive }) {
  const diffItems = result.diffItems || [];
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
          <div className="truncate text-sm font-medium text-slate-900">AI 方案提案</div>
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

      <ProposalOverview proposal={result.scheme} />

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
                      <span className="truncate font-medium text-slate-700 align-middle">{item.afterLabel}</span>
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

export function AiProposalPresentation({ result, previewActive }) {
  return (
    <>
      <ProposalCard result={result} previewActive={previewActive} />
      <SanitizeHint meta={result?.sanitizeMeta} />
      <ChangeSummary items={result?.diffSummary} />
    </>
  );
}
