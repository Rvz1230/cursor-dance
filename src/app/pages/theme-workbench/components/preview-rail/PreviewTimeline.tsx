import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { useTimelineDrag } from "../../lib/useTimelineDrag";
import {
  DELAY_FIELD_BY_TRACK,
  DURATION_FIELD_BY_TRACK,
  TRACK_DEFAULTS,
  buildMinorTicks,
  buildTickMarks,
  buildTimelineKeyboardPatch,
  formatTickMs,
} from "../../lib/timelineModel";

function getTimelineTone(tone) {
  if (tone === "rose") return { bg: "bg-rose-200", text: "text-rose-600", dot: "bg-rose-500", border: "border-rose-300/60", gradient: "from-rose-200/90 to-rose-300/80" };
  if (tone === "teal") return { bg: "bg-teal-200", text: "text-teal-600", dot: "bg-teal-500", border: "border-teal-300/60", gradient: "from-teal-200/90 to-teal-300/80" };
  if (tone === "amber") return { bg: "bg-amber-200", text: "text-amber-600", dot: "bg-amber-500", border: "border-amber-300/60", gradient: "from-amber-200/90 to-amber-300/80" };
  if (tone === "sky") return { bg: "bg-sky-200", text: "text-sky-600", dot: "bg-sky-500", border: "border-sky-300/60", gradient: "from-sky-200/90 to-sky-300/80" };
  if (tone === "violet") return { bg: "bg-violet-200", text: "text-violet-600", dot: "bg-violet-500", border: "border-violet-300/60", gradient: "from-violet-200/90 to-violet-300/80" };
  return { bg: "bg-slate-200", text: "text-slate-600", dot: "bg-slate-500", border: "border-slate-300/60", gradient: "from-slate-200/90 to-slate-300/80" };
}
function TrackHandle({ side, track, totalMs, pxPerMs, editableDuration, updateActionConfig, onGhostChange }) {
  const isLeft = side === "left";
  const delayField = DELAY_FIELD_BY_TRACK[track.id];
  const durationField = DURATION_FIELD_BY_TRACK[track.id];
  const minEditableDuration = editableDuration <= 0 ? 0 : 40;

  const commitRef = useRef(null);
  commitRef.current = useCallback(
    (deltaMs) => {
      if (isLeft && delayField) {
        const newDelay = Math.max(0, track.start + deltaMs);
        const patch = { [delayField]: newDelay };
        if (durationField) {
          patch[durationField] = Math.max(minEditableDuration, editableDuration - deltaMs);
        }
        updateActionConfig(patch);
      } else if (!isLeft && durationField) {
        updateActionConfig({ [durationField]: Math.max(minEditableDuration, editableDuration + deltaMs) });
      }
    },
    [editableDuration, isLeft, delayField, durationField, minEditableDuration, track.start, updateActionConfig]
  );

  const onGhostChangeRef = useRef(null);
  onGhostChangeRef.current = onGhostChange;

  const { isDragging, tooltipMs, handlers } = useTimelineDrag({
    mode: isLeft ? "resize-left" : "resize-right",
    pxPerMs,
    snapMs: 20,
    minMs: isLeft ? -track.start : -(editableDuration - minEditableDuration),
    maxMs: isLeft ? editableDuration - minEditableDuration : Infinity,
    onChange: (deltaMs) => onGhostChangeRef.current?.(deltaMs),
    onCommit: (deltaMs) => commitRef.current?.(deltaMs),
  });

  const posPct = `${(isLeft ? track.start : track.start + editableDuration) / totalMs * 100}%`;

  return (
    <>
      <div
        className={cn(
          "absolute top-0 z-10 h-full w-[9px] -translate-x-1/2 cursor-col-resize rounded-sm transition-[background-color,box-shadow] duration-150",
          isDragging
            ? "bg-slate-400/50 shadow-[0_0_6px_rgba(100,116,139,0.3)]"
            : "bg-slate-300/20 hover:bg-slate-300/50"
        )}
        style={{ left: posPct }}
        {...handlers}
      >
        <div className={cn(
          "absolute inset-y-2 left-1/2 flex -translate-x-1/2 flex-col justify-center gap-[2px] transition-opacity duration-150",
          isDragging ? "opacity-100" : "opacity-30 group-hover:opacity-80"
        )}>
          <span className="block h-[2px] w-[3px] rounded-full bg-slate-500" />
          <span className="block h-[2px] w-[3px] rounded-full bg-slate-500" />
          <span className="block h-[2px] w-[3px] rounded-full bg-slate-500" />
        </div>
      </div>
      {isDragging && tooltipMs !== null ? (
        <div
          className="absolute -top-8 z-30 -translate-x-1/2 rounded-lg bg-slate-900 px-2 py-0.5 text-2xs font-semibold tabular-nums text-white shadow-lg pointer-events-none whitespace-nowrap"
          style={{ left: posPct }}
        >
          {isLeft
            ? `${Math.max(0, track.start + tooltipMs)}ms`
            : `${track.start + editableDuration + tooltipMs}ms`}
        </div>
      ) : null}
    </>
  );
}

function TimelineTrackRow({ track, totalMs, pxPerMs, updateActionConfig, isEven, disabled }) {
  const [ghost, setGhost] = useState(null);
  const visualDuration = track.end - track.start;
  const editableDuration = track.configuredDuration ?? visualDuration;
  const tailDuration = Math.max(0, visualDuration - editableDuration);
  const ghostDelta = ghost?.deltaMs ?? 0;
  const ghostStart = ghost?.mode === "move" || ghost?.mode === "resize-left"
    ? Math.max(0, track.start + ghostDelta)
    : track.start;
  const ghostEditableDuration = ghost?.mode === "resize-left"
    ? Math.max(editableDuration <= 0 ? 0 : 40, editableDuration - ghostDelta)
    : ghost?.mode === "resize-right"
      ? Math.max(editableDuration <= 0 ? 0 : 40, editableDuration + ghostDelta)
      : editableDuration;
  const ghostEnd = ghost?.mode === "move" ? track.end + ghostDelta : ghostStart + ghostEditableDuration + tailDuration;
  const leftPct = `${(ghostStart / totalMs) * 100}%`;
  const widthPct = `${Math.max(0.5, ((ghostEnd - ghostStart) / totalMs) * 100)}%`;
  const tone = getTimelineTone(track.tone);
  const delayField = DELAY_FIELD_BY_TRACK[track.id];
  const minorTicks = useMemo(() => buildMinorTicks(totalMs), [totalMs]);

  const commitRef = useRef(null);
  commitRef.current = useCallback(
    (deltaMs) => {
      if (disabled || !delayField) return;
      const newDelay = Math.max(0, track.start + deltaMs);
      updateActionConfig({ [delayField]: newDelay });
    },
    [delayField, disabled, track.start, updateActionConfig]
  );

  const { isDragging: isMoving, tooltipMs, handlers: moveHandlers } = useTimelineDrag({
    mode: "move",
    pxPerMs: disabled ? 0 : pxPerMs,
    snapMs: 20,
    minMs: -track.start,
    onChange: (deltaMs) => setGhost(deltaMs === null ? null : { mode: "move", deltaMs }),
    onCommit: (deltaMs) => commitRef.current?.(deltaMs),
  });

  const defaults = TRACK_DEFAULTS[track.id];
  const isDirty = defaults && (track.start !== defaults.delay || (defaults.duration && track.configuredDuration !== defaults.duration));
  const valueText = `${track.label} 延迟 ${ghostStart}ms${track.configuredDuration ? `，时长 ${Math.round(ghostEnd - ghostStart)}ms` : ""}`;

  const onKeyDown = useCallback(
    (event) => {
      if (disabled) return;
      const patch = buildTimelineKeyboardPatch({
        track,
        key: event.key,
        shiftKey: event.shiftKey,
        maxDelay: Math.max(0, totalMs - (ghostEnd - ghostStart)),
      });
      if (!patch) return;
      event.preventDefault();
      updateActionConfig(patch);
    },
    [disabled, ghostEnd, ghostStart, totalMs, track, updateActionConfig]
  );

  return (
    <div className={cn(
      "group relative grid grid-cols-[42px_minmax(0,1fr)] items-center gap-2.5 py-1 -mx-1 px-1 rounded-lg transition-colors duration-150",
      isMoving ? "bg-slate-100" : isEven ? "bg-slate-50/60 hover:bg-slate-100/80" : "bg-white hover:bg-slate-50"
    )}>
      <div className="flex items-center gap-1.5">
        <span className={cn("size-1.5 rounded-full shrink-0", tone.dot)} />
        <span className={cn("text-2xs font-semibold select-none truncate", tone.text)}>{track.label}</span>
        {isDirty ? (
          <button
            type="button"
            className="hidden group-hover:flex size-4 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-slate-700 transition-colors shrink-0"
            title="重置延迟和时长"
            aria-label={`重置${track.label}延迟和时长`}
            onClick={(e) => {
              if (disabled) return;
              e.stopPropagation();
              const patch = {};
              if (delayField && defaults) patch[delayField] = defaults.delay;
              if (DURATION_FIELD_BY_TRACK[track.id] && defaults?.duration) patch[DURATION_FIELD_BY_TRACK[track.id]] = defaults.duration;
              updateActionConfig(patch);
            }}
          >
            <X className="size-2.5" />
          </button>
        ) : null}
      </div>

      <div className={cn("relative h-7 rounded-lg border", isEven ? "bg-slate-100/50 border-slate-200/70" : "bg-slate-100/80 border-slate-200/60")}>
        {/* minor grid lines */}
        {minorTicks.map((tick) => (
          <div
            key={`grid-minor-${track.id}-${tick}`}
            className="absolute inset-y-0 w-px bg-slate-200/50 pointer-events-none"
            style={{ left: `${(tick / totalMs) * 100}%` }}
          />
        ))}
        {/* major grid lines */}
        {buildTickMarks(totalMs).map((tick) => (
          <div
            key={`grid-${track.id}-${tick}`}
            className="absolute inset-y-0 w-px bg-slate-300/70 pointer-events-none"
            style={{ left: `${(tick / totalMs) * 100}%` }}
          />
        ))}

        {/* left resize handle — only if track has a delay field */}
        {DELAY_FIELD_BY_TRACK[track.id] ? (
          <TrackHandle
            side="left"
            track={track}
            totalMs={totalMs}
            pxPerMs={disabled ? 0 : pxPerMs}
            editableDuration={editableDuration}
            updateActionConfig={updateActionConfig}
            onGhostChange={(deltaMs) => setGhost(deltaMs === null ? null : { mode: "resize-left", deltaMs })}
          />
        ) : null}

        {/* right resize handle — only if track has a duration field */}
        {DURATION_FIELD_BY_TRACK[track.id] ? (
          <TrackHandle
            side="right"
            track={track}
            totalMs={totalMs}
            pxPerMs={disabled ? 0 : pxPerMs}
            editableDuration={editableDuration}
            updateActionConfig={updateActionConfig}
            onGhostChange={(deltaMs) => setGhost(deltaMs === null ? null : { mode: "resize-right", deltaMs })}
          />
        ) : null}

        {/* main block (draggable middle) — only if track has a delay field */}
        {DELAY_FIELD_BY_TRACK[track.id] ? (
        <div
          className={cn(
            "absolute top-1/2 h-5 -translate-y-1/2 rounded-md transition-[filter,box-shadow,transform] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-slate-900/60 focus-visible:ring-offset-2",
            "bg-gradient-to-b border shadow-sm",
            tone.gradient, tone.border,
            isMoving
              ? "shadow-md ring-1 ring-slate-400/50 cursor-grabbing z-10 brightness-95 scale-y-110"
              : "cursor-grab group-hover:shadow-md group-hover:brightness-105"
          )}
          style={{ left: leftPct, width: widthPct }}
          {...moveHandlers}
          role="slider"
          aria-label={`${track.label} 时间块`}
          aria-valuemin={0}
          aria-valuemax={totalMs}
          aria-valuenow={ghostStart}
          aria-valuetext={valueText}
          onKeyDown={onKeyDown}
          tabIndex={0}
        >
          {/* duration label inside block */}
          {track.configuredDuration && (ghostEnd - ghostStart) / totalMs > 0.18 ? (
            <span className={cn(
              "absolute inset-0 flex items-center justify-center text-2xs font-semibold tabular-nums select-none pointer-events-none",
              tone.text
            )}>
              {Math.round(ghostEnd - ghostStart)}ms
            </span>
          ) : null}
        </div>
        ) : null}
        {isMoving && tooltipMs !== null ? (
          <div
            className="absolute -top-6 z-30 rounded-lg bg-slate-900 px-2 py-0.5 text-2xs font-semibold tabular-nums text-white shadow-lg pointer-events-none whitespace-nowrap"
            style={{ left: leftPct }}
          >
            {ghostStart}ms
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PreviewTimeline({ tracks, totalMs, disabled, canEditEmptyState, updateActionConfig, runId }) {
  const containerRef = useRef(null);
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

  const hasAnyDirty = tracks.some((t) => {
    const d = TRACK_DEFAULTS[t.id];
    return d && (t.start !== d.delay || (d.duration && t.configuredDuration !== d.duration));
  });

  const resetAll = useCallback(() => {
    const patch = {};
    for (const t of tracks) {
      const d = TRACK_DEFAULTS[t.id];
      if (!d) continue;
      const df = DELAY_FIELD_BY_TRACK[t.id];
      const uf = DURATION_FIELD_BY_TRACK[t.id];
      if (df) patch[df] = d.delay;
      if (uf && d.duration) patch[uf] = d.duration;
    }
    if (Object.keys(patch).length) updateActionConfig(patch);
  }, [tracks, updateActionConfig]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm select-none">
      {/* header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">时间轴编排</span>
          <span className="text-2xs tabular-nums text-slate-400 bg-slate-100 rounded-md px-1.5 py-0.5">总长 {formatTickMs(totalMs)}</span>
          <span className="hidden rounded-md bg-slate-50 px-1.5 py-0.5 text-2xs font-medium text-slate-400 sm:inline">Snap 20ms</span>
        </div>
        <div className="flex items-center gap-1.5">
          {hasAnyDirty ? (
            <button
              type="button"
              className="rounded-md px-2 py-0.5 text-2xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              onClick={resetAll}
            >
              重置全部
            </button>
          ) : null}
          <span className="text-2xs text-slate-400 hidden sm:inline">拖拽边缘调整时长 · 拖拽中部调整延迟</span>
        </div>
      </div>

      {/* ruler */}
      <div className="relative mx-4 mt-2.5 h-6">
        {/* minor ticks */}
        {minorTicks.map((tick) => (
          <div
            key={`ruler-minor-${tick}`}
            className="absolute bottom-0 h-2 w-px bg-slate-300/60"
            style={{ left: `${(tick / totalMs) * 100}%`, transform: "translateX(-50%)" }}
          />
        ))}
        {/* major ticks */}
        {tickMarks.map((tick) => (
          <div
            key={`ruler-${tick}`}
            className="absolute bottom-0 flex flex-col items-center"
            style={{ left: `${(tick / totalMs) * 100}%`, transform: tick === 0 ? "translateX(0)" : tick === totalMs ? "translateX(-100%)" : "translateX(-50%)" }}
          >
            <div className="h-3.5 w-px bg-slate-400" />
            <span className="mt-0.5 text-2xs tabular-nums text-slate-500 leading-none">
              {formatTickMs(tick)}
            </span>
          </div>
        ))}
      </div>

      {/* tracks */}
      <div ref={containerRef} className="relative px-3 pb-3 pt-2 space-y-1">
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
        {tracks.length ? tracks.map((track, i) => (
          <TimelineTrackRow
            key={track.id}
            track={track}
            totalMs={totalMs}
            pxPerMs={pxPerMs}
            updateActionConfig={updateActionConfig}
            isEven={i % 2 === 0}
            disabled={disabled}
          />
        )) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-center">
            <div className="text-xs font-medium text-slate-700 text-balance">当前动作还没有可播放的视觉效果</div>
            <div className="mt-1 text-2xs text-slate-500 text-pretty">先在左侧开启一个基础反馈，再回到时间轴微调节奏。</div>
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
