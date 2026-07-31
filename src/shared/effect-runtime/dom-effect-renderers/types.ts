import type { EffectHandle } from "../contracts";
import type { EffectAnimationOptions } from "../effect-lifecycle";

export type ActionConfig = Record<string, unknown>;

export interface VisualEffectsConfigStore {
  getActionTextConfig(config: ActionConfig | undefined): ActionConfig;
  getActionRippleConfig(config: ActionConfig | undefined): ActionConfig;
  getActionParticleConfig(config: ActionConfig | undefined): ActionConfig;
  getActionAnimationConfig(config: ActionConfig | undefined): ActionConfig;
  getActionImageConfig(config: ActionConfig | undefined): ActionConfig;
  getActionCursorFeedbackConfig(config: ActionConfig | undefined): ActionConfig;
  getMaxActiveEffects(): number;
}

export type AnimateEffectNode = (
  node: HTMLElement,
  keyframes: Keyframe[],
  options: EffectAnimationOptions,
) => EffectHandle;

export interface EffectGroupRegistry {
  replace(key: string, group: EffectHandle): EffectHandle;
  clear(key?: string): void;
}

export interface TimedOverride {
  apply(value: string, durationMs: number): EffectHandle;
  clear(): void;
}
