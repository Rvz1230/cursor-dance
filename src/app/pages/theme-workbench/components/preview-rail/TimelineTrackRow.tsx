import { useCallback, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { X } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useTimelineDrag } from "../../lib/useTimelineDrag";
import {
  DELAY_FIELD_BY_TRACK,
  DURATION_FIELD_BY_TRACK,
  buildMinorTicks,
  buildTickMarks,
  buildTimelineKeyboardPatch,
  buildTimelineResetPatch,
  isTimelineTrackDirty,
  type TimelineTrack,
} from "../../lib/timelineModel";

type UpdateActionConfig = (patch: Record<string, unknown>) => void;
type GhostMode = "move" | "resize-left" | "resize-right";

interface TimelineGhost {
  mode: GhostMode;
  deltaMs: number;
}
interface TrackHandleProps {
  side: "left" | "right";
  track: TimelineTrack;
  totalMs: number;
  pxPerMs: number;
  editableDuration: number;
  updateActionConfig: UpdateActionConfig;
  onGhostChange(deltaMs: number | null): void;
  snapMs: number;
}

interface TimelineTrackRowProps {
  track: TimelineTrack;
  totalMs: number;
  pxPerMs: number;
  updateActionConfig: UpdateActionConfig;
  isEven: boolean;
  disabled: boolean;
  snapMs: number;
}

function getTimelineTone(tone: TimelineTrack["tone"]) {
  if (tone === "rose") return { text: "text-rose-600", dot: "bg-rose-500", border: "border-rose-300/60", gradient: "from-rose-200/90 to-rose-300/80" };
  if (tone === "teal") return { text: "text-teal-600", dot: "bg-teal-500", border: "border-teal-300/60", gradient: "from-teal-200/90 to-teal-300/80" };
  if (tone === "amber") return { text: "text-amber-600", dot: "bg-amber-500", border: "border-amber-300/60", gradient: "from-amber-200/90 to-amber-300/80" };
  if (tone === "sky") return { text: "text-sky-600", dot: "bg-sky-500", border: "border-sky-300/60", gradient: "from-sky-200/90 to-sky-300/80" };
  if (tone === "violet") return { text: "text-violet-600", dot: "bg-violet-500", border: "border-violet-300/60", gradient: "from-violet-200/90 to-violet-300/80" };
  return { text: "text-slate-600", dot: "bg-slate-500", border: "border-slate-300/60", gradient: "from-slate-200/90 to-slate-300/80" };
}

function TrackHandle({
  side,
  track,
  totalMs,
  pxPerMs,
  editableDuration,
  updateActionConfig,
  onGhostChange,
  snapMs,
}: TrackHandleProps) {
  const isLeft = side === "left";
  const delayField = DELAY_FIELD_BY_TRACK[track.id];
  const durationField = DURATION_FIELD_BY_TRACK[track.id];
  const minEditableDuration = editableDuration <= 0 ? 0 : 40;

  const commitRef = useRef<((deltaMs: number) => void) | null>(null);
  commitRef.current = useCallback(
    (deltaMs: number) => {
      if (isLeft && delayField) {
        const patch: Record<string, number> = {
          [delayField]: Math.max(0, track.start + deltaMs),
        };
        if (durationField) {
          patch[durationField] = Math.max(minEditableDuration, editableDuration - deltaMs);
        }
        updateActionConfig(patch);
      } else if (!isLeft && durationField) {
        updateActionConfig({
          [durationField]: Math.max(minEditableDuration, editableDuration + deltaMs),
        });
      }
    },
    [editableDuration, isLeft, delayField, durationField, minEditableDuration, track.start, updateActionConfig],
  );

  const onGhostChangeRef = useRef(onGhostChange);
  onGhostChangeRef.current = onGhostChange;

  const { isDragging, tooltipMs, handlers } = useTimelineDrag({
    pxPerMs,
    snapMs,
    minMs: isLeft ? -track.start : -(editableDuration - minEditableDuration),
    maxMs: isLeft ? editableDuration - minEditableDuration : Infinity,
    onChange: (deltaMs) => onGhostChangeRef.current(deltaMs),
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
            : "bg-slate-300/20 hover:bg-slate-300/50",
        )}
        style={{ left: posPct }}
        {...handlers}
      >
        <div className={cn(
          "absolute inset-y-2 left-1/2 flex -translate-x-1/2 flex-col justify-center gap-[2px] transition-opacity duration-150",
          isDragging ? "opacity-100" : "opacity-30 group-hover:opacity-80",
        )}>
          <span className="block h-[2px] w-[3px] rounded-full bg-slate-500" />
          <span className="block h-[2px] w-[3px] rounded-full bg-slate-500" />
          <span className="block h-[2px] w-[3px] rounded-full bg-slate-500" />
        </div>
      </div>
      {isDragging && tooltipMs !== null ? (
        <div
          className="pointer-events-none absolute -top-8 z-30 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-0.5 text-2xs font-semibold tabular-nums text-white shadow-lg"
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

export function TimelineTrackRow({
  track,
  totalMs,
  pxPerMs,
  updateActionConfig,
  isEven,
  disabled,
  snapMs,
}: TimelineTrackRowProps) {
  const [ghost, setGhost] = useState<TimelineGhost | null>(null);
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
  const ghostEnd = ghost?.mode === "move"
    ? track.end + ghostDelta
    : ghostStart + ghostEditableDuration + tailDuration;
  const leftPct = `${(ghostStart / totalMs) * 100}%`;
  const widthPct = `${Math.max(0.5, ((ghostEnd - ghostStart) / totalMs) * 100)}%`;
  const tone = getTimelineTone(track.tone);
  const delayField = DELAY_FIELD_BY_TRACK[track.id];
  const minorTicks = useMemo(() => buildMinorTicks(totalMs), [totalMs]);
  const tickMarks = useMemo(() => buildTickMarks(totalMs), [totalMs]);

  const commitRef = useRef<((deltaMs: number) => void) | null>(null);
  commitRef.current = useCallback(
    (deltaMs: number) => {
      if (disabled || !delayField) return;
      updateActionConfig({ [delayField]: Math.max(0, track.start + deltaMs) });
    },
    [delayField, disabled, track.start, updateActionConfig],
  );

  const { isDragging: isMoving, tooltipMs, handlers: moveHandlers } = useTimelineDrag({
    pxPerMs: disabled ? 0 : pxPerMs,
    snapMs,
    minMs: -track.start,
    onChange: (deltaMs) => setGhost(deltaMs === null ? null : { mode: "move", deltaMs }),
    onCommit: (deltaMs) => commitRef.current?.(deltaMs),
  });

  const isDirty = isTimelineTrackDirty(track);
  const valueText = `${track.label} 延迟 ${ghostStart}ms${track.configuredDuration ? `，时长 ${Math.round(ghostEnd - ghostStart)}ms` : ""}`;

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
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
    [disabled, ghostEnd, ghostStart, totalMs, track, updateActionConfig],
  );

  return (
    <div className={cn(
      "group relative -mx-1 grid scroll-mt-24 grid-cols-[132px_minmax(320px,1fr)] items-center gap-2.5 rounded-lg px-1 py-1 transition-colors duration-150",
      isMoving ? "bg-slate-100" : isEven ? "bg-slate-50/60 hover:bg-slate-100/80" : "bg-white hover:bg-slate-50",
    )} id={`timeline-track-${track.id}`}>
      <div className="flex items-center gap-1.5">
        <span className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} />
        <span className={cn("truncate text-2xs font-semibold select-none", tone.text)}>{track.label}</span>
        {isDirty ? (
          <button
            type="button"
            className="hidden size-4 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500 transition-colors hover:bg-slate-300 hover:text-slate-700 group-hover:flex"
            title="重置延迟和时长"
            aria-label={`重置${track.label}延迟和时长`}
            onClick={(event) => {
              if (disabled) return;
              event.stopPropagation();
              updateActionConfig(buildTimelineResetPatch([track]));
            }}
          >
            <X className="size-2.5" />
          </button>
        ) : null}
      </div>

      <div className={cn("relative h-7 rounded-lg border", isEven ? "border-slate-200/70 bg-slate-100/50" : "border-slate-200/60 bg-slate-100/80")}>
        {minorTicks.map((tick) => (
          <div key={`grid-minor-${track.id}-${tick}`} className="pointer-events-none absolute inset-y-0 w-px bg-slate-200/50" style={{ left: `${(tick / totalMs) * 100}%` }} />
        ))}
        {tickMarks.map((tick) => (
          <div key={`grid-${track.id}-${tick}`} className="pointer-events-none absolute inset-y-0 w-px bg-slate-300/70" style={{ left: `${(tick / totalMs) * 100}%` }} />
        ))}

        {delayField ? (
          <TrackHandle
            side="left"
            track={track}
            totalMs={totalMs}
            pxPerMs={disabled ? 0 : pxPerMs}
            editableDuration={editableDuration}
            updateActionConfig={updateActionConfig}
            onGhostChange={(deltaMs) => setGhost(deltaMs === null ? null : { mode: "resize-left", deltaMs })}
            snapMs={snapMs}
          />
        ) : null}
        {DURATION_FIELD_BY_TRACK[track.id] ? (
          <TrackHandle
            side="right"
            track={track}
            totalMs={totalMs}
            pxPerMs={disabled ? 0 : pxPerMs}
            editableDuration={editableDuration}
            updateActionConfig={updateActionConfig}
            onGhostChange={(deltaMs) => setGhost(deltaMs === null ? null : { mode: "resize-right", deltaMs })}
            snapMs={snapMs}
          />
        ) : null}

        {delayField ? (
          <div
            className={cn(
              "absolute top-1/2 h-5 -translate-y-1/2 rounded-md border bg-gradient-to-b shadow-sm outline-none transition-[filter,box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-slate-900/60 focus-visible:ring-offset-2",
              tone.gradient,
              tone.border,
              isMoving
                ? "z-10 scale-y-110 cursor-grabbing shadow-md ring-1 ring-slate-400/50 brightness-95"
                : "cursor-grab group-hover:shadow-md group-hover:brightness-105",
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
            {track.configuredDuration && (ghostEnd - ghostStart) / totalMs > 0.18 ? (
              <span className={cn("pointer-events-none absolute inset-0 flex items-center justify-center text-2xs font-semibold tabular-nums select-none", tone.text)}>
                {Math.round(ghostEnd - ghostStart)}ms
              </span>
            ) : null}
          </div>
        ) : null}
        {isMoving && tooltipMs !== null ? (
          <div className="pointer-events-none absolute -top-6 z-30 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-0.5 text-2xs font-semibold tabular-nums text-white shadow-lg" style={{ left: leftPct }}>
            {ghostStart}ms
          </div>
        ) : null}
      </div>
    </div>
  );
}
