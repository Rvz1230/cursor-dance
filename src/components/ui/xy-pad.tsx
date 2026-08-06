import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "./utils";

export interface XYValue {
  x: number;
  y: number;
}

const DEFAULT_X_RANGE = [0, 100] as const;
const DEFAULT_Y_RANGE = [0, 100] as const;

export function clampXYValue(
  value: XYValue,
  xRange: readonly [number, number],
  yRange: readonly [number, number],
): XYValue {
  return {
    x: Math.min(xRange[1], Math.max(xRange[0], Number.isFinite(value.x) ? value.x : xRange[0])),
    y: Math.min(yRange[1], Math.max(yRange[0], Number.isFinite(value.y) ? value.y : yRange[0])),
  };
}

export interface XYPadProps {
  value: XYValue;
  onChange?: (value: XYValue) => void;
  onPreview?: (value: XYValue) => void;
  xRange?: readonly [number, number];
  yRange?: readonly [number, number];
  step?: number;
  label: string;
  disabled?: boolean;
  className?: string;
  formatValue?: (value: XYValue) => string;
}

export function XYPad({
  value,
  onChange,
  onPreview,
  xRange = DEFAULT_X_RANGE,
  yRange = DEFAULT_Y_RANGE,
  step = 1,
  label,
  disabled = false,
  className,
  formatValue = (next) => `X ${Math.round(next.x)}% · Y ${Math.round(next.y)}%`,
}: XYPadProps) {
  const [draft, setDraft] = useState(() => clampXYValue(value, xRange, yRange));
  const draftRef = useRef(draft);
  const draggingRef = useRef(false);
  const enabled = !disabled && Boolean(onChange);

  useEffect(() => {
    if (draggingRef.current) return;
    const next = clampXYValue(value, xRange, yRange);
    draftRef.current = next;
    setDraft(next);
  }, [value, xRange, yRange]);

  function preview(nextValue: XYValue) {
    const clamped = clampXYValue({
      x: Math.round(nextValue.x / step) * step,
      y: Math.round(nextValue.y / step) * step,
    }, xRange, yRange);
    draftRef.current = clamped;
    setDraft(clamped);
    onPreview?.(clamped);
    return clamped;
  }

  function commit(nextValue = draftRef.current) {
    const next = preview(nextValue);
    draggingRef.current = false;
    if (next.x !== value.x || next.y !== value.y) onChange?.(next);
  }

  function updateFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const xRatio = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(rect.width, 1)));
    const yRatio = Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(rect.height, 1)));
    preview({
      x: xRange[0] + xRatio * (xRange[1] - xRange[0]),
      y: yRange[0] + yRatio * (yRange[1] - yRange[0]),
    });
  }

  function nudge(axis: "x" | "y", event: KeyboardEvent<HTMLButtonElement>) {
    const direction = {
      ArrowLeft: axis === "x" ? -1 : 0,
      ArrowRight: axis === "x" ? 1 : 0,
      ArrowUp: axis === "y" ? -1 : 0,
      ArrowDown: axis === "y" ? 1 : 0,
    }[event.key];
    if (!direction || !enabled) return;
    event.preventDefault();
    const delta = direction * step * (event.shiftKey ? 10 : 1);
    commit({ ...draftRef.current, [axis]: draftRef.current[axis] + delta });
  }

  const xPercent = ((draft.x - xRange[0]) / Math.max(xRange[1] - xRange[0], 1)) * 100;
  const yPercent = ((draft.y - yRange[0]) / Math.max(yRange[1] - yRange[0], 1)) * 100;

  return (
    <div className={cn("space-y-2", disabled && "opacity-60", className)}>
      <div className="text-right text-xs font-semibold tabular-nums text-slate-600">{formatValue(draft)}</div>
      <div className="grid grid-cols-[14px_minmax(0,1fr)] grid-rows-[112px_14px] gap-1" role="group" aria-label={label}>
        <button
          type="button"
          role="slider"
          aria-label={`${label} · 纵向`}
          aria-valuemin={yRange[0]}
          aria-valuemax={yRange[1]}
          aria-valuenow={draft.y}
          disabled={!enabled}
          onKeyDown={(event) => nudge("y", event)}
          className="relative row-start-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <span className="absolute bottom-0 left-1/2 top-0 w-1 -translate-x-1/2 rounded-full bg-slate-200" />
          <span className="absolute left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-900 bg-white" style={{ top: `${yPercent}%` }} />
        </button>
        <div
          className="relative col-start-2 row-start-1 cursor-crosshair overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner"
          onPointerDown={(event) => {
            if (!enabled) return;
            draggingRef.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            updateFromPointer(event);
          }}
          onPointerMove={(event) => {
            if (draggingRef.current) updateFromPointer(event);
          }}
          onPointerUp={(event) => {
            if (!draggingRef.current) return;
            event.currentTarget.releasePointerCapture(event.pointerId);
            commit();
          }}
          onPointerCancel={() => commit()}
          aria-hidden="true"
        >
          <span className="absolute inset-x-0 h-px bg-slate-300" style={{ top: `${yPercent}%` }} />
          <span className="absolute inset-y-0 w-px bg-slate-300" style={{ left: `${xPercent}%` }} />
          <span
            className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-900 bg-white shadow-sm"
            style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
          />
        </div>
        <button
          type="button"
          role="slider"
          aria-label={`${label} · 横向`}
          aria-valuemin={xRange[0]}
          aria-valuemax={xRange[1]}
          aria-valuenow={draft.x}
          disabled={!enabled}
          onKeyDown={(event) => nudge("x", event)}
          className="relative col-start-2 row-start-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <span className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-200" />
          <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-900 bg-white" style={{ left: `${xPercent}%` }} />
        </button>
      </div>
    </div>
  );
}
