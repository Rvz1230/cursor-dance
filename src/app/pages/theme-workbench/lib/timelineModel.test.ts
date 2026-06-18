import { describe, expect, it } from "vitest";

import { createThemeDraft } from "../model/workbenchSchema";
import {
  DELAY_FIELD_BY_TRACK,
  DURATION_FIELD_BY_TRACK,
  PREVIEW_CYCLE_IDLE_MS,
  TRACK_DEFAULTS,
  buildMinorTicks,
  buildTickMarks,
  buildTimelineModel,
  buildTimelineTracks,
  formatTickMs,
  getPreviewCycleMs,
} from "./timelineModel";
import {
  getActionAnimationConfig,
  getActionAudioConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
} from "../model/workbenchSchema";

function buildTimelineFromActionConfig(config: Record<string, any>) {
  return buildTimelineTracks({
    textConfig: getActionTextConfig(config),
    particleConfig: getActionParticleConfig(config),
    rippleConfig: getActionRippleConfig(config),
    audioConfig: getActionAudioConfig(config),
    animationConfig: getActionAnimationConfig(config),
    imageConfig: getActionImageConfig(config),
    config,
  });
}

describe("timelineModel", () => {
  it("builds tracks for enabled effects and rounds total duration", () => {
    const config = {
      ...createThemeDraft("mono-geo").actionConfigs.leftClick,
      textDelay: 120,
      particleDelay: 80,
      rippleDelay: 40,
      sound: true,
      soundDelay: 260,
      animationEnabled: true,
      animationDelay: 300,
      animationDuration: 720,
      imageEnabled: true,
      imageDataUrl: "data:image/png;base64,AAA",
      imageDelay: 500,
      imageDuration: 780,
    };

    const timeline = buildTimelineFromActionConfig(config);

    expect(timeline.tracks.map((track) => track.id)).toEqual(["text", "ripple", "particle", "animation", "image", "audio"]);
    expect(timeline.tracks.find((track) => track.id === "text")).toMatchObject({ start: 120, configuredDuration: 1000 });
    expect(timeline.tracks.find((track) => track.id === "audio")).toMatchObject({ start: 260, end: 380 });
    expect(timeline.totalMs).toBe(1400);
  });

  it("uses orbital particle duration as a continuous track", () => {
    const config = {
      ...createThemeDraft("mono-geo").actionConfigs.rightClick,
      textEnabled: false,
      ripple: false,
      sound: false,
      particle: true,
      particleDelay: 180,
      particleDuration: 640,
      particleMotionMode: "orbital",
    };

    const particleTrack = buildTimelineFromActionConfig(config).tracks.find((track) => track.id === "particle");

    expect(particleTrack).toMatchObject({ start: 180, end: 1180, configuredDuration: 640 });
  });

  it("returns empty tracks with the minimum total duration when no effect is enabled", () => {
    const config = {
      ...createThemeDraft("mono-geo").actionConfigs.rightClick,
      textEnabled: false,
      ripple: false,
      particle: false,
      sound: false,
      animationEnabled: false,
      imageEnabled: false,
    };

    expect(buildTimelineFromActionConfig(config)).toEqual({ tracks: [], totalMs: 900 });
  });

  it("builds major and minor ticks using the same step thresholds", () => {
    expect(buildTickMarks(1000)).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
    expect(buildTickMarks(1300)).toEqual([0, 200, 400, 600, 800, 1000, 1200, 1300]);
    expect(buildTickMarks(2600)).toEqual([0, 500, 1000, 1500, 2000, 2500, 2600]);
    expect(buildMinorTicks(100)).toEqual([20, 40, 60, 80]);
  });

  it("builds action-config timeline models and preview cycles from the same total", () => {
    const config = {
      ...createThemeDraft("mono-geo").actionConfigs.leftClick,
      particleDelay: 80,
      sound: true,
      soundDelay: 400,
    };

    const model = buildTimelineModel(config);

    expect(model.totalMs).toBe(buildTimelineFromActionConfig(config).totalMs);
    expect(getPreviewCycleMs(config)).toBe(model.totalMs + PREVIEW_CYCLE_IDLE_MS);
  });

  it("includes delayed audio-only feedback in the shared preview cycle", () => {
    const config = {
      ...createThemeDraft("mono-geo").actionConfigs.rightClick,
      textEnabled: false,
      ripple: false,
      particle: false,
      animationEnabled: false,
      imageEnabled: false,
      sound: true,
      soundDelay: 1700,
    };

    expect(buildTimelineModel(config).totalMs).toBe(1900);
    expect(getPreviewCycleMs(config)).toBe(1900 + PREVIEW_CYCLE_IDLE_MS);
  });

  it("formats timeline labels and exposes editable field mappings", () => {
    expect(formatTickMs(980)).toBe("980ms");
    expect(formatTickMs(1000)).toBe("1.0s");
    expect(formatTickMs(1280)).toBe("1.28s");
    expect(DELAY_FIELD_BY_TRACK.audio).toBe("soundDelay");
    expect(DURATION_FIELD_BY_TRACK.audio).toBeUndefined();
    expect(TRACK_DEFAULTS.ripple).toEqual({ delay: 0, duration: 820 });
  });
});
