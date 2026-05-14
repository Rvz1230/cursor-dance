import { useEffect, useMemo, useState } from "react";
import { ActivitySquare, Bug, Eye, RadioTower, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { DataPill, Panel } from "./WorkbenchControls.jsx";
import {
  readLivePreviewConfig,
  subscribeLivePreviewConfig,
  subscribeRuntimeDiagnostics,
} from "../lib/extensionConfig.js";
import { appendDiagnosticEntry, summarizeLivePreviewConfig } from "../lib/diagnosticsSurface.js";
import { formatActionLabel } from "../model/workbenchSchema.js";

const DIAGNOSTICS_STORAGE_KEY = "cursordance.debug";

function readDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    const queryFlag = new URL(window.location.href).searchParams.get("cursordance-debug");
    if (queryFlag && ["1", "true", "on", "yes", "debug"].includes(queryFlag.toLowerCase())) {
      return true;
    }
  } catch {
    // Ignore invalid URL reads.
  }

  try {
    const raw = window.localStorage?.getItem(DIAGNOSTICS_STORAGE_KEY) || "";
    return ["1", "true", "on", "yes", "debug"].includes(raw.trim().toLowerCase());
  } catch {
    return false;
  }
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

  useEffect(() => {
    let cancelled = false;

    void readLivePreviewConfig().then((config) => {
      if (!cancelled) {
        setLivePreviewConfig(config);
      }
    });

    const unsubscribePreview = subscribeLivePreviewConfig((config) => {
      if (!cancelled) {
        setLivePreviewConfig(config);
      }
    });

    const unsubscribeDiagnostics = subscribeRuntimeDiagnostics((entry) => {
      if (!cancelled) {
        setDiagnosticEntries((current) => appendDiagnosticEntry(current, entry));
      }
    });

    return () => {
      cancelled = true;
      unsubscribePreview();
      unsubscribeDiagnostics();
    };
  }, []);

  const livePreviewSummary = useMemo(
    () => summarizeLivePreviewConfig(livePreviewConfig, selectedThemeId),
    [livePreviewConfig, selectedThemeId]
  );

  function toggleDebug() {
    const nextEnabled = !debugEnabled;
    try {
      if (nextEnabled) {
        window.localStorage?.setItem(DIAGNOSTICS_STORAGE_KEY, "1");
      } else {
        window.localStorage?.removeItem(DIAGNOSTICS_STORAGE_KEY);
      }
    } catch {
      // Ignore storage write failures and still reflect local UI intent.
    }
    setDebugEnabled(nextEnabled);
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
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">当前主题</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{themeName}</div>
            <div className="mt-2 text-sm text-slate-600">当前动作：{formatActionLabel(actionId)}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">当前工作区</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{workspaceLabel}</div>
            <div className="mt-2 text-sm text-slate-600">未保存状态：{unsaved ? "有改动" : "已同步"}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">当前站点</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{site.host}</div>
            <div className="mt-2 text-sm text-slate-600">{site.isSupportedPage ? "可写入规则页面" : "当前页只读或不可注入"}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">全局开关</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{enabled ? "已启用" : "已关闭"}</div>
            <div className="mt-2 text-sm text-slate-600">用于区分是配置问题还是总开关未打开。</div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          title="Live Preview 状态"
          icon={Eye}
          iconTone="bg-sky-100 text-sky-700"
          action={<DataPill tone={livePreviewSummary.status === "inactive" ? "slate" : "teal"}>{livePreviewSummary.status}</DataPill>}
        >
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
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
            <p>这里控制的是 runtime diagnostics 通道。开启后，content runtime 会把 action 解析、trigger-zone 过滤和音频 ducking 事件广播到这个面板。</p>
            <p>如果你更习惯手动调试，也可以直接执行 `localStorage.setItem('cursordance.debug', '1')`，或者在目标页 URL 上带 `?cursordance-debug=1`。</p>
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
            <DataPill>{diagnosticEntries.length} 条</DataPill>
            <Button variant="ghost" className="rounded-2xl px-3 text-xs" onClick={() => setDiagnosticEntries([])}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              清空列表
            </Button>
          </div>
        }
      >
        {diagnosticEntries.length ? (
          <div className="space-y-3">
            {diagnosticEntries.slice().reverse().map((entry, index) => {
              const details = toEntryDetails(entry);
              return (
                <article key={`${entry.scope}-${entry.at}-${index}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900">{entry.scope}</div>
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
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-600">
            还没有收到 runtime diagnostics 事件。开启诊断后，在目标页面触发一次点击、悬停、滚轮或音频播放，这里就会开始滚动显示原因链路。
          </div>
        )}
      </Panel>
    </div>
  );
}
