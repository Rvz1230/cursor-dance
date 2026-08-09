import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { CursorTrailSurface } from "@/shared/effect-runtime/cursor-trail-surface";

export type TrailPathEditorMode = "idle" | "armed" | "recording" | "playing" | "paused";

export interface TrailEditorPoint {
  x: number;
  y: number;
}

export interface TrailPlaybackPath {
  readonly points: readonly TrailEditorPoint[];
  readonly cumulativeLengths: readonly number[];
  readonly totalLength: number;
}

const PLAYBACK_DURATION_MS = 1_600;
const MIN_POINT_DISTANCE = 0.008;
const MAX_PATH_POINTS = 180;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function pointFromEvent(event: ReactPointerEvent<HTMLDivElement>): TrailEditorPoint {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: clampUnit((event.clientX - rect.left) / Math.max(1, rect.width)),
    y: clampUnit((event.clientY - rect.top) / Math.max(1, rect.height)),
  };
}

export function shouldAppendTrailPoint(previous: TrailEditorPoint | undefined, next: TrailEditorPoint): boolean {
  if (!previous) return true;
  return Math.hypot(next.x - previous.x, next.y - previous.y) >= MIN_POINT_DISTANCE;
}

export function measureTrailPlaybackPath(
  points: readonly TrailEditorPoint[],
  scaleX = 1,
  scaleY = 1,
): TrailPlaybackPath {
  const cumulativeLengths = [0];
  let totalLength = 0;
  for (let index = 1; index < points.length; index += 1) {
    totalLength += Math.hypot(
      (points[index].x - points[index - 1].x) * scaleX,
      (points[index].y - points[index - 1].y) * scaleY,
    );
    cumulativeLengths.push(totalLength);
  }
  return { points, cumulativeLengths, totalLength };
}

export function getTrailPlaybackPoint(
  playbackPath: TrailPlaybackPath,
  elapsedMs: number,
): TrailEditorPoint | null {
  const { points, cumulativeLengths, totalLength } = playbackPath;
  if (!points.length) return null;
  if (points.length === 1 || totalLength <= Number.EPSILON) return points[0];

  const progress = Math.min(1, Math.max(0, elapsedMs / PLAYBACK_DURATION_MS));
  const targetLength = totalLength * progress;
  let upperIndex = 1;
  while (upperIndex < cumulativeLengths.length - 1 && cumulativeLengths[upperIndex] < targetLength) {
    upperIndex += 1;
  }
  const lowerIndex = upperIndex - 1;
  const segmentLength = cumulativeLengths[upperIndex] - cumulativeLengths[lowerIndex];
  const localProgress = segmentLength <= Number.EPSILON
    ? 0
    : (targetLength - cumulativeLengths[lowerIndex]) / segmentLength;
  return {
    x: points[lowerIndex].x + (points[upperIndex].x - points[lowerIndex].x) * localProgress,
    y: points[lowerIndex].y + (points[upperIndex].y - points[lowerIndex].y) * localProgress,
  };
}

export function useTrailPathEditor({
  enabled,
  stageRef,
  surfaceRef,
}: {
  enabled: boolean;
  stageRef: RefObject<HTMLDivElement | null>;
  surfaceRef: MutableRefObject<CursorTrailSurface | null>;
}) {
  const [mode, setMode] = useState<TrailPathEditorMode>("idle");
  const [path, setPath] = useState<TrailEditorPoint[]>([]);
  const modeRef = useRef(mode);
  const pathRef = useRef(path);
  const pointerIdRef = useRef<number | null>(null);

  function updateMode(next: TrailPathEditorMode): void {
    modeRef.current = next;
    setMode(next);
  }

  function updatePath(next: TrailEditorPoint[]): void {
    pathRef.current = next;
    setPath(next);
  }

  useEffect(() => {
    if (enabled) return;
    if (modeRef.current === "recording" || modeRef.current === "armed") updateMode("idle");
    else if (modeRef.current === "playing") updateMode("paused");
    surfaceRef.current?.leave();
  }, [enabled, surfaceRef]);

  useEffect(() => {
    if (!enabled || mode !== "playing" || path.length < 2) return undefined;
    const root = stageRef.current;
    if (!root) return undefined;
    let frameId = 0;
    let startedAt = window.performance.now();
    const playbackPath = measureTrailPlaybackPath(path, root.clientWidth, root.clientHeight);

    const render = (timestamp: number) => {
      const surface = surfaceRef.current;
      if (!surface) return;
      const elapsed = timestamp - startedAt;
      if (elapsed >= PLAYBACK_DURATION_MS) {
        startedAt = timestamp;
        surface.clear();
      }
      const point = getTrailPlaybackPoint(playbackPath, timestamp - startedAt);
      if (point) {
        surface.move(point.x * root.clientWidth, point.y * root.clientHeight);
      }
      frameId = window.requestAnimationFrame(render);
    };

    surfaceRef.current?.clear();
    frameId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frameId);
  }, [enabled, mode, path, stageRef, surfaceRef]);

  function armRecording(): void {
    if (!enabled) return;
    updateMode("armed");
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>): boolean {
    if (!enabled || modeRef.current !== "armed") return false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointerIdRef.current = event.pointerId;
    const firstPoint = pointFromEvent(event);
    updatePath([firstPoint]);
    surfaceRef.current?.clear();
    surfaceRef.current?.move(firstPoint.x * event.currentTarget.clientWidth, firstPoint.y * event.currentTarget.clientHeight);
    updateMode("recording");
    return true;
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>): boolean {
    const currentMode = modeRef.current;
    if (currentMode === "playing") return true;
    if (currentMode !== "recording" || pointerIdRef.current !== event.pointerId) return false;
    const nextPoint = pointFromEvent(event);
    const currentPath = pathRef.current;
    if (!shouldAppendTrailPoint(currentPath[currentPath.length - 1], nextPoint)) return true;
    const nextPath = [...currentPath, nextPoint].slice(-MAX_PATH_POINTS);
    updatePath(nextPath);
    surfaceRef.current?.move(nextPoint.x * event.currentTarget.clientWidth, nextPoint.y * event.currentTarget.clientHeight);
    return true;
  }

  function finishRecording(event: ReactPointerEvent<HTMLDivElement>): boolean {
    if (modeRef.current !== "recording" || pointerIdRef.current !== event.pointerId) return false;
    pointerIdRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (pathRef.current.length < 2) {
      updatePath([]);
      updateMode("armed");
      return true;
    }
    updateMode("playing");
    return true;
  }

  function togglePlayback(): void {
    if (pathRef.current.length < 2) return;
    updateMode(modeRef.current === "playing" ? "paused" : "playing");
    if (modeRef.current === "paused") surfaceRef.current?.leave();
  }

  function clearPath(): void {
    pointerIdRef.current = null;
    updatePath([]);
    updateMode("idle");
    surfaceRef.current?.clear();
  }

  return {
    mode,
    path,
    armRecording,
    togglePlayback,
    clearPath,
    handlePointerDown,
    handlePointerMove,
    finishRecording,
  };
}
