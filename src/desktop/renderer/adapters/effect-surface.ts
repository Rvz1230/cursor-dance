import type {
  EffectHandle,
  EffectSpec,
  EffectSurface,
} from "@/shared/effect-runtime/contracts";
import type { VisualEffectsModule } from "../engine/types";

function mutableConfig(spec: EffectSpec): Record<string, unknown> {
  return spec.actionConfig as Record<string, unknown>;
}

export function createDesktopEffectSurface(visualEffects: VisualEffectsModule): EffectSurface {
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
