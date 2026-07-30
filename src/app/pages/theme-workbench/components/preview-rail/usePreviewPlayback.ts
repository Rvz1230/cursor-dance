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
}: UsePreviewPlaybackOptions) {
  const [runId, setRunId] = useState(0);
  const [comboIndex, setComboIndex] = useState(1);
  const [autoPlay, setAutoPlay] = useState(true);
  const [triggerInterval, setTriggerInterval] = useState(1200);
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
    if (!disabled) firePreview();
  }, [disabled, firePreview]);

  useEffect(() => {
    if (disabled) {
      previousInputFingerprintRef.current = null;
      return;
    }
    const inputFingerprint = buildPreviewInputFingerprint(actionId, config);
    if (previousInputFingerprintRef.current === inputFingerprint) return;
    previousInputFingerprintRef.current = inputFingerprint;
    setRunId((value) => (value + 1) % RUN_ID_MODULO);
  }, [actionId, config, disabled]);

  useEffect(() => {
    if (disabled || !autoPlay) return undefined;
    lastComboFireRef.current = 0;
    setComboIndex(1);
    const effectiveInterval = getEffectivePreviewInterval(
      actionId,
      config.holdMs,
      triggerInterval,
    );
    const timer = window.setInterval(firePreview, effectiveInterval);
    return () => window.clearInterval(timer);
  }, [actionId, autoPlay, config.holdMs, disabled, firePreview, triggerInterval]);

  return {
    runId,
    comboIndex: comboEnabled ? comboIndex : 1,
    autoPlay,
    triggerInterval,
    replay,
    toggleAutoPlay: () => setAutoPlay((value) => !value),
    setTriggerInterval,
  };
}
