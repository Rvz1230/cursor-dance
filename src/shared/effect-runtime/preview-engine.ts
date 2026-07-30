import {
  getActionAnimationConfig,
  getActionAudioConfig,
  getActionCursorFeedbackConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
  getActionTriggerConfig,
} from "@/shared/effect-core/action-config";
import type { ActionRuntimeState } from "./action-state";
import { getActionTimingMs } from "./action-state";
import { createActionTriggerPipeline } from "./action-trigger-pipeline";
import { createAudioRuntime, type AudioRuntimeModule } from "./audio-runtime";
import { createVisualEffects, type VisualEffectsModule } from "./dom-effect-surface";
import { createDomEffectSurface, createWebAudioOutput } from "./output-adapters";
import type { EffectSurface } from "./contracts";

export interface PreviewEffectEngineConstants {
  ROOT_ID: string;
  STYLE_ID: string;
}

export interface PreviewEffectEngineState extends ActionRuntimeState {
  activeEffects: number;
  ready?: boolean;
  audioContext?: AudioContext | null;
  lastSoundAtByAction?: Record<string, number>;
}

export interface PreviewEffectEngineDeps {
  window: Window;
  document: Document;
  constants: PreviewEffectEngineConstants;
  state: PreviewEffectEngineState;
  getActionConfig(actionId: string): Record<string, unknown> | undefined;
  resolveAssetUrl?(assetId: string): string;
  maxActiveEffects?: number;
}

export interface PreviewEffectEngine {
  visualEffects: VisualEffectsModule;
  effectSurface: EffectSurface;
  audioRuntime: AudioRuntimeModule;
  triggerAt(x: number, y: number, actionId: string): void;
  cancelPending(): void;
  dispose(): void;
}

export function getPreviewTriggerDelayMs(
  actionId: string,
  actionConfig: Record<string, unknown> | undefined,
): number {
  if (actionId === "longPress") return getActionTimingMs(actionId, actionConfig);
  if (actionId === "doubleClick") return Math.min(getActionTimingMs(actionId, actionConfig) / 2, 80);
  return 0;
}

export function resolvePreviewImageConfig(
  actionConfig: Record<string, unknown> | undefined,
  resolveAssetUrl?: (assetId: string) => string,
): Record<string, unknown> {
  const imageConfig = getActionImageConfig(actionConfig);
  if (!imageConfig.imageDataUrl && typeof imageConfig.imageAssetId === "string") {
    imageConfig.imageDataUrl = resolveAssetUrl?.(imageConfig.imageAssetId) || "";
  }
  return imageConfig;
}

export function createPreviewEffectEngine(deps: PreviewEffectEngineDeps): PreviewEffectEngine {
  const configStore = {
    getActionTextConfig,
    getActionRippleConfig,
    getActionParticleConfig,
    getActionAnimationConfig,
    getActionImageConfig: (config: Record<string, unknown> | undefined) => (
      resolvePreviewImageConfig(config, deps.resolveAssetUrl)
    ),
    getActionAudioConfig,
    getActionTriggerConfig,
    getActionCursorFeedbackConfig: (config: Record<string, unknown> | undefined) => {
      const feedback = getActionCursorFeedbackConfig(config);
      // The preview stage must never change the Workbench page cursor.
      return feedback.cursorOverride === "切换到 pointer"
        ? { ...feedback, cursorOverride: "跟随当前状态" }
        : feedback;
    },
    getMaxActiveEffects: () => deps.maxActiveEffects || 200,
  };
  const visualEffects = createVisualEffects({
    window: deps.window,
    document: deps.document,
    constants: deps.constants,
    state: deps.state,
    configStore,
  });
  const audioRuntime = createAudioRuntime({
    window: deps.window,
    state: deps.state,
    configStore,
  });
  const effectSurface = createDomEffectSurface(visualEffects);
  const audioOutput = createWebAudioOutput(audioRuntime);
  const previewScheme = { id: "preview" };
  const { triggerAction } = createActionTriggerPipeline({
    state: deps.state,
    configStore: {
      isCurrentContextEnabled: () => true,
      getActiveScheme: () => previewScheme,
      getActionConfig: (_scheme, actionId) => deps.getActionConfig(actionId),
      getActionTriggerConfig,
      matchesTriggerZone: () => true,
      resolveCursorStateId: () => "",
      getCursorStateBinding: (_scheme, _stateId, actionId) => ({
        actionId,
        cursorStateId: "",
      }),
    },
    setTimeout: (callback, delayMs) => deps.window.setTimeout(callback, delayMs),
    renderEffect: (effect) => { effectSurface.createNode(effect); },
    playAudio: (audio) => { void audioOutput.play(audio); },
  });
  let pendingTriggerId: number | null = null;

  function fire(x: number, y: number, actionId: string): void {
    triggerAction(
      actionId,
      { x, y, target: deps.document.body, event: null },
      previewScheme,
      {
        force: true,
        resolvedActionId: actionId,
        throttleMs: 0,
        triggerSource: "workbench-preview",
      },
    );
  }

  function triggerAt(x: number, y: number, actionId: string): void {
    cancelPending();
    const delayMs = getPreviewTriggerDelayMs(actionId, deps.getActionConfig(actionId));
    if (!delayMs) {
      fire(x, y, actionId);
      return;
    }
    pendingTriggerId = deps.window.setTimeout(() => {
      pendingTriggerId = null;
      fire(x, y, actionId);
    }, delayMs);
  }

  function cancelPending(): void {
    if (pendingTriggerId !== null) deps.window.clearTimeout(pendingTriggerId);
    pendingTriggerId = null;
  }

  function dispose(): void {
    cancelPending();
    effectSurface.clear();
    void deps.state.audioContext?.close().catch(() => {});
  }

  return {
    visualEffects,
    effectSurface,
    audioRuntime,
    triggerAt,
    cancelPending,
    dispose,
  };
}
