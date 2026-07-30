import { useEffect, useRef, useState } from "react";
import {
  createPreviewEffectEngine,
  type PreviewEffectEngineState,
} from "@/shared/effect-runtime/preview-engine";
import { toDesktopAssetUrl } from "@/shared/asset-reference";

interface PreviewEngineConfig {
  holdMs?: number;
  [key: string]: unknown;
}

interface UsePreviewEngineHostOptions {
  actionId: string;
  actionConfigsMap?: Record<string, PreviewEngineConfig>;
  comboIndex: number;
  config: PreviewEngineConfig;
  disabled: boolean;
  runId: number;
  triggerInterval: number;
}

export type PreviewSimulationState =
  | { type: "idle" }
  | { type: "longPress-holding"; startedAt: number; thresholdMs: number }
  | { type: "doubleClick-waiting" };

export function createPreviewSimulationState(
  actionId: string,
  holdMs?: number,
  startedAt = Date.now(),
): PreviewSimulationState {
  if (actionId === "longPress") {
    return { type: "longPress-holding", startedAt, thresholdMs: holdMs || 420 };
  }
  if (actionId === "doubleClick") return { type: "doubleClick-waiting" };
  return { type: "idle" };
}

export function getLongPressProgress(
  state: Extract<PreviewSimulationState, { type: "longPress-holding" }>,
  now: number,
): number {
  return Math.min(100, ((now - state.startedAt) / state.thresholdMs) * 100);
}

export function usePreviewEngineHost({
  actionId,
  actionConfigsMap,
  comboIndex,
  config,
  disabled,
  runId,
  triggerInterval,
}: UsePreviewEngineHostOptions) {
  const effectsHostRef = useRef<HTMLDivElement | null>(null);
  const configRef = useRef(config);
  configRef.current = config;
  const actionIdRef = useRef(actionId);
  actionIdRef.current = actionId;
  const actionConfigsMapRef = useRef(actionConfigsMap);
  actionConfigsMapRef.current = actionConfigsMap;
  const engineRef = useRef<{
    engine: ReturnType<typeof createPreviewEffectEngine>;
    root: HTMLElement;
  } | null>(null);
  const doubleClickIdleTimeoutRef = useRef<number | null>(null);
  const [simulationState, setSimulationState] = useState<PreviewSimulationState>({ type: "idle" });
  const [longPressProgress, setLongPressProgress] = useState(0);

  useEffect(() => {
    const host = effectsHostRef.current;
    if (!host) return undefined;
    const uid = Math.random().toString(36).slice(2, 8);
    const constants = {
      ROOT_ID: `cursordance-preview-root-${uid}`,
      STYLE_ID: `cursordance-preview-style-${uid}`,
    };
    const engineState: PreviewEffectEngineState = { activeEffects: 0, ready: true };
    const engine = createPreviewEffectEngine({
      window,
      document,
      constants,
      state: engineState,
      resolveAssetUrl: toDesktopAssetUrl,
      getActionConfig: (requestedActionId) => {
        const map = actionConfigsMapRef.current;
        return map?.[requestedActionId] || configRef.current;
      },
    });
    const root = engine.visualEffects.ensureRoot();
    // Reparent the runtime root into the stage's transformed containing block.
    if (root.parentElement !== host) host.appendChild(root);
    root.style.position = "absolute";
    root.style.inset = "0";
    engineRef.current = { engine, root };

    return () => {
      engine.dispose();
      if (doubleClickIdleTimeoutRef.current !== null) {
        window.clearTimeout(doubleClickIdleTimeoutRef.current);
        doubleClickIdleTimeoutRef.current = null;
      }
      root.remove();
      document.getElementById(constants.STYLE_ID)?.remove();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handle = engineRef.current;
    if (disabled) {
      handle?.engine.cancelPending();
      setSimulationState({ type: "idle" });
      return;
    }
    const host = effectsHostRef.current;
    if (!handle || !host) return;
    const rect = host.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    if (doubleClickIdleTimeoutRef.current !== null) {
      window.clearTimeout(doubleClickIdleTimeoutRef.current);
      doubleClickIdleTimeoutRef.current = null;
    }

    const nextSimulationState = createPreviewSimulationState(
      actionIdRef.current,
      config.holdMs,
    );
    setSimulationState(nextSimulationState);
    if (nextSimulationState.type === "longPress-holding") setLongPressProgress(0);
    if (nextSimulationState.type === "doubleClick-waiting") {
      doubleClickIdleTimeoutRef.current = window.setTimeout(() => {
        setSimulationState({ type: "idle" });
        doubleClickIdleTimeoutRef.current = null;
      }, 300);
    }

    handle.engine.triggerAt(
      Math.round(rect.width / 2),
      Math.round(rect.height / 2),
      actionIdRef.current,
    );
    void triggerInterval;
    void comboIndex;
  }, [actionId, comboIndex, config.holdMs, disabled, runId, triggerInterval]);

  useEffect(() => {
    if (simulationState.type !== "longPress-holding") {
      setLongPressProgress(0);
      return;
    }
    let frame: number;
    const animate = () => {
      const progress = getLongPressProgress(simulationState, Date.now());
      setLongPressProgress(progress);
      if (progress < 100) frame = requestAnimationFrame(animate);
      else setSimulationState({ type: "idle" });
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [simulationState]);

  return {
    effectsHostRef,
    simulationState,
    longPressProgress,
  };
}
