import type { AudioRuntimeModule } from "./audio-runtime";
import type { VisualEffectsModule } from "./dom-effect-surface";
import type {
  AudioOutput,
  EffectHandle,
  EffectSpec,
  EffectSurface,
} from "./contracts";

function mutableConfig(spec: EffectSpec): Record<string, unknown> {
  return spec.actionConfig as Record<string, unknown>;
}

export function createDomEffectSurface(visualEffects: VisualEffectsModule): EffectSurface {
  return {
    createNode(spec): EffectHandle {
      const config = mutableConfig(spec);
      if (spec.kind === "text") {
        return visualEffects.renderText(spec.x, spec.y, config, spec.actionId || "leftClick", spec.runIndex || 1);
      }
      if (spec.kind === "ripple") return visualEffects.renderRipple(spec.x, spec.y, config);
      if (spec.kind === "particle") {
        return spec.particleMode === "orbital"
          ? visualEffects.renderOrbitalParticles(spec.x, spec.y, config, spec.runIndex || 1, spec.actionId)
          : visualEffects.renderParticles(spec.x, spec.y, config, spec.runIndex || 1);
      }
      if (spec.kind === "animation") return visualEffects.renderAnimationEffect(spec.x, spec.y, config);
      if (spec.kind === "image") return visualEffects.renderImageEffect(spec.x, spec.y, config);
      return visualEffects.renderCursorOverride(spec.x, spec.y, config);
    },
    clear() {
      visualEffects.clearEffects();
    },
  };
}

export function createWebAudioOutput(audioRuntime: AudioRuntimeModule): AudioOutput {
  return {
    async play(spec) {
      audioRuntime.playSound(
        spec.actionConfig as Record<string, unknown>,
        spec.actionId,
        { comboIndex: spec.comboIndex },
      );
    },
  };
}
