import {
  getActionAnimationConfig,
  getActionAudioConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
} from "../model/actionConfigSchema";
import { computeRippleLayers } from "./computeSpecs";

export type TimelineTrackId = "text" | "ripple" | "particle" | "animation" | "image" | "audio";
type TimelineTrackTone = "rose" | "teal" | "amber" | "sky" | "violet" | "slate";

interface TimelineMarker {
  label: string;
  at: number;
}

export interface TimelineTrack {
  id: TimelineTrackId;
  label: string;
  tone: TimelineTrackTone;
  start: number;
  end: number;
  configuredDuration?: number;
  markers: TimelineMarker[];
}

export interface TimelineModelInput {
  textConfig: Record<string, any>;
  particleConfig: Record<string, any>;
  rippleConfig: Record<string, any>;
  audioConfig: Record<string, any>;
  animationConfig: Record<string, any>;
  imageConfig: Record<string, any>;
  config: Record<string, any>;
}

export const DELAY_FIELD_BY_TRACK: Partial<Record<TimelineTrackId, string>> = {
  text: "textDelay",
  ripple: "rippleDelay",
  particle: "particleDelay",
  animation: "animationDelay",
  image: "imageDelay",
  audio: "soundDelay",
};

export const DURATION_FIELD_BY_TRACK: Partial<Record<TimelineTrackId, string>> = {
  text: "textDuration",
  ripple: "rippleDuration",
  particle: "particleDuration",
  animation: "animationDuration",
  image: "imageDuration",
};

export const TRACK_DEFAULTS: Record<TimelineTrackId, { delay: number; duration?: number }> = {
  text: { delay: 0, duration: 1000 },
  ripple: { delay: 0, duration: 820 },
  particle: { delay: 0, duration: 760 },
  animation: { delay: 0, duration: 720 },
  image: { delay: 0, duration: 780 },
  audio: { delay: 0 },
};

const TIMELINE_MIN_TOTAL_MS = 820;
export const PREVIEW_CYCLE_IDLE_MS = 800;
const TIMELINE_KEYBOARD_STEP_MS = 20;
const TIMELINE_KEYBOARD_LARGE_STEP_MS = 100;

export function buildTimelineTracks({ textConfig, particleConfig, rippleConfig, audioConfig, animationConfig, imageConfig, config }: TimelineModelInput) {
  const tracks: TimelineTrack[] = [];
  const textDelay = textConfig.textDelay || 0;
  const rippleDelay = rippleConfig.rippleDelay || 0;
  const particleDelay = particleConfig.particleDelay || 0;
  const animationDelay = animationConfig.animationDelay || 0;
  const imageDelay = imageConfig.imageDelay || 0;
  const soundDelay = audioConfig.soundDelay || 0;

  const ripples = rippleConfig.ripple ? computeRippleLayers(config) : [];
  const rippleEnd = rippleDelay + ripples.reduce((max, ripple) => Math.max(max, ripple.delay + rippleConfig.rippleDuration), 0);
  const particleEnd = particleConfig.particle
    ? (particleConfig.particleMotionMode === "orbital"
      ? particleDelay + Math.max(particleConfig.particleDuration || 3000, 1000)
      : particleDelay + particleConfig.particleDuration + Math.min(520, Math.max(0, particleConfig.particleCount - 1) * (particleConfig.particleStagger ?? 26)))
    : 0;

  if (textConfig.textEnabled) tracks.push({ id: "text", label: "飘字", tone: "rose", start: textDelay, end: textDelay + textConfig.textDuration, configuredDuration: textConfig.textDuration, markers: [{ label: "出现", at: textDelay }, { label: "峰值", at: textDelay + Math.round(textConfig.textDuration * 0.18) }, { label: "淡出", at: textDelay + textConfig.textDuration }] });
  if (rippleConfig.ripple) tracks.push({ id: "ripple", label: "波纹", tone: "teal", start: rippleDelay, end: rippleEnd, configuredDuration: rippleConfig.rippleDuration, markers: [{ label: "扩散", at: rippleDelay }, { label: "最大", at: rippleEnd }] });
  if (particleConfig.particle) tracks.push({ id: "particle", label: "粒子", tone: "amber", start: particleDelay, end: particleEnd, configuredDuration: particleConfig.particleDuration, markers: [{ label: "喷发", at: particleDelay }, { label: "散开", at: Math.round(particleDelay + (particleEnd - particleDelay) * 0.55) }] });
  if (animationConfig.animationEnabled) tracks.push({ id: "animation", label: "动画", tone: "sky", start: animationDelay, end: animationDelay + animationConfig.animationDuration, configuredDuration: animationConfig.animationDuration, markers: [{ label: "入场", at: animationDelay }, { label: "收束", at: animationDelay + animationConfig.animationDuration }] });
  if (imageConfig.imageEnabled && imageConfig.imageDataUrl) tracks.push({ id: "image", label: "贴纸", tone: "violet", start: imageDelay, end: imageDelay + imageConfig.imageDuration, configuredDuration: imageConfig.imageDuration, markers: [{ label: "弹出", at: imageDelay }, { label: "离场", at: imageDelay + imageConfig.imageDuration }] });
  if (audioConfig.sound) tracks.push({ id: "audio", label: "音效", tone: "slate", start: soundDelay, end: soundDelay + 120, markers: [{ label: "播放", at: soundDelay }] });

  const totalMs = Math.max(TIMELINE_MIN_TOTAL_MS, ...tracks.map((track) => track.end));
  return { tracks, totalMs: Math.ceil(totalMs / 100) * 100 };
}

export function buildTickMarks(totalMs: number): number[] {
  const step = totalMs <= 1200 ? 100 : totalMs <= 2400 ? 200 : 500;
  const ticks: number[] = [];
  for (let t = 0; t <= totalMs; t += step) {
    ticks.push(t);
  }
  if (ticks[ticks.length - 1] !== totalMs) ticks.push(totalMs);
  return ticks;
}

export function buildMinorTicks(totalMs: number): number[] {
  const step = totalMs <= 1200 ? 100 : totalMs <= 2400 ? 200 : 500;
  const minorStep = step / 5;
  const ticks: number[] = [];
  for (let t = minorStep; t < totalMs; t += minorStep) {
    if (t % step !== 0) ticks.push(t);
  }
  return ticks;
}

export function formatTickMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 1 : 2)}s`;
}

export function buildTimelineKeyboardPatch({
  track,
  key,
  shiftKey = false,
  maxDelay,
}: {
  track: TimelineTrack;
  key: string;
  shiftKey?: boolean;
  maxDelay?: number;
}): Record<string, number> | null {
  const delayField = DELAY_FIELD_BY_TRACK[track.id];
  if (!delayField) return null;

  const durationField = DURATION_FIELD_BY_TRACK[track.id];
  const duration = track.configuredDuration ?? (track.end - track.start);
  const step = shiftKey ? TIMELINE_KEYBOARD_LARGE_STEP_MS : TIMELINE_KEYBOARD_STEP_MS;
  const clampDelay = (value: number) => {
    const clamped = Math.max(0, value);
    return maxDelay === undefined ? clamped : Math.min(maxDelay, clamped);
  };

  if (key === "ArrowLeft") {
    return { [delayField]: clampDelay(track.start - step) };
  }

  if (key === "ArrowRight") {
    return { [delayField]: clampDelay(track.start + step) };
  }

  if (key === "Home") {
    const patch: Record<string, number> = { [delayField]: 0 };
    if (durationField) patch[durationField] = duration;
    return patch;
  }

  return null;
}

export function buildTimelineModel(config: Record<string, any>) {
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

export function getPreviewCycleMs(config: Record<string, any>): number {
  return buildTimelineModel(config).totalMs + PREVIEW_CYCLE_IDLE_MS;
}
