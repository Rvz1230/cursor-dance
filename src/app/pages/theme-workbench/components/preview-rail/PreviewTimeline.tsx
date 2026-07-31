import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  buildMinorTicks,
  buildTickMarks,
  buildTimelineResetPatch,
  formatTickMs,
  isTimelineTrackDirty,
  type TimelineTrack,
} from "../../lib/timelineModel";
import { TimelineTrackRow } from "./TimelineTrackRow";

interface PreviewTimelineProps {
  tracks: TimelineTrack[];
  totalMs: number;
  disabled: boolean;
  canEditEmptyState: boolean;
  updateActionConfig(patch: Record<string, unknown>): void;
  runId: number;
}
export function PreviewTimeline({
  tracks,
  totalMs,
  disabled,
  canEditEmptyState,
  updateActionConfig,
  runId,
}: PreviewTimelineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [playheadKey, setPlayheadKey] = useState(0);
  const [isPlayheadRunning, setIsPlayheadRunning] = useState(false);
  const tickMarks = useMemo(() => buildTickMarks(totalMs), [totalMs]);
  const minorTicks = useMemo(() => buildMinorTicks(totalMs), [totalMs]);
  const pxPerMs = containerWidth > 0 ? containerWidth / totalMs : 0;

  useEffect(() => {
    setPlayheadKey((value) => value + 1);
    setIsPlayheadRunning(false);
    const frame = requestAnimationFrame(() => setIsPlayheadRunning(true));
    return () => cancelAnimationFrame(frame);
  }, [runId]);

  const hasAnyDirty = tracks.some(isTimelineTrackDirty);
  const resetAll = useCallback(() => {
    const patch = buildTimelineResetPatch(tracks);
    if (Object.keys(patch).length) updateActionConfig(patch);
  }, [tracks, updateActionConfig]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm select-none">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">时间轴编排</span>
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-2xs tabular-nums text-slate-400">总长 {formatTickMs(totalMs)}</span>
          <span className="hidden rounded-md bg-slate-50 px-1.5 py-0.5 text-2xs font-medium text-slate-400 sm:inline">Snap 20ms</span>
        </div>
        <div className="flex items-center gap-1.5">
          {hasAnyDirty ? (
            <button
              type="button"
              className="rounded-md px-2 py-0.5 text-2xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              onClick={resetAll}
            >
              重置全部
            </button>
          ) : null}
          <span className="hidden text-2xs text-slate-400 sm:inline">拖拽边缘调整时长 · 拖拽中部调整延迟</span>
        </div>
      </div>

      <div className="relative mx-4 mt-2.5 h-6">
        {minorTicks.map((tick) => (
          <div
            key={`ruler-minor-${tick}`}
            className="absolute bottom-0 h-2 w-px bg-slate-300/60"
            style={{ left: `${(tick / totalMs) * 100}%`, transform: "translateX(-50%)" }}
          />
        ))}
        {tickMarks.map((tick) => (
          <div
            key={`ruler-${tick}`}
            className="absolute bottom-0 flex flex-col items-center"
            style={{
              left: `${(tick / totalMs) * 100}%`,
              transform: tick === 0
                ? "translateX(0)"
                : tick === totalMs ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            <div className="h-3.5 w-px bg-slate-400" />
            <span className="mt-0.5 text-2xs leading-none tabular-nums text-slate-500">
              {formatTickMs(tick)}
            </span>
          </div>
        ))}
      </div>

      <div ref={containerRef} className="relative space-y-1 px-3 pb-3 pt-2">
        {tracks.length ? (
          <div
            key={playheadKey}
            className="pointer-events-none absolute bottom-3 top-2 z-20 w-px bg-slate-900/70 motion-reduce:hidden"
            style={{
              left: "12px",
              transform: `translateX(${isPlayheadRunning ? containerWidth : 0}px)`,
              transition: isPlayheadRunning ? `transform ${totalMs}ms linear` : "none",
            }}
            aria-hidden="true"
          >
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-md bg-slate-900 px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-white shadow-sm">
              {formatTickMs(totalMs)}
            </span>
          </div>
        ) : null}
        {tracks.length ? tracks.map((track, index) => (
          <TimelineTrackRow
            key={track.id}
            track={track}
            totalMs={totalMs}
            pxPerMs={pxPerMs}
            updateActionConfig={updateActionConfig}
            isEven={index % 2 === 0}
            disabled={disabled}
          />
        )) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-center">
            <div className="text-balance text-xs font-medium text-slate-700">当前动作还没有可播放的视觉效果</div>
            <div className="mt-1 text-pretty text-2xs text-slate-500">先在左侧开启一个基础反馈，再回到时间轴微调节奏。</div>
            {canEditEmptyState ? (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                <Button variant="outline" size="sm" className="h-7 rounded-lg px-2.5 text-2xs font-semibold" disabled={disabled} onClick={() => updateActionConfig({ ripple: true })}>
                  开启波纹
                </Button>
                <Button variant="outline" size="sm" className="h-7 rounded-lg px-2.5 text-2xs font-semibold" disabled={disabled} onClick={() => updateActionConfig({ particle: true })}>
                  开启粒子
                </Button>
                <Button variant="outline" size="sm" className="h-7 rounded-lg px-2.5 text-2xs font-semibold" disabled={disabled} onClick={() => updateActionConfig({ textEnabled: true })}>
                  开启飘字
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
