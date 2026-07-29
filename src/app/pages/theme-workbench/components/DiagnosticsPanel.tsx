import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bug, Eye, Pause, Play, RadioTower, RefreshCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataPill, Panel } from "./WorkbenchControls";
import {
  clearRuntimeErrors,
  readDiagnosticDebugFlag,
  readLivePreviewConfig,
  readRuntimeDiagnostics,
  readRuntimeErrors,
  subscribeLivePreviewConfig,
  subscribeRuntimeDiagnostics,
  writeDiagnosticDebugFlag,
} from "../lib/extensionConfig";
import { appendDiagnosticEntry, summarizeLivePreviewConfig } from "../lib/diagnosticsSurface";
import { isDesktop } from "@/shared/runtime";

const DIAGNOSTICS_STORAGE_KEY = "cursordance.debug";

const SCOPE_PREFIX_LABELS = {
  action: "动作",
  audio: "音频",
  "trigger-zone": "触发区域",
  runtime: "运行时",
};

const SCOPE_FILTERS = [
  { key: "all", label: "全部" },
  { key: "action", label: "动作" },
  { key: "audio", label: "音频" },
  { key: "trigger-zone", label: "触发区域" },
  { key: "runtime", label: "运行时" },
];

function parseBooleanFlag(value) {
  if (value === true) return true;
  if (typeof value !== "string") return false;
  return ["1", "true", "on", "yes", "debug"].includes(value.trim().toLowerCase());
}

function readDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    const queryFlag = new URL(window.location.href).searchParams.get("cursordance-debug");
    if (parseBooleanFlag(queryFlag)) return true;
  } catch {
    // Ignore invalid URL reads.
  }
  try {
    return parseBooleanFlag(window.localStorage?.getItem(DIAGNOSTICS_STORAGE_KEY) || "");
  } catch {
    return false;
  }
}

function formatScopeLabel(scope) {
  const prefix = scope.split(".")[0];
  if (SCOPE_PREFIX_LABELS[prefix]) return SCOPE_PREFIX_LABELS[prefix];
  if (SCOPE_PREFIX_LABELS[scope]) return SCOPE_PREFIX_LABELS[scope];
  return scope;
}

function formatEntryTime(value) {
  if (!value) return "未知时间";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知时间";
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function toEntryExcerpt(entry) {
  if (entry.reason) return entry.reason;
  if (entry.actionId) return `动作：${entry.actionId}`;
  if (entry.host) return `站点：${entry.host}`;
  if (entry.triggerZone) return `触发区域：${entry.triggerZone}`;
  if (entry.mode) return `模式：${entry.mode}`;
  return "已记录一条运行时事件。";
}

function toEntryDetails(entry) {
  const detail = {
    actionId: entry.actionId,
    trigger: entry.trigger,
    reason: entry.reason,
    host: entry.host,
    activeThemeId: entry.activeThemeId,
    localPreviewHost: entry.localPreviewHost,
    triggerZone: entry.triggerZone,
    target: entry.target,
    mode: entry.mode,
    blendMode: entry.soundBlendMode,
    volume: entry.volume,
  };
  return Object.fromEntries(Object.entries(detail).filter(([, value]) => value != null && value !== ""));
}

function getScopeFilterPrefix(filterKey) {
  if (filterKey === "all") return null;
  return `${filterKey}.`;
}

export function DiagnosticsPanel({ selectedThemeId }) {
  const [debugEnabled, setDebugEnabled] = useState(readDebugEnabled);
  const [livePreviewConfig, setLivePreviewConfig] = useState(null);
  const [diagnosticEntries, setDiagnosticEntries] = useState([]);
  const [runtimeErrors, setRuntimeErrors] = useState([]);
  const [paused, setPaused] = useState(false);
  const [scopeFilter, setScopeFilter] = useState("all");
  const pendingWhilePaused = useRef(0);
  const pausedRef = useRef(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) pendingWhilePaused.current = 0;
  }, [paused]);

  // Hydrate debug flag from chrome.storage.
  useEffect(() => {
    let cancelled = false;
    readDiagnosticDebugFlag().then((enabled) => {
      if (!cancelled) setDebugEnabled(enabled);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Hydrate diagnostic events from storage + subscribe to new events.
  useEffect(() => {
    let cancelled = false;

    if (!hydratedRef.current) {
      hydratedRef.current = true;
      readRuntimeDiagnostics().then((entries) => {
        if (!cancelled && Array.isArray(entries) && entries.length > 0) {
          setDiagnosticEntries(entries);
        }
      }).catch(() => {});
    }

    void readLivePreviewConfig().then((config) => {
      if (!cancelled) setLivePreviewConfig(config);
    });

    const unsubscribePreview = subscribeLivePreviewConfig((config) => {
      if (!cancelled) setLivePreviewConfig(config);
    });

    const unsubscribeDiagnostics = subscribeRuntimeDiagnostics((entry) => {
      if (cancelled) return;
      if (pausedRef.current) {
        pendingWhilePaused.current += 1;
        return;
      }
      setDiagnosticEntries((current) => appendDiagnosticEntry(current, entry));
    });

    return () => {
      cancelled = true;
      unsubscribePreview();
      unsubscribeDiagnostics();
    };
  }, []);

  // Load runtime errors on mount.
  useEffect(() => {
    let cancelled = false;
    void readRuntimeErrors().then((errors) => {
      if (!cancelled) setRuntimeErrors(errors);
    });
    return () => { cancelled = true; };
  }, []);

  const livePreviewSummary = useMemo(
    () => summarizeLivePreviewConfig(livePreviewConfig, selectedThemeId),
    [livePreviewConfig, selectedThemeId]
  );

  const scopePrefix = getScopeFilterPrefix(scopeFilter);
  const filteredEntries = useMemo(() => {
    if (!scopePrefix) return diagnosticEntries;
    return diagnosticEntries.filter((entry) => entry.scope?.startsWith(scopePrefix));
  }, [diagnosticEntries, scopePrefix]);

  const scopeCounts = useMemo(() => {
    const counts = { all: diagnosticEntries.length };
    diagnosticEntries.forEach((entry) => {
      const scope = entry.scope || "";
      const prefix = scope.split(".")[0];
      if (prefix) counts[prefix] = (counts[prefix] || 0) + 1;
    });
    return counts;
  }, [diagnosticEntries]);

  function toggleDebug() {
    const nextEnabled = !debugEnabled;
    void writeDiagnosticDebugFlag(nextEnabled);
    setDebugEnabled(nextEnabled);
  }

  function handleClearRuntimeErrors() {
    void clearRuntimeErrors().then(() => setRuntimeErrors([]));
  }

  function handleResume() {
    setPaused(false);
    pendingWhilePaused.current = 0;
  }

  return (
    <div className="space-y-4">
      {/* Runtime Errors */}
      {runtimeErrors.length > 0 ? (
        <Panel
          title="运行时错误"
          icon={AlertTriangle}
          iconTone="bg-red-100 text-red-700"
          action={
            <Button variant="ghost" className="rounded-2xl px-3 text-xs" onClick={handleClearRuntimeErrors}>
              <Trash2 className="mr-2 h-4 w-4" />
              清除全部
            </Button>
          }
        >
          <div className="space-y-2">
            {runtimeErrors.map((error, index) => (
              <div key={`error-${error.at}-${index}`} className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <DataPill tone="red">{error.type}</DataPill>
                  <DataPill tone="slate">{formatEntryTime(error.at)}</DataPill>
                  <span className="text-xs text-slate-500">{error.host}</span>
                </div>
                <div className="mt-2 text-sm text-red-800">{error.detail}</div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel
        title="调试开关"
        icon={Bug}
        iconTone="bg-amber-100 text-amber-700"
        action={
          <Button variant={debugEnabled ? "outline" : "default"} className="rounded-2xl px-4" onClick={toggleDebug}>
            {debugEnabled ? "关闭诊断" : "开启诊断"}
          </Button>
        }
      >
        <div className="space-y-3 text-sm leading-6 text-slate-600">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-slate-400" />
            <span>Live Preview：</span>
            <DataPill tone={livePreviewSummary.status === "inactive" ? "slate" : "teal"}>
              {livePreviewSummary.status === "inactive" ? "无" : livePreviewSummary.label}
            </DataPill>
          </div>
          <p>控制 runtime diagnostics 通道。开启后通过 chrome.storage 同步到各个 content script，action 解析、trigger-zone 过滤和音频 ducking 事件会广播到这个面板。</p>
          <p>在目标页面也可以手动开启：URL 上带 <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">?cursordance-debug=1</code> 或执行 <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">localStorage.setItem('cursordance.debug', '1')</code>。</p>
          <p className="text-slate-500">开启后，去目标页面点一次、滚一次或触发音频，再回来看事件流会最直观。</p>
        </div>
      </Panel>

      <Panel
        title="运行时事件流"
        icon={RadioTower}
        iconTone="bg-emerald-100 text-emerald-700"
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {SCOPE_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    scopeFilter === filter.key
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  onClick={() => setScopeFilter(filter.key)}
                >
                  {filter.label}
                  {scopeCounts[filter.key] != null && filter.key !== "all" ? ` ${scopeCounts[filter.key]}` : ""}
                </button>
              ))}
            </div>
            <DataPill>{filteredEntries.length}/{diagnosticEntries.length} 条</DataPill>
            <Button
              variant="ghost"
              className="rounded-2xl px-3 text-xs"
              onClick={() => {
                if (paused) {
                  handleResume();
                } else {
                  setPaused(true);
                }
              }}
            >
              {paused ? (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  恢复{pendingWhilePaused.current > 0 ? ` (${pendingWhilePaused.current})` : ""}
                </>
              ) : (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  暂停
                </>
              )}
            </Button>
            <Button variant="ghost" className="rounded-2xl px-3 text-xs" onClick={() => { setDiagnosticEntries([]); pendingWhilePaused.current = 0; }}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              清空列表
            </Button>
          </div>
        }
      >
        {paused && pendingWhilePaused.current > 0 ? (
          <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            暂停期间收到 {pendingWhilePaused.current} 条新事件。点击"恢复"以查看。
          </div>
        ) : null}
        {filteredEntries.length ? (
          <div className="space-y-3">
            {filteredEntries.slice().reverse().map((entry, index) => {
              const details = toEntryDetails(entry);
              return (
                <article key={`${entry.scope}-${entry.at}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs font-medium text-slate-600">{formatScopeLabel(entry.scope)}</div>
                    <DataPill>{formatEntryTime(entry.at)}</DataPill>
                    {entry.actionId ? <DataPill tone="teal">{entry.actionId}</DataPill> : null}
                  </div>
                  <div className="mt-2 text-sm text-slate-600">{toEntryExcerpt(entry)}</div>
                  {Object.keys(details).length ? (
                    <pre className="mt-3 overflow-x-auto rounded-2xl bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                      {JSON.stringify(details, null, 2)}
                    </pre>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
            <div className="mx-auto inline-flex size-10 items-center justify-center rounded-full bg-white text-slate-400">
              <RadioTower className="size-5" aria-hidden />
            </div>
            <div className="mt-3 text-xs font-medium text-slate-600">暂无诊断事件</div>
            <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-slate-500">
              {scopeFilter !== "all"
                ? "当前过滤条件下还没有事件。试试切换为「全部」查看。"
                : isDesktop()
                  ? "开启诊断后，在桌面任意位置点击、长按或滚轮，事件流会开始滚动展示触发链路。"
                  : "还没有收到 runtime diagnostics 事件。开启诊断后，在目标页面触发一次点击、悬停、滚轮或音频播放，这里就会开始滚动显示原因链路。"}
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}
