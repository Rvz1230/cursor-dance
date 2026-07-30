import { useEffect, useRef, useState } from "react";
import { createEffectEngine, type EngineConstants, type EngineState } from "@/desktop/renderer/engine/entry";
import {
  getActionAnimationConfig,
  getActionAudioConfig,
  getActionCursorFeedbackConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
  getActionTriggerConfig,
} from "@/desktop/renderer/engine/action-config";
import { defaultKeyFeedbackConfig } from "@/shared/config/key-feedback";

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
    engine: ReturnType<typeof createEffectEngine>;
    state: EngineState;
    root: HTMLElement;
  } | null>(null);
  const doubleClickIdleTimeoutRef = useRef<number | null>(null);
  const [simulationState, setSimulationState] = useState<PreviewSimulationState>({ type: "idle" });
  const [longPressProgress, setLongPressProgress] = useState(0);

  useEffect(() => {
    const host = effectsHostRef.current;
    if (!host) return undefined;
    const uid = Math.random().toString(36).slice(2, 8);
    const constants: EngineConstants = {
      ROOT_ID: `cursordance-preview-root-${uid}`,
      STYLE_ID: `cursordance-preview-style-${uid}`,
      HIDE_CURSOR_CLASS: `cd-preview-hide-${uid}`,
    };
    const engineState: EngineState = { activeEffects: 0, ready: true };
    const previewScheme = { id: "preview" };
    // Preview adapts the current draft to the runtime ConfigStore boundary. It
    // intentionally bypasses site and target filtering inside the isolated stage.
    const configStore = {
      getActionTriggerConfig,
      getActionTextConfig,
      getActionRippleConfig,
      getActionParticleConfig,
      getActionAnimationConfig,
      getActionImageConfig,
      getActionAudioConfig,
      getActionCursorFeedbackConfig: (actionConfig) => {
        const feedback = getActionCursorFeedbackConfig(actionConfig);
        // A runtime pointer override would otherwise leak onto the Workbench body.
        return feedback.cursorOverride === "切换到 pointer"
          ? { ...feedback, cursorOverride: "跟随当前状态" }
          : feedback;
      },
      getMaxActiveEffects: () => 200,
      getKeyFeedbackConfig: () => defaultKeyFeedbackConfig,
      getConfig: () => ({ themes: [previewScheme], activeThemeId: previewScheme.id }),
      getActiveScheme: () => previewScheme,
      isCurrentSiteEnabled: () => true,
      getActionConfig: (_scheme, requestedActionId) => {
        const map = actionConfigsMapRef.current;
        return map?.[requestedActionId] || configRef.current;
      },
      getCursorStateBinding: (_scheme, _stateId, sourceActionId) => ({
        actionId: sourceActionId,
        cursorStateId: "",
      }),
      resolveCursorStateId: () => "",
      matchesTriggerZone: (_target, _zone, _event, options) => (
        options?.actionId !== "longPress" || actionIdRef.current === "longPress"
      ),
    };
    const engine = createEffectEngine({
      window,
      document,
      constants,
      state: engineState,
      configStore,
    });
    const root = engine.visualEffects.ensureRoot();
    // Reparent the runtime root into the stage's transformed containing block.
    if (root.parentElement !== host) host.appendChild(root);
    root.style.position = "absolute";
    root.style.inset = "0";
    engineRef.current = { engine, state: engineState, root };

    return () => {
      try { engine.cursorOverlay.clearStateCursorOverlay(); } catch {}
      try { engine.effectSurface.clear(); } catch {}
      try { engineState.audioContext?.close().catch(() => {}); } catch {}
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
    if (disabled) return;
    const handle = engineRef.current;
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

    handle.engine.triggerHandlers.previewAt(
      Math.round(rect.width / 2),
      Math.round(rect.height / 2),
      undefined,
      undefined,
      actionIdRef.current,
    );
    void triggerInterval;
    void comboIndex;
  }, [comboIndex, config.holdMs, disabled, runId, triggerInterval]);

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

  useEffect(() => {
    const handle = engineRef.current;
    if (!handle) return;
    handle.state.lastLeftPointerDownAt = 0;
    handle.state.lastLeftPointerUpAt = 0;
    const longPressTimeoutId = handle.state.longPressState?.timeoutId;
    if (typeof longPressTimeoutId === "number") window.clearTimeout(longPressTimeoutId);
    if (doubleClickIdleTimeoutRef.current !== null) {
      window.clearTimeout(doubleClickIdleTimeoutRef.current);
      doubleClickIdleTimeoutRef.current = null;
    }
    handle.state.longPressState = null;
    setSimulationState({ type: "idle" });
  }, [actionId]);

  return {
    effectsHostRef,
    simulationState,
    longPressProgress,
  };
}
