import { describe, expect, it, vi } from "vitest";
import type { AudioRuntimeModule } from "../engine/types";
import { createDesktopAudioOutput } from "./audio-output";

describe("desktop audio output", () => {
  it("maps an audio spec to the existing Web Audio runtime", async () => {
    const audioRuntime: AudioRuntimeModule = { playSound: vi.fn() };
    const output = createDesktopAudioOutput(audioRuntime);
    const actionConfig = { sound: true, volume: 80 };

    await output.play({ actionConfig, actionId: "doubleClick", comboIndex: 4 });

    expect(audioRuntime.playSound).toHaveBeenCalledWith(
      actionConfig,
      "doubleClick",
      { comboIndex: 4 },
    );
  });
});
