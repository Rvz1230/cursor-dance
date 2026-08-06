import { useCallback, useEffect, useRef, useState } from "react";

const RUN_ID_MODULO = 1_000_000;

interface PreviewPlaybackConfig {
  holdMs?: number;
  [key: string]: unknown;
}

interface UsePreviewPlaybackOptions {
  actionId: string;
  config: PreviewPlaybackConfig;
  comboEnabled: boolean;
  comboWindowMs: number;
  disabled: boolean;
  totalMs?: number;
}

export function getEffectivePreviewInterval(
  actionId: string,
  holdMs: number | undefined,
  requestedInterval: number,
): number {
  const simulationOverhead = actionId === "longPress"
    ? (holdMs || 420) + 400
    : actionId === "doubleClick"
      ? (holdMs || 320) + 400
      : 0;
  return Math.max(requestedInterval, simulationOverhead);
}

export function getNextPreviewComboIndex(
  previousIndex: number,
  lastFiredAt: number,
  now: number,
  comboWindowMs: number,
): number {
  return lastFiredAt > 0 && now - lastFiredAt <= comboWindowMs
    ? previousIndex + 1
    : 1;
}

export function buildPreviewInputFingerprint(
  actionId: string,
  config: PreviewPlaybackConfig,
): string {
  return `${actionId}:${JSON.stringify(config)}`;
}

export function usePreviewPlayback({
  actionId,
  config,
  comboEnabled,
  comboWindowMs,
  disabled,
  totalMs = 1000,
}: UsePreviewPlaybackOptions) {
  const [runId, setRunId] = useState(0);
  const [comboIndex, setComboIndex] = useState(1);
  const [autoPlay, setAutoPlay] = useState(false);
  const [triggerInterval, setTriggerInterval] = useState(1200);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const lastComboFireRef = useRef(0);
  const previousInputFingerprintRef = useRef<string | null>(null);

  const firePreview = useCallback(() => {
    const now = Date.now();
    setRunId((value) => (value + 1) % RUN_ID_MODULO);
    setComboIndex((previous) => getNextPreviewComboIndex(
      previous,
      lastComboFireRef.current,
      now,
      comboWindowMs,
    ));
    lastComboFireRef.current = now;
  }, [comboWindowMs]);

  const replay = useCallback(() => {
    if (!disabled) {
      setCurrentTimeMs(0);
      firePreview();
    }
  }, [disabled, firePreview]);

  const togglePlayback = useCallback(() => {
    if (disabled) return;
    if (!isPlaying && currentTimeMs >= totalMs) setCurrentTimeMs(0);
    setIsPlaying((value) => !value);
    if (!isPlaying) firePreview();
  }, [currentTimeMs, disabled, firePreview, isPlaying, totalMs]);

  useEffect(() => {
    if (!isPlaying || disabled) return undefined;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - previous) * playbackSpeed;
      previous = now;
      setCurrentTimeMs((current) => {
        const next = current + elapsed;
        if (next < totalMs) return next;
        if (loopEnabled) {
          firePreview();
          return 0;
        }
        setIsPlaying(false);
        return totalMs;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [disabled, firePreview, isPlaying, loopEnabled, playbackSpeed, totalMs]);

  useEffect(() => {
    if (disabled) {
      previousInputFingerprintRef.current = null;
      return;
    }
    const inputFingerprint = buildPreviewInputFingerprint(actionId, config);
    if (previousInputFingerprintRef.current === inputFingerprint) return;
    previousInputFingerprintRef.current = inputFingerprint;
    setCurrentTimeMs(0);
    setIsPlaying(false);
    setRunId((value) => (value + 1) % RUN_ID_MODULO);
  }, [actionId, config, disabled]);

  useEffect(() => {
    if (disabled || !autoPlay) return undefined;
    lastComboFireRef.current = 0;
    setComboIndex(1);
    const autoReplay = () => {
      setCurrentTimeMs(0);
      setIsPlaying(true);
      firePreview();
    };
    const effectiveInterval = getEffectivePreviewInterval(
      actionId,
      config.holdMs,
      triggerInterval,
    );
    autoReplay();
    const timer = window.setInterval(autoReplay, effectiveInterval);
    return () => window.clearInterval(timer);
  }, [actionId, autoPlay, config.holdMs, disabled, firePreview, triggerInterval]);

  return {
    runId,
    comboIndex: comboEnabled ? comboIndex : 1,
    autoPlay,
    triggerInterval,
    isPlaying,
    currentTimeMs,
    playbackSpeed,
    loopEnabled,
    replay,
    togglePlayback,
    stepBackward: () => setCurrentTimeMs((value) => Math.max(0, value - 20)),
    stepForward: () => setCurrentTimeMs((value) => Math.min(totalMs, value + 20)),
    seek: (value: number) => setCurrentTimeMs(Math.max(0, Math.min(totalMs, value))),
    setPlaybackSpeed,
    toggleLoop: () => setLoopEnabled((value) => !value),
    toggleAutoPlay: () => setAutoPlay((value) => !value),
    setTriggerInterval,
  };
}
