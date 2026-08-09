import { describe, expect, it } from "vitest";
import {
  getTrailPlaybackPoint,
  measureTrailPlaybackPath,
  shouldAppendTrailPoint,
} from "./useTrailPathEditor";

describe("trail path editor helpers", () => {
  it("filters tiny pointer jitter while preserving intentional movement", () => {
    expect(shouldAppendTrailPoint(undefined, { x: 0.2, y: 0.2 })).toBe(true);
    expect(shouldAppendTrailPoint({ x: 0.2, y: 0.2 }, { x: 0.204, y: 0.203 })).toBe(false);
    expect(shouldAppendTrailPoint({ x: 0.2, y: 0.2 }, { x: 0.22, y: 0.2 })).toBe(true);
  });

  it("plays unevenly sampled paths at a constant distance over time", () => {
    const playbackPath = measureTrailPlaybackPath([
      { x: 0, y: 0 },
      { x: 0.9, y: 0 },
      { x: 0.9, y: 0.1 },
    ]);

    expect(playbackPath.totalLength).toBeCloseTo(1);
    expect(getTrailPlaybackPoint(playbackPath, 0)).toEqual({ x: 0, y: 0 });
    expect(getTrailPlaybackPoint(playbackPath, 800)).toEqual({ x: 0.5, y: 0 });
    const nearEnd = getTrailPlaybackPoint(playbackPath, 1_520);
    expect(nearEnd?.x).toBeCloseTo(0.9);
    expect(nearEnd?.y).toBeCloseTo(0.05);
    expect(getTrailPlaybackPoint(playbackPath, 9_999)).toEqual({ x: 0.9, y: 0.1 });
  });

  it("handles empty and zero-length recordings", () => {
    expect(getTrailPlaybackPoint(measureTrailPlaybackPath([]), 800)).toBeNull();
    expect(getTrailPlaybackPoint(measureTrailPlaybackPath([
      { x: 0.4, y: 0.6 },
      { x: 0.4, y: 0.6 },
    ]), 800)).toEqual({ x: 0.4, y: 0.6 });
  });

  it("measures normalized points in the preview's pixel aspect ratio", () => {
    const playbackPath = measureTrailPlaybackPath([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ], 2, 1);

    expect(playbackPath.totalLength).toBe(3);
    expect(getTrailPlaybackPoint(playbackPath, 800)).toEqual({ x: 0.75, y: 0 });
  });
});
