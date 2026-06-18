import { useCallback, useRef, useState } from "react";

/**
 * Horizontal drag/resize hook for timeline tracks.
 *
 * Modes:
 *   "move"         – drag the whole block (changes delay)
 *   "resize-left"  – drag the left edge (changes delay)
 *   "resize-right" – drag the right edge (changes duration)
 *
 * @param {Object} opts
 * @param {"move"|"resize-left"|"resize-right"} opts.mode
 * @param {number} opts.pxPerMs      - pixels per millisecond
 * @param {number} [opts.snapMs=20]  - snap grid interval in ms
 * @param {number} [opts.minMs=0]    - minimum allowed value
 * @param {(ms: number) => void} [opts.onChange] - called during drag (throttled)
 * @param {(ms: number) => void} [opts.onCommit] - called when drag ends
 */
export function useTimelineDrag({ mode, pxPerMs, snapMs = 20, minMs = 0, maxMs = Infinity, onChange, onCommit }) {
  const [isDragging, setIsDragging] = useState(false);
  const [tooltipMs, setTooltipMs] = useState(null);
  const stateRef = useRef(null);

  const snap = useCallback(
    (value) => Math.min(maxMs, Math.max(minMs, Math.round(value / snapMs) * snapMs)),
    [maxMs, minMs, snapMs]
  );

  const onPointerDown = useCallback(
    (event) => {
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
    (event) => {
      const state = stateRef.current;
      if (!state) return;

      const deltaX = event.clientX - state.startX;
      const deltaMs = deltaX / pxPerMs;

      let currentMs;
      if (mode === "resize-right") {
        currentMs = snap(deltaMs);
      } else {
        currentMs = snap(deltaMs);
      }

      setTooltipMs(currentMs);

      if (currentMs !== state.lastBroadcastMs) {
        state.lastBroadcastMs = currentMs;
        if (onChange) onChange(currentMs);
      }
    },
    [pxPerMs, snap, mode, onChange]
  );

  const finishDrag = useCallback(
    (event, commit) => {
      const state = stateRef.current;
      if (!state) return;

      const el = event.currentTarget;
      try { el.releasePointerCapture(event.pointerId); } catch (_) { /* ignore */ }

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
    (event) => finishDrag(event, true),
    [finishDrag]
  );

  const onPointerCancel = useCallback(
    (event) => finishDrag(event, false),
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
