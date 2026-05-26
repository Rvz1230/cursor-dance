import { useEffect, useMemo, useRef, useState } from "react";
import { ActivitySquare, AlertTriangle, Bug, Eye, Pause, Play, RadioTower, RefreshCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { DataPill, Panel } from "./WorkbenchControls.jsx";
import {
  clearRuntimeErrors,
  readDiagnosticDebugFlag,
  readLivePreviewConfig,
  readRuntimeErrors,
  subscribeLivePreviewConfig,
  subscribeRuntimeDiagnostics,
  writeDiagnosticDebugFlag,
} from "../lib/extensionConfig.js";
import { appendDiagnosticEntry, summarizeLivePreviewConfig } from "../lib/diagnosticsSurface.js";
import { formatActionLabel } from "../model/workbenchSchema.js";

const DIAGNOSTICS_STORAGE_KEY = "cursordance.debug";

const SCOPE_LABELS = {
  "runtime.ready": "运行时就绪",
  "action.skip": "动作跳过",
  "action.resolve": "动作解析",
  "action.fire": "动作触发",
  "action.schedule": "动作调度",
  "action.arm": "动作就绪",
  "audio.duck.reassert-scheduled": "音频闪避重确认-已调度",
  "audio.duck.reasserted": "音频闪避-重确认",
  "audio.duck.restore-scheduled": "音频恢复-已调度",
  "audio.duck.restored": "音频恢复",
  "audio.duck.skip": "音频闪避-跳过",
  "audio.duck.profile": "音频闪避配置",
  "audio.duck.scan": "音频闪避扫描",
  "audio.duck.target-skip": "音频闪避-跳过目标",
  "audio.duck.target": "音频闪避目标",
  "audio.skip": "音频跳过",
  "audio.decision": "音频决策",
  "audio.play": "音频播放",
  "trigger-zone.check": "触发区域检查",
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
  if (SCOPE_LABELS[scope]) return SCOPE_LABELS[scope];
  const dotIndex = scope.indexOf(".");
  if (dotIndex !== -1) {
    const prefix = scope.slice(0, dotIndex);
    if (SCOPE_LABELS[prefix]) return SCOPE_LABELS[prefix];
  }
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
  if (entry.actionId) return `动作：${formatActionLabel(entry.actionId)}`;
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
    activeSchemeId: entry.activeSchemeId,
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
  if (filterKey === "audio") return "audio.";
  if (filterKey === "action") return "action.";
  if (filterKey === "trigger-zone") return "trigger-zone.";
  if (filterKey === "runtime") return "runtime.";
  return filterKey;
}

export function DiagnosticsPanel({
  workspaceLabel,
  themeName,
  selectedThemeId,
  actionId,
  site,
  enabled,
  unsaved,
}) {
  const [debugEnabled, setDebugEnabled] = useState(readDebugEnabled);
  const [livePreviewConfig, setLivePreviewConfig] = useState(null);
  const [diagnosticEntries, setDiagnosticEntries] = useState([]);
  const [runtimeErrors, setRuntimeErrors] = useState([]);
  const [paused, setPaused] = useState(false);
  const [scopeFilter, setScopeFilter] = useState("all");
  const pendingWhilePaused = useRef(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) pendingWhilePaused.current = 0;
  }, [paused]);

  // Hydrate debug flag from chrome.storage (shared with content script).
  useEffect(() => {
    let cancelled = false;
    readDiagnosticDebugFlag().then((enabled) => {
      if (!cancelled) setDebugEnabled(enabled);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

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
    readRuntimeErrors().then((errors) => {
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
    writeDiagnosticDebugFlag(nextEnabled);
    setDebugEnabled(nextEnabled);
  }

  function handleClearRuntimeErrors() {
    clearRuntimeErrors().then(() => setRuntimeErrors([]));
  }

  function handleResume() {
    setPaused(false);
    pendingWhilePaused.current = 0;
  }

  return (
    <div className="space-y-4">
      <Panel
        title="诊断总览"
        icon={ActivitySquare}
        iconTone="bg-rose-100 text-rose-700"
        action={<DataPill tone={debugEnabled ? "teal" : "amber"}>{debugEnabled ? "诊断已开启" : "诊断默认关闭"}</DataPill>}
      >
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">当前主题</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{themeName}</div>
            <div className="mt-2 text-sm text-slate-600">当前动作：{formatActionLabel(actionId)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">当前工作区</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{workspaceLabel}</div>
            <div className="mt-2 text-sm text-slate-600">未保存状态：{unsaved ? "有改动" : "已同步"}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">当前站点</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{site.host}</div>
            <div className="mt-2 text-sm text-slate-600">{site.isSupportedPage ? "可写入规则页面" : "当前页只读或不可注入"}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">全局开关</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{enabled ? "已启用" : "已关闭"}</div>
            <div className="mt-2 text-sm text-slate-600">用于区分是配置问题还是总开关未打开。</div>
          </div>
        </div>
      </Panel>

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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          title="Live Preview 状态"
          icon={Eye}
          iconTone="bg-sky-100 text-sky-700"
          action={<DataPill tone={livePreviewSummary.status === "inactive" ? "slate" : "teal"}>{livePreviewSummary.status}</DataPill>}
        >
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">{livePreviewSummary.label}</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              {livePreviewSummary.activeThemeId
                ? `activeThemePackId：${livePreviewSummary.activeThemeId}，覆盖内包含 ${livePreviewSummary.themeCount} 个主题包。`
                : "如果这里一直没有变化，通常说明当前 workbench 还没有产生未保存草稿，或者预览覆盖已被清理。"}
            </div>
          </div>
        </Panel>

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
            <p>这里控制的是 runtime diagnostics 通道。开启后通过 chrome.storage 同步到各个 content script，action 解析、trigger-zone 过滤和音频 ducking 事件会广播到这个面板。</p>
            <p>在目标页面也可以手动开启：URL 上带 <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">?cursordance-debug=1</code> 或执行 <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">localStorage.setItem('cursordance.debug', '1')</code>。</p>
            <p className="text-slate-500">开启后，去目标页面点一次、滚一次或触发音频，再回来看事件流会最直观。</p>
          </div>
        </Panel>
      </div>

      <Panel
        title="运行时事件流"
        icon={RadioTower}
        iconTone="bg-emerald-100 text-emerald-700"
        action={
          <div className="flex items-center gap-2">
            {/* Scope filter chips */}
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
                    <div className="text-sm font-semibold text-slate-900">{formatScopeLabel(entry.scope)}</div>
                    <DataPill>{formatEntryTime(entry.at)}</DataPill>
                    {entry.actionId ? <DataPill tone="teal">{formatActionLabel(entry.actionId)}</DataPill> : null}
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
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-600">
            {scopeFilter !== "all"
              ? '当前过滤条件下还没有事件。试试切换为「全部」查看。'
              : "还没有收到 runtime diagnostics 事件。开启诊断后，在目标页面触发一次点击、悬停、滚轮或音频播放，这里就会开始滚动显示原因链路。"}
          </div>
        )}
      </Panel>
    </div>
  );
}
