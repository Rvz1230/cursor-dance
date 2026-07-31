import {
  getActionAnimationConfig,
  getActionAudioConfig,
  getActionCursorFeedbackConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
  hasCursorOverride,
} from "../effect-core/action-config";
import type { AudioSpec, EffectSpec } from "./contracts";

export interface ActionRuntimeState {
  /** sourceActionId → 上次触发时间戳（节流） */
  lastTriggerAtByAction?: Record<string, number>;
  /** resolvedActionId → 累计触发次数 */
  actionRunCounts?: Record<string, number>;
  /** resolvedActionId → 连击窗口状态 */
  actionComboStates?: Record<string, { count: number; lastAt: number }>;
}

export interface ActionOutputSummary {
  textEnabled: boolean;
  particleEnabled: boolean;
  rippleEnabled: boolean;
  soundEnabled: boolean;
  animationEnabled: boolean;
  imageEnabled: boolean;
  cursorOverrideEnabled: boolean;
}

interface ActionOutputPlan {
  effects: EffectSpec[];
  audio?: AudioSpec;
}

export interface ActionExecutionInput {
  sourceActionId: string;
  resolvedActionId: string;
  x: number;
  y: number;
  actionConfig: Readonly<Record<string, unknown>>;
  sourceTriggerConfig: Readonly<Record<string, unknown>>;
  now: number;
  throttleMs?: number;
  force?: boolean;
}

export type ActionExecutionDecision =
  | {
      status: "skip";
      reason: "no-enabled-effects";
      outputs: ActionOutputSummary;
    }
  | {
      status: "skip";
      reason: "throttled";
      outputs: ActionOutputSummary;
      elapsedMs: number;
      throttleMs: number;
    }
  | {
      status: "fire";
      outputs: ActionOutputSummary;
      outputPlan: ActionOutputPlan;
      runIndex: number;
      comboIndex: number;
      comboWindowMs: number;
      throttleMs: number;
    };

export function getActionTimingMs(
  actionId: string,
  actionConfig: Readonly<Record<string, unknown>> | null | undefined,
): number {
  const rawValue = Number(actionConfig?.holdMs);
  const value = Number.isFinite(rawValue) ? rawValue : 0;

  if (actionId === "leftClick" || actionId === "rightClick") {
    return value === 420 ? 0 : Math.max(0, Math.min(320, value));
  }
  if (actionId === "doubleClick") {
    return value === 420 ? 320 : Math.max(180, Math.min(520, value || 320));
  }
  if (actionId === "wheel") {
    return value === 420 ? 180 : Math.max(80, Math.min(520, value || 180));
  }
  if (actionId === "hover") {
    return value === 420 ? 220 : Math.max(80, Math.min(700, value || 220));
  }
  if (actionId === "longPress") {
    return Math.max(120, Math.min(900, value || 420));
  }
  return Math.max(0, value);
}

function getComboWindowMs(
  actionConfig: Readonly<Record<string, unknown>> | undefined,
): number {
  const rawValue = Number(actionConfig?.comboWindowMs);
  return Number.isFinite(rawValue)
    ? Math.max(120, Math.min(3000, rawValue))
    : 900;
}

export function getActionOutputSummary(
  actionConfig: Readonly<Record<string, unknown>>,
): ActionOutputSummary {
  const mutableConfig = actionConfig as Record<string, unknown>;
  const textConfig = getActionTextConfig(mutableConfig);
  const particleConfig = getActionParticleConfig(mutableConfig);
  const rippleConfig = getActionRippleConfig(mutableConfig);
  const audioConfig = getActionAudioConfig(mutableConfig);
  const animationConfig = getActionAnimationConfig(mutableConfig);
  const imageConfig = getActionImageConfig(mutableConfig);
  const cursorFeedbackConfig = getActionCursorFeedbackConfig(mutableConfig);

  return {
    textEnabled: Boolean(textConfig.textEnabled),
    particleEnabled: Boolean(particleConfig.particle),
    rippleEnabled: Boolean(rippleConfig.ripple),
    soundEnabled: Boolean(audioConfig.sound),
    animationEnabled: Boolean(animationConfig.animationEnabled),
    imageEnabled: Boolean(imageConfig.imageEnabled && (imageConfig.imageDataUrl || imageConfig.imageAssetId)),
    cursorOverrideEnabled: hasCursorOverride(cursorFeedbackConfig),
  };
}

function hasEnabledActionOutput(outputs: ActionOutputSummary): boolean {
  return Object.values(outputs).some(Boolean);
}

function getThrottleMs(input: ActionExecutionInput): number {
  if (input.throttleMs !== undefined) {
    return Number.isFinite(input.throttleMs) ? Math.max(0, input.throttleMs) : 0;
  }
  if (input.sourceActionId !== "wheel" && input.sourceActionId !== "hover") return 40;

  const holdMs = Number(input.sourceTriggerConfig.holdMs);
  return Math.max(80, Number.isFinite(holdMs) ? holdMs : 80);
}

function buildOutputPlan(
  input: ActionExecutionInput,
  outputs: ActionOutputSummary,
  runIndex: number,
  comboIndex: number,
  comboWindowMs: number,
): ActionOutputPlan {
  const { x, y, actionConfig, resolvedActionId: actionId } = input;
  const effects: EffectSpec[] = [];
  if (outputs.rippleEnabled) effects.push({ kind: "ripple", x, y, actionConfig });
  if (outputs.particleEnabled) {
    effects.push({
      kind: "particle",
      x,
      y,
      actionConfig,
      actionId,
      runIndex,
      particleMode: actionConfig.particleMotionMode === "orbital" ? "orbital" : "burst",
    });
  }
  if (outputs.textEnabled) effects.push({ kind: "text", x, y, actionConfig, actionId, runIndex: comboIndex });
  if (outputs.animationEnabled) effects.push({ kind: "animation", x, y, actionConfig });
  if (outputs.imageEnabled) effects.push({ kind: "image", x, y, actionConfig });
  if (outputs.cursorOverrideEnabled) effects.push({ kind: "cursor", x, y, actionConfig });

  return {
    effects,
    audio: outputs.soundEnabled
      ? { actionConfig, actionId, comboIndex, runIndex, comboWindowMs }
      : undefined,
  };
}

export function decideActionExecution(
  state: ActionRuntimeState,
  input: ActionExecutionInput,
): ActionExecutionDecision {
  const outputs = getActionOutputSummary(input.actionConfig);
  if (!hasEnabledActionOutput(outputs)) {
    return { status: "skip", reason: "no-enabled-effects", outputs };
  }

  const throttleMs = getThrottleMs(input);
  const elapsedMs = input.now - (state.lastTriggerAtByAction?.[input.sourceActionId] || 0);
  if (!input.force && elapsedMs < throttleMs) {
    return { status: "skip", reason: "throttled", outputs, elapsedMs, throttleMs };
  }

  const lastTriggerAtByAction = state.lastTriggerAtByAction ??= {};
  const actionRunCounts = state.actionRunCounts ??= {};
  const actionComboStates = state.actionComboStates ??= {};
  lastTriggerAtByAction[input.sourceActionId] = input.now;

  const runIndex = (actionRunCounts[input.resolvedActionId] || 0) + 1;
  actionRunCounts[input.resolvedActionId] = runIndex;
  const comboWindowMs = getComboWindowMs(input.actionConfig);
  const previousComboState = actionComboStates[input.resolvedActionId] || { count: 0, lastAt: 0 };
  const comboIndex = input.now - previousComboState.lastAt <= comboWindowMs
    ? previousComboState.count + 1
    : 1;
  actionComboStates[input.resolvedActionId] = { count: comboIndex, lastAt: input.now };

  return {
    status: "fire",
    outputs,
    outputPlan: buildOutputPlan(input, outputs, runIndex, comboIndex, comboWindowMs),
    runIndex,
    comboIndex,
    comboWindowMs,
    throttleMs,
  };
}
