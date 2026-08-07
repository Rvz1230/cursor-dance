import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Activity,
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Pause,
  Play,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/components/ui/utils";
import { useToast } from "@/components/ui/toast";
import { effectToneByName } from "@/components/ui/theme-identity";
import type { ActiveWindowSnapshot } from "@/shared/app-rules";
import { isDesktop } from "@/shared/runtime";
import packageMetadata from "../../../../../package.json";
import {
  clearRuntimeDiagnostics,
  clearRuntimeErrors,
  readDiagnosticDebugFlag,
  readRuntimeDiagnostics,
  readRuntimeErrors,
  subscribeRuntimeDiagnostics,
  writeDiagnosticDebugFlag,
} from "../lib/workbenchConfig";
import {
  appendDiagnosticEntry,
  diagnosticReasonLabel,
  groupDiagnosticEntries,
} from "../lib/diagnosticsSurface";

type DiagnosticEntry = Record<string, unknown> & { at?: string; scope?: string };
type DiagnosticGroup = ReturnType<typeof groupDiagnosticEntries>[number];
type ResultFilter = "all" | "fire" | "skip";
type ScopeFilter = "all" | "action" | "audio" | "pointer";

interface DiagnosticsPanelProps {
  selectedThemeId: string;
  themeName?: string;
  accessibilityAuthorized?: boolean | null;
  activeApp?: ActiveWindowSnapshot | null;
}

const FUNNEL_STEPS = [
  { key: "ready", label: "就绪", detail: "引擎已初始化、配置已加载" },
  { key: "rule", label: "应用规则", detail: "刚才使用的应用是否被规则禁用" },
  { key: "zone", label: "触发区域", detail: "指针是否落在配置的触发区内" },
  { key: "signal", label: "内容信号", detail: "能否取得元素、窗口几何或指针位置" },
  { key: "config", label: "配置解析", detail: "动作与状态绑定能否解析出配置" },
  { key: "budget", label: "效果预算", detail: "同时存在的效果数是否已达上限" },
  { key: "fire", label: "发射", detail: "进入 visual-effects 渲染" },
] as const;

const RESULT_OPTIONS: Array<{ value: ResultFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "fire", label: "已发射" },
  { value: "skip", label: "被跳过" },
];

const SCOPE_OPTIONS: Array<{ value: ScopeFilter; label: string }> = [
  { value: "all", label: "全部域" },
  { value: "action", label: "action" },
  { value: "audio", label: "audio" },
  { value: "pointer", label: "pointer" },
];

function formatRelativeTime(value?: string) {
  const time = new Date(value || "").getTime();
  if (!Number.isFinite(time)) return "未知时间";
  const seconds = Math.floor((Date.now() - time) / 1_000);
  if (seconds < 3) return "刚刚";
  if (seconds < 60) return `${seconds} 秒前`;
  return new Date(time).toLocaleTimeString("zh-CN");
}

function formatTarget(target: unknown) {
  const value = (target || {}) as Record<string, unknown>;
  return String(value.selector || value.role || value.type || "未记录");
}

function formatPayload(entry: DiagnosticEntry) {
  return Object.entries(entry)
    .filter(([key, value]) => !["scope", "at", "href"].includes(key) && value != null && value !== "")
    .map(([key, value]) => {
      if (typeof value === "object") return `${key}=${JSON.stringify(value)}`;
      return `${key}=${String(value)}`;
    })
    .join(" ") || "已记录";
}

function stopIndexFor(group: DiagnosticGroup) {
  const map: Record<string, number> = {
    "not-ready": 0,
    "unsupported-on-platform": 0,
    "site-disabled": 1,
    "trigger-zone-filtered": 2,
    "content-signal-unavailable": 3,
    "missing-source-action-config": 4,
    "missing-resolved-action-config": 4,
    "no-enabled-effects": 4,
    "budget-exhausted": 5,
    throttled: 5,
    "wheel-burst-suppressed": 5,
  };
  return group.result === "skip" ? (map[group.reason] ?? 4) : FUNNEL_STEPS.length - 1;
}

function OutputChips({ outputs }: { outputs: string[] }) {
  if (!outputs.length) return null;
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {outputs.map((output) => (
        <span key={output} className={cn("inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-medium", effectToneByName(output))}>
          {output}
        </span>
      ))}
    </span>
  );
}

function Verdict({ group }: { group: DiagnosticGroup }) {
  const isFire = group.result === "fire";
  const isInfo = group.result === "info";
  const text = group.result === "fallback"
    ? "已发射 · 回落到指针"
    : isFire
      ? "已发射"
      : group.result === "skip"
        ? `被跳过 · ${diagnosticReasonLabel(group.reason)}`
        : "已记录";
  return (
    <span className={cn(
      "inline-flex h-7 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold ring-1",
      isFire
        ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
        : isInfo ? "bg-slate-100 text-slate-700 ring-slate-200" : "bg-amber-50 text-amber-800 ring-amber-200",
    )}>
      <span className={cn("size-1.5 rounded-full", isFire ? "bg-emerald-500" : isInfo ? "bg-slate-400" : "bg-amber-500")} />
      {text}
    </span>
  );
}

function Funnel({ group, themeName, activeAppName }: { group: DiagnosticGroup; themeName: string; activeAppName: string }) {
  const stopIndex = stopIndexFor(group);
  const fallback = group.result === "fallback";
  const info = group.result === "info";
  const details = [
    ["触发", group.trigger],
    ["前台应用", group.host || activeAppName || "未记录"],
    ["主题", group.theme || themeName || "未记录"],
    ["触发区域", group.zone || "任意区域"],
    ["命中目标", formatTarget(group.target)],
    ["原始 scope", group.scopes.join(" · ")],
  ];

  return (
    <>
      <div className="flex flex-wrap items-stretch gap-1.5">
        {FUNNEL_STEPS.map((step, index) => {
          const blocked = group.result === "skip" && index === stopIndex;
          const skipped = group.result === "skip" && index > stopIndex;
          const fellBack = fallback && step.key === "signal";
          return (
            <div key={step.key} className="contents">
              <div className={cn(
                "flex min-w-24 flex-1 flex-col gap-1 rounded-xl border px-2.5 py-2 text-left",
                blocked ? "border-amber-300 bg-amber-50" : fellBack ? "border-amber-200 bg-amber-50/60" : skipped || info ? "border-dashed border-slate-200 bg-white" : "border-slate-200 bg-white",
              )}>
                <span className="flex items-center gap-1.5">
                  {blocked ? <X className="size-3 text-amber-600" strokeWidth={3} /> : fellBack ? <ArrowRight className="size-3 text-amber-600" strokeWidth={2.5} /> : skipped || info ? <span className="size-1.5 rounded-full bg-slate-300" /> : <Check className="size-3 text-emerald-600" strokeWidth={3} />}
                  <span className={cn("text-xs font-semibold", skipped || info ? "text-slate-500" : "text-slate-700")}>{step.label}</span>
                </span>
                <span className={cn("text-2xs leading-tight", skipped ? "text-slate-300" : fellBack ? "text-amber-700" : "text-slate-500")}>
                  {fellBack ? "内容信号不可用——效果照旧发射，但锚在指针上" : step.detail}
                </span>
              </div>
              {index < FUNNEL_STEPS.length - 1 ? <span className="self-center text-slate-300">›</span> : null}
            </div>
          );
        })}
      </div>
      <div className="mt-3 grid gap-1 rounded-xl bg-slate-50 px-3 py-2.5 xl:grid-cols-2">
        {details.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-2">
            <span className="w-16 shrink-0 text-xs text-slate-500">{label}</span>
            <span className="min-w-0 flex-1 truncate font-mono text-2xs text-slate-700">{value}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function BudgetMeter({ label, now, max }: { label: string; now?: number; max: number }) {
  const known = typeof now === "number" && Number.isFinite(now);
  const percent = known ? Math.min(100, Math.round((now / max) * 100)) : 0;
  const hot = percent >= 80;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <span className={cn("text-xs font-semibold tabular-nums", hot ? "text-amber-700" : "text-slate-600")}>{known ? `${now}/${max}` : "未提供"}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className={cn("h-full rounded-full", hot ? "bg-amber-500" : "bg-slate-900")} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function latestBudget(entries: DiagnosticEntry[], nowKey: string, maxKey: string, fallbackMax: number) {
  const entry = [...entries].reverse().find((item) => typeof item[nowKey] === "number");
  return {
    now: entry?.[nowKey] as number | undefined,
    max: typeof entry?.[maxKey] === "number" ? entry[maxKey] as number : fallbackMax,
  };
}

async function copyText(text: string): Promise<void> {
  let copied = false;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      copied = !navigator.clipboard.readText || await navigator.clipboard.readText() === text;
    } catch {}
  }
  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  copied = document.execCommand("copy") || copied;
  input.remove();
  try {
    if (navigator.clipboard?.readText) copied = await navigator.clipboard.readText() === text;
  } catch {}
  if (!copied) throw new Error("copy-failed");
}

export function DiagnosticsPanel({
  selectedThemeId,
  themeName = "",
  accessibilityAuthorized = null,
  activeApp = null,
}: DiagnosticsPanelProps) {
  const toast = useToast();
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [diagnosticEntries, setDiagnosticEntries] = useState<DiagnosticEntry[]>([]);
  const [runtimeErrors, setRuntimeErrors] = useState<DiagnosticEntry[]>([]);
  const [pausedEntries, setPausedEntries] = useState<DiagnosticEntry[] | null>(null);
  const [pendingWhilePaused, setPendingWhilePaused] = useState(0);
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [reasonFilter, setReasonFilter] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const pausedRef = useRef(false);
  const resultBeforeReason = useRef<ResultFilter | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void readDiagnosticDebugFlag().then((enabled) => { if (!cancelled) setDebugEnabled(enabled); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      void readRuntimeDiagnostics().then((entries) => {
        if (!cancelled && Array.isArray(entries)) setDiagnosticEntries(entries as DiagnosticEntry[]);
      }).catch(() => undefined);
    }
    const unsubscribeDiagnostics = subscribeRuntimeDiagnostics((entry) => {
      if (cancelled) return;
      setDiagnosticEntries((current) => appendDiagnosticEntry(current, entry) as DiagnosticEntry[]);
      if (pausedRef.current) setPendingWhilePaused((count) => count + 1);
    });
    return () => {
      cancelled = true;
      unsubscribeDiagnostics();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void readRuntimeErrors().then((errors) => {
      if (!cancelled && Array.isArray(errors)) setRuntimeErrors(errors as DiagnosticEntry[]);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const visibleEntries = pausedEntries || diagnosticEntries;
  const groups = useMemo(() => groupDiagnosticEntries(visibleEntries), [visibleEntries]);
  const filteredGroups = useMemo(() => groups.filter((group) => {
    if (resultFilter === "fire" && group.result !== "fire" && group.result !== "fallback") return false;
    if (resultFilter === "skip" && group.result !== "skip") return false;
    if (scopeFilter !== "all" && !group.scopes.some((scope) => String(scope).startsWith(`${scopeFilter}.`))) return false;
    if (reasonFilter === "content-signal-unavailable") return group.result === "fallback";
    if (reasonFilter && group.reason !== reasonFilter) return false;
    return true;
  }), [groups, reasonFilter, resultFilter, scopeFilter]);
  const selectedGroup = filteredGroups.find((group) => group.id === selectedGroupId) || filteredGroups[0] || null;

  const reasonStats = useMemo(() => {
    const counts = new Map<string, number>();
    groups.slice(0, 40).forEach((group) => {
      if (group.reason) counts.set(group.reason, (counts.get(group.reason) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [groups]);

  const activeAppName = activeApp?.authorized ? activeApp.processName : "";
  const platform = window.electronAPI?.platform;
  const platformLabel = platform === "darwin" ? "macOS" : platform === "win32" ? "Windows" : "浏览器扩展";
  const capabilities = window.electronAPI?.capabilities;
  const cursorStatus = capabilities?.systemCursorReplacement.status || (isDesktop() ? "unknown" : "n/a");
  const effectBudget = latestBudget(diagnosticEntries, "activeEffects", "maxActiveEffects", 48);
  const keyboardBudget = latestBudget(diagnosticEntries, "activeKeyEffects", "maxSimultaneous", 30);
  const audioBudget = latestBudget(diagnosticEntries, "activeAudioEffects", "maxAudioEffects", 4);

  function toggleCapture(next = !debugEnabled) {
    setDebugEnabled(next);
    void writeDiagnosticDebugFlag(next).catch(() => {
      setDebugEnabled(!next);
      toast({ title: "采集开关保存失败", tone: "error" });
    });
  }

  function togglePaused() {
    if (pausedEntries) {
      pausedRef.current = false;
      setPausedEntries(null);
      setPendingWhilePaused(0);
      return;
    }
    pausedRef.current = true;
    setPausedEntries(diagnosticEntries.slice());
    setPendingWhilePaused(0);
  }

  async function clearEvents() {
    try {
      await clearRuntimeDiagnostics();
      setDiagnosticEntries([]);
      if (pausedEntries) setPausedEntries([]);
      setPendingWhilePaused(0);
      setSelectedGroupId(null);
      toast({ title: "已清空诊断事件", tone: "info" });
    } catch {
      toast({ title: "清空失败，请稍后重试", tone: "error" });
    }
  }

  async function copyReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      capturing: debugEnabled,
      environment: {
        platform: platformLabel,
        accessibility: accessibilityAuthorized,
        cursorReplacement: cursorStatus,
        theme: themeName || selectedThemeId,
        foregroundApp: activeAppName || null,
      },
      runtimeErrors,
      events: diagnosticEntries.slice(-40),
    };
    try {
      await copyText(JSON.stringify(report, null, 2));
      toast({ title: debugEnabled ? "已复制诊断报告" : "已复制现有诊断信息", tone: "success" });
    } catch {
      toast({ title: "复制失败，请检查剪贴板权限", tone: "error" });
    }
  }

  function selectResult(value: ResultFilter) {
    resultBeforeReason.current = null;
    setResultFilter(value);
  }

  function selectReason(reason: string) {
    if (reasonFilter === reason) {
      setReasonFilter(null);
      if (resultBeforeReason.current) setResultFilter(resultBeforeReason.current);
      resultBeforeReason.current = null;
      return;
    }
    if (!reasonFilter) resultBeforeReason.current = resultFilter;
    setReasonFilter(reason);
    setResultFilter(reason === "content-signal-unavailable" ? "fire" : "skip");
  }

  function clearReason() {
    setReasonFilter(null);
    if (resultBeforeReason.current) setResultFilter(resultBeforeReason.current);
    resultBeforeReason.current = null;
  }

  return (
    <div className="min-h-full bg-slate-50 px-3 py-3">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-2.5">
        <header className="flex flex-col items-stretch justify-between gap-3 md:flex-row md:items-start">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-900">诊断面板</h1>
            <p className="mt-1 max-w-2xl text-pretty text-xs leading-relaxed text-slate-500">回答「效果为什么没出来」。裁决链在最上面，日志在下面。</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button type="button" role="switch" aria-checked={debugEnabled} onClick={() => toggleCapture()} className="flex h-8 items-center gap-2 rounded-xl bg-white px-2.5 text-xs text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
              <span className={cn("inline-flex h-4 w-7 items-center rounded-full bg-slate-300 p-0.5 transition-colors", debugEnabled && "bg-slate-950")}><span className={cn("size-3 rounded-full bg-white shadow-sm transition-transform", debugEnabled && "translate-x-3")} /></span>
              <span className="font-medium">采集</span>
            </button>
            <Button variant="outline" className="h-8 px-3 text-xs" onClick={copyReport}><Copy className="mr-1.5 size-3.5" />复制诊断报告</Button>
            <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => void clearEvents()}>清空</Button>
          </div>
        </header>

        {!debugEnabled ? (
          <>
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-amber-900">采集已关闭</div>
                <p className="mt-1 text-xs leading-relaxed text-amber-700">开启后会记录每次触发的裁决过程。它只写本地，不上传。</p>
                <Button variant="outline" className="mt-2 h-7 px-2.5 text-xs" onClick={() => toggleCapture(true)}>开启采集</Button>
              </div>
            </div>
            <section className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
              <div className="mx-auto grid size-10 place-items-center rounded-full bg-slate-100 text-slate-500"><Activity className="size-5" /></div>
              <p className="mt-3 text-xs font-medium text-slate-600">还没有诊断事件</p>
              <p className="mx-auto mt-1.5 max-w-sm text-2xs leading-relaxed text-slate-500">开启采集后，在桌面上点一下鼠标或敲一个键，这里会记录整条裁决过程。</p>
            </section>
          </>
        ) : (
          <>
            {runtimeErrors.length ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-rose-900">运行时报错 {runtimeErrors.length} 条</div>
                    <ul className="mt-1.5 space-y-1">
                      {runtimeErrors.slice(-3).map((error, index) => <li key={`${error.at || "error"}-${index}`} className="truncate font-mono text-xs text-rose-800">{String(error.detail || error.message || error.type || "未知运行时错误")}</li>)}
                    </ul>
                  </div>
                  <Button variant="outline" className="h-7 shrink-0 px-2.5 text-xs" onClick={() => void clearRuntimeErrors().then(() => setRuntimeErrors([]))}>清除报错</Button>
                </div>
              </div>
            ) : null}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <div className="min-w-0"><h2 className="text-sm font-medium text-slate-900">最近一次触发</h2><p className="mt-0.5 text-xs text-slate-500">把散落的 action.skip 收成一条可读的裁决漏斗</p></div>
                {selectedGroup ? <div className="flex items-center gap-2"><Verdict group={selectedGroup} /><span className="text-xs tabular-nums text-slate-500">{formatRelativeTime(selectedGroup.at)} · {selectedGroup.trigger}</span></div> : null}
              </div>
              <div className="px-4 py-4">
                {selectedGroup ? <Funnel group={selectedGroup} themeName={themeName || selectedThemeId} activeAppName={activeAppName} /> : <div className="py-6 text-center text-xs text-slate-500">等待第一次触发后，这里会显示完整裁决链。</div>}
              </div>
            </section>

            <div className="grid gap-2.5 min-[860px]:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]">
              <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
                  <div className="flex items-center gap-2"><h2 className="text-sm font-medium text-slate-900">事件流</h2><span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-slate-500">{filteredGroups.length} 组</span></div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button variant={pausedEntries ? "default" : "outline"} className="h-7 px-2.5 text-xs" title="暂停后仍继续采集，只冻结当前列表" onClick={togglePaused} disabled={!diagnosticEntries.length}>{pausedEntries ? <Play className="mr-1.5 size-3" /> : <Pause className="mr-1.5 size-3" />}{pausedEntries ? `继续滚动${pendingWhilePaused ? ` (${pendingWhilePaused})` : ""}` : "暂停滚动"}</Button>
                    <Segmented<ResultFilter> ariaLabel="按裁决结果筛选" value={resultFilter} options={RESULT_OPTIONS} onChange={selectResult} className="gap-0.5 p-0.5 [&_button]:h-6 [&_button]:px-2" />
                    <Segmented<ScopeFilter> ariaLabel="按日志域筛选" value={scopeFilter} options={SCOPE_OPTIONS} onChange={setScopeFilter} className="gap-0.5 p-0.5 [&_button]:h-6 [&_button]:px-2" />
                  </div>
                </div>
                {reasonFilter ? <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-1.5"><span className="text-xs text-slate-500">{reasonFilter === "content-signal-unavailable" ? "只看" : "只看被"}<span className="font-medium text-slate-700">{diagnosticReasonLabel(reasonFilter)}</span>{reasonFilter === "content-signal-unavailable" ? "的那些次" : "拦下的"}</span><button type="button" className="ml-auto text-xs font-medium text-slate-500 underline underline-offset-2 hover:text-slate-900" onClick={clearReason}>清除</button></div> : null}
                <div className="max-h-[430px] divide-y divide-slate-100 overflow-y-auto">
                  {filteredGroups.length ? filteredGroups.map((group) => {
                    const open = selectedGroup?.id === group.id;
                    const fired = group.result === "fire" || group.result === "fallback";
                    return (
                      <div key={group.id}>
                        <button type="button" className={cn("flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-slate-50", open && "bg-slate-50")} onClick={() => setSelectedGroupId(group.id)}>
                          <span className={cn("size-1.5 shrink-0 rounded-full", fired ? "bg-emerald-500" : group.result === "skip" ? "bg-amber-500" : "bg-slate-400")} />
                          <span className="w-16 shrink-0 font-mono text-xs tabular-nums text-slate-500">{formatRelativeTime(group.at)}</span>
                          <span className="w-20 shrink-0 truncate text-xs font-medium text-slate-700">{group.trigger}</span>
                          <span className={cn("flex min-w-0 flex-1 items-center gap-1 truncate text-xs", fired ? "text-slate-500" : "text-amber-700")}>
                            {group.outputs.length ? <OutputChips outputs={group.outputs} /> : group.reason ? diagnosticReasonLabel(group.reason) : group.scopes[group.scopes.length - 1]}
                          </span>
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">{group.entries.length}</span>
                          <ChevronRight className={cn("size-3 shrink-0 text-slate-300 transition-transform", open && "rotate-90")} />
                        </button>
                        {open ? <div className="space-y-0.5 bg-slate-50 px-4 pb-2 pt-1">{group.entries.map((entry, index) => <div key={`${entry.at || "entry"}-${index}`} className="flex items-baseline gap-2"><span className={cn("w-28 shrink-0 font-mono text-2xs", entry.scope?.endsWith("skip") ? "text-amber-700" : "text-slate-500")}>{entry.scope}</span><span className="min-w-0 flex-1 break-all font-mono text-2xs text-slate-600">{formatPayload(entry)}</span></div>)}</div> : null}
                      </div>
                    );
                  }) : <div className="px-4 py-10 text-center text-xs text-slate-500">{groups.length ? "没有符合筛选条件的事件" : "还没有诊断事件，触发一次鼠标或键盘动作后会出现在这里"}</div>}
                </div>
              </section>

              <aside className="space-y-2.5">
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-4 py-2.5"><h2 className="text-sm font-medium text-slate-900">预算水位</h2><p className="mt-0.5 text-xs text-slate-500">运行时一直按这些上限限流。</p></div>
                  <div className="space-y-3 px-4 py-3"><BudgetMeter label="同时存在的效果" {...effectBudget} /><BudgetMeter label="键盘字符" {...keyboardBudget} /><BudgetMeter label="音频并发" {...audioBudget} /></div>
                </section>
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-4 py-2.5"><h2 className="text-sm font-medium text-slate-900">拦截分布</h2><p className="mt-0.5 text-xs text-slate-500">最近 <span className="tabular-nums">{Math.min(40, groups.length)}</span> 次触发</p></div>
                  <div className="space-y-2 px-4 py-3">{reasonStats.length ? reasonStats.map(([reason, count]) => { const total = reasonStats.reduce((sum, [, value]) => sum + value, 0); const selected = reasonFilter === reason; return <button key={reason} type="button" className={cn("flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-slate-50", selected && "bg-slate-100")} onClick={() => selectReason(reason)}><span className={cn("min-w-0 flex-1 truncate text-xs", selected ? "font-semibold text-slate-800" : "text-slate-600")}>{diagnosticReasonLabel(reason)}</span><span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200"><span className={cn("block h-full rounded-full", selected ? "bg-slate-900" : "bg-slate-400")} style={{ width: `${Math.round((count / total) * 100)}%` }} /></span><span className="w-6 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-600">{count}</span></button>; }) : <p className="py-2 text-xs text-slate-500">暂无拦截记录</p>}</div>
                </section>
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-4 py-2.5"><h2 className="text-sm font-medium text-slate-900">环境</h2></div>
                  <div className="divide-y divide-slate-100 px-4 text-xs">
                    {[
                      ["平台", platformLabel, "text-slate-700"],
                      ["版本", packageMetadata.version, "text-slate-700"],
                      ["辅助功能", accessibilityAuthorized == null ? "未检测" : accessibilityAuthorized ? "已授权" : "未授权", accessibilityAuthorized ? "text-emerald-700" : "text-amber-700"],
                      ["系统光标替换", cursorStatus, cursorStatus === "supported" ? "text-emerald-700" : "text-slate-700"],
                      ["当前主题", themeName || selectedThemeId || "未记录", "text-slate-700"],
                      ["前台应用", activeAppName || "未检测", "text-slate-700"],
                    ].map(([label, value, tone]) => <div key={label} className="flex items-center justify-between gap-3 py-1.5"><span className="text-slate-500">{label}</span><span className={cn("truncate text-right font-medium tabular-nums", tone)}>{value}</span></div>)}
                  </div>
                </section>
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
