import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * Horizontal drag/resize hook for timeline tracks.
 *
 * Modes:
 *   "move"         – drag the whole block (changes delay)
 *   "resize-left"  – drag the left edge (changes delay)
 *   "resize-right" – drag the right edge (changes duration)
 *
 */
interface TimelineDragOptions {
  pxPerMs: number;
  snapMs?: number;
  minMs?: number;
  maxMs?: number;
  onChange?(deltaMs: number | null): void;
  onCommit?(deltaMs: number): void;
}

interface TimelineDragState {
  startX: number;
  lastBroadcastMs: number | null;
}

export function useTimelineDrag({
  pxPerMs,
  snapMs = 20,
  minMs = 0,
  maxMs = Infinity,
  onChange,
  onCommit,
}: TimelineDragOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const [tooltipMs, setTooltipMs] = useState<number | null>(null);
  const stateRef = useRef<TimelineDragState | null>(null);

  const snap = useCallback(
    (value: number) => Math.min(maxMs, Math.max(minMs, Math.round(value / snapMs) * snapMs)),
    [maxMs, minMs, snapMs]
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || pxPerMs <= 0) return;
      event.preventDefault();
      event.stopPropagation();
      const el = event.currentTarget;
      el.setPointerCapture(event.pointerId);

      const startX = event.clientX;
      stateRef.current = { startX, lastBroadcastMs: null };
      setIsDragging(true);

      if (onChange) onChange(null); // signal drag start
    },
    [onChange, pxPerMs]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const state = stateRef.current;
      if (!state) return;

      const deltaX = event.clientX - state.startX;
      const deltaMs = deltaX / pxPerMs;

      const currentMs = snap(deltaMs);

      setTooltipMs(currentMs);

      if (currentMs !== state.lastBroadcastMs) {
        state.lastBroadcastMs = currentMs;
        if (onChange) onChange(currentMs);
      }
    },
    [pxPerMs, snap, onChange]
  );

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, commit: boolean) => {
      const state = stateRef.current;
      if (!state) return;

      const el = event.currentTarget;
      try { el.releasePointerCapture(event.pointerId); } catch { /* ignore */ }

      const deltaX = event.clientX - state.startX;
      const deltaMs = deltaX / pxPerMs;
      const finalMs = snap(deltaMs);

      stateRef.current = null;
      setIsDragging(false);
      setTooltipMs(null);

      if (commit && onCommit) onCommit(finalMs);
      if (onChange) onChange(null); // signal drag end
    },
    [pxPerMs, snap, onCommit, onChange]
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => finishDrag(event, true),
    [finishDrag]
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => finishDrag(event, false),
    [finishDrag]
  );

  const handlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };

  return { isDragging, tooltipMs, handlers };
}
