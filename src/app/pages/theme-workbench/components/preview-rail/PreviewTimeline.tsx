import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, Copy, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
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
  currentTimeMs: number;
  onSeek(value: number): void;
}

export function PreviewTimeline({ tracks, totalMs, disabled, canEditEmptyState, updateActionConfig, currentTimeMs, onSeek }: PreviewTimelineProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [collapsed, setCollapsed] = useState(true);
  const [drawerHeight, setDrawerHeight] = useState(190);
  const [snapMs, setSnapMs] = useState(20);
  const [zoom, setZoom] = useState(1);
  const tickMarks = useMemo(() => buildTickMarks(totalMs), [totalMs]);
  const minorTicks = useMemo(() => buildMinorTicks(totalMs), [totalMs]);
  const pxPerMs = trackWidth > 0 ? trackWidth / totalMs : 0;
  const hasAnyDirty = tracks.some(isTimelineTrackDirty);
  const linkedTrackCount = tracks.filter((track) => track.start > 0).length;

  const resetAll = useCallback(() => {
    const patch = buildTimelineResetPatch(tracks);
    if (Object.keys(patch).length) updateActionConfig(patch);
  }, [tracks, updateActionConfig]);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setTrackWidth(Math.max(0, entry.contentRect.width - 142.5)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [zoom, collapsed]);

  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = drawerHeight;
    const move = (next: PointerEvent) => setDrawerHeight(Math.max(130, Math.min(320, startHeight + startY - next.clientY)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function seekFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    onSeek(((event.clientX - rect.left) / rect.width) * totalMs);
  }

  return (
    <section id="preview-timeline" className="shrink-0 border-t border-slate-200 bg-white shadow-[0_-2px_10px_rgba(15,23,42,0.04)] select-none">
      <div onPointerDown={startResize} className="group flex h-2.5 cursor-row-resize items-center justify-center" title="拖动调整时间轴高度">
        <span className="h-0.5 w-10 rounded-full bg-slate-200 transition-colors group-hover:bg-slate-400" />
      </div>
      <div className="preview-timeline-header flex flex-wrap items-center justify-between gap-2 px-3 pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={() => setCollapsed((value) => !value)} className="grid size-5 place-items-center rounded text-slate-500 hover:bg-slate-100" aria-label={collapsed ? "展开时间轴" : "折叠时间轴"} aria-expanded={!collapsed}>
            <ChevronDown className={cn("size-3.5 transition-transform", collapsed && "-rotate-90")} />
          </button>
          <span className="text-xs font-medium text-slate-700">时间轴</span>
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium tabular-nums text-slate-500">总长 {totalMs}ms</span>
          <span className="truncate text-xs text-slate-500">
            {tracks.length ? `${tracks.length} 条轨道 · ${linkedTrackCount} 条已链接 · 播放头 ${Math.round(currentTimeMs)}ms` : "暂无轨道"}
          </span>
        </div>
        <div className="preview-timeline-controls flex flex-wrap items-center gap-1.5">
          <div className="flex items-center rounded-xl bg-slate-100 p-0.5" role="radiogroup" aria-label="标尺吸附">
            {[20, 10, 0].map((value) => <button key={value} type="button" role="radio" aria-checked={snapMs === value} onClick={() => setSnapMs(value)} className={cn("h-6 rounded-lg px-2 text-2xs font-medium", snapMs === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>{value || "关"}</button>)}
          </div>
          <div className="flex items-center rounded-xl bg-slate-100 p-0.5" role="radiogroup" aria-label="时间轴缩放">
            {[1, 2, 4].map((value) => <button key={value} type="button" role="radio" aria-checked={zoom === value} onClick={() => setZoom(value)} className={cn("grid h-6 min-w-7 place-items-center rounded-lg px-2 text-2xs font-medium", zoom === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>{value === 1 ? <Maximize2 className="size-3" /> : `${value}×`}</button>)}
          </div>
          {hasAnyDirty ? <button type="button" onClick={resetAll} className="h-7 rounded-lg px-2 text-2xs font-medium text-slate-500 hover:bg-slate-100">重置全部</button> : null}
          <button type="button" onClick={() => navigator.clipboard?.writeText(JSON.stringify(tracks.map(({ id, start, end }) => ({ id, start, end }))))} className="grid size-7 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="复制节奏" title="复制节奏"><Copy className="size-3.5" /></button>
        </div>
      </div>

      {!collapsed ? (
        <div className="min-h-0 overflow-x-auto border-t border-slate-100 px-3 py-2" style={{ height: drawerHeight }}>
          <div ref={contentRef} className="min-w-[470px]" style={{ width: zoom === 1 ? "100%" : `${zoom * 100}%` }}>
            <div className="grid grid-cols-[132px_minmax(320px,1fr)] gap-2.5 px-1">
              <div />
              <div className="relative h-7 cursor-col-resize" role="slider" tabIndex={0} aria-label="播放头" aria-valuemin={0} aria-valuemax={totalMs} aria-valuenow={Math.round(currentTimeMs)} onPointerDown={seekFromPointer} onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  onSeek(currentTimeMs + (event.key === "ArrowRight" ? 20 : -20));
                }
              }}>
                {minorTicks.map((tick) => <span key={`minor-${tick}`} className="absolute bottom-0 h-2 w-px bg-slate-300/60" style={{ left: `${tick / totalMs * 100}%` }} />)}
                {tickMarks.map((tick) => <span key={tick} className="absolute bottom-0 -translate-x-1/2 text-2xs tabular-nums text-slate-500" style={{ left: `${tick / totalMs * 100}%` }}><i className="mx-auto mb-0.5 block h-2.5 w-px bg-slate-400" />{formatTickMs(tick)}</span>)}
                <span className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-slate-900" style={{ left: `${currentTimeMs / totalMs * 100}%` }}><i className="absolute -top-0.5 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-slate-900" /></span>
              </div>
            </div>
            <div className="relative mt-1 space-y-1">
              {tracks.length ? tracks.map((track, index) => <TimelineTrackRow key={track.id} track={track} totalMs={totalMs} pxPerMs={pxPerMs} updateActionConfig={updateActionConfig} isEven={index % 2 === 0} disabled={disabled} snapMs={snapMs} />) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-3 text-center">
                  <div className="text-xs font-medium text-slate-700">当前动作还没有可播放的视觉效果</div>
                  {canEditEmptyState ? <div className="mt-2 flex justify-center gap-1.5"><Button variant="outline" size="sm" className="h-7 text-2xs" onClick={() => updateActionConfig({ ripple: true })}>开启波纹</Button><Button variant="outline" size="sm" className="h-7 text-2xs" onClick={() => updateActionConfig({ particle: true })}>开启粒子</Button><Button variant="outline" size="sm" className="h-7 text-2xs" onClick={() => updateActionConfig({ textEnabled: true })}>开启飘字</Button></div> : null}
                </div>
              )}
            </div>
            <p className="mt-2 text-2xs text-slate-400">拖色块中部改偏移 · 拖两端改时长 · 方向键精确移动</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
