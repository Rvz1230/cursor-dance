import type { AudioOutput } from "@/shared/effect-runtime/contracts";
import type { AudioRuntimeModule } from "../engine/types";

export function createDesktopAudioOutput(audioRuntime: AudioRuntimeModule): AudioOutput {
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
