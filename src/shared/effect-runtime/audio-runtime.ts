// Shared synthetic Web Audio playback runtime. Browser page-media ducking is
// injected through beforePlay; desktop omits that adapter.

export interface AudioRuntimeModule {
  playSound(actionConfig: Record<string, unknown>, actionId: string, runContext?: { comboIndex?: number }): void;
  suspend(): void;
}

interface AudioRuntimeState {
  audioContext?: AudioContext | null;
  lastSoundAtByAction?: Record<string, number>;
}

interface AudioRuntimeConfigStore {
  getActionAudioConfig(config: Record<string, unknown> | undefined): Record<string, unknown>;
  getActionTriggerConfig(config: Record<string, unknown> | undefined): Record<string, unknown>;
}

interface AudioRuntimeDiagnostics {
  log(scope: string, payload: Record<string, unknown>): void;
}

export interface AudioRuntimeDeps {
  window: Window;
  state: AudioRuntimeState;
  configStore: AudioRuntimeConfigStore;
  diagnostics?: AudioRuntimeDiagnostics;
  reportRuntimeError?: (type: string, detail: string) => void;
  beforePlay?: (actionConfig: Record<string, unknown>, actionId: string) => void;
}

interface SoundPreset {
  waveform: OscillatorType;
  frequency: number;
  overtone: number;
  durationMs: number;
  decay: number;
}

export function createAudioRuntime(deps: AudioRuntimeDeps): AudioRuntimeModule {
  const { window, state, configStore, diagnostics, reportRuntimeError, beforePlay } = deps;

  function getAudioContext(): AudioContext | null {
    if (state.audioContext) return state.audioContext;
    const AudioContextClass =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    state.audioContext = new AudioContextClass();
    return state.audioContext;
  }

  function getSoundPreset(soundFile: unknown): SoundPreset {
    if (soundFile === "woodfish-deep.wav") {
      return { waveform: "triangle", frequency: 196, overtone: 294, durationMs: 240, decay: 0.14 };
    }
    if (soundFile === "tick-light.wav") {
      return { waveform: "square", frequency: 620, overtone: 930, durationMs: 90, decay: 0.04 };
    }
    if (soundFile === "chime-bright.wav") {
      return { waveform: "sine", frequency: 880, overtone: 1320, durationMs: 140, decay: 0.10 };
    }
    if (soundFile === "pop-soft.wav") {
      return { waveform: "sine", frequency: 520, overtone: 780, durationMs: 50, decay: 0.02 };
    }
    if (soundFile === "swipe-whoosh.wav") {
      return { waveform: "sawtooth", frequency: 160, overtone: 240, durationMs: 180, decay: 0.05 };
    }
    return { waveform: "sine", frequency: 262, overtone: 392, durationMs: 180, decay: 0.09 };
  }

  function playSound(
    actionConfig: Record<string, unknown>,
    actionId: string,
    runContext: { comboIndex?: number } = {},
  ): void {
    const audioConfig = configStore.getActionAudioConfig(actionConfig);
    const triggerConfig = configStore.getActionTriggerConfig(actionConfig);
    const volume = (audioConfig.volume as number) || 0;
    if (!audioConfig.sound || volume <= 0) {
      diagnostics?.log("audio.skip", {
        actionId,
        reason: "disabled-or-muted",
        soundEnabled: Boolean(audioConfig.sound),
        volume,
      });
      return;
    }

    const now = Date.now();
    const mode = (audioConfig.soundTriggerMode as string) || "每次触发";
    const soundDelay = (audioConfig.soundDelay as number) || 0;
    const holdMs = (triggerConfig.holdMs as number) || 0;
    const throttleMs = mode === "节流播放" ? Math.max(140, soundDelay, holdMs) : 0;
    state.lastSoundAtByAction = state.lastSoundAtByAction || {};
    const elapsedMs = now - (state.lastSoundAtByAction[actionId] || 0);
    if (throttleMs && elapsedMs < throttleMs) {
      diagnostics?.log("audio.skip", {
        actionId,
        reason: "throttled",
        mode,
        elapsedMs,
        throttleMs,
      });
      return;
    }
    state.lastSoundAtByAction[actionId] = now;
    diagnostics?.log("audio.decision", {
      actionId,
      mode,
      throttleMs,
      blendMode: audioConfig.soundBlendMode || "保持原音量",
      soundDelay,
      soundFadeOut: audioConfig.soundFadeOut || 0,
      soundFile: audioConfig.soundFile || "",
    });
    beforePlay?.(actionConfig, actionId);

    const context = getAudioContext();
    if (!context) {
      reportRuntimeError?.("audio-context", "Web Audio API unavailable.");
      diagnostics?.log("audio.skip", {
        actionId,
        reason: "audio-context-unavailable",
      });
      return;
    }

    try {
      if (context.state === "suspended") {
        context.resume().catch(() => {});
      }

      const preset = getSoundPreset(audioConfig.soundFile);
      const startAt = context.currentTime + (soundDelay / 1000);
      const fadeOutMs = (audioConfig.soundFadeOut as number) || preset.durationMs;
      const duration = Math.max(0.06, (fadeOutMs || preset.durationMs) / 1000);
      const gainNode = context.createGain();
      const baseGain = Math.min(1, Math.max(0, volume / 100) * 0.22);
      const playbackRate = Math.max(0.5, ((audioConfig.playbackRate as number) || 100) / 100);
      const comboIndex = runContext.comboIndex || 1;
      const stackBoost = mode === "连击叠加" ? Math.min(1.18, 1 + (comboIndex - 1) * 0.06) : 1;
      diagnostics?.log("audio.play", {
        actionId,
        mode,
        comboIndex,
        playbackRate,
        baseGain: Number(baseGain.toFixed(3)),
        startDelayMs: soundDelay,
        durationMs: Math.round(duration * 1000),
      });
      gainNode.connect(context.destination);
      gainNode.gain.setValueAtTime(0.0001, startAt);
      gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, baseGain), startAt + 0.012);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration + preset.decay);

      [preset.frequency, preset.overtone].forEach((baseFrequency, index) => {
        const oscillator = context.createOscillator();
        oscillator.type = preset.waveform;
        oscillator.frequency.setValueAtTime(baseFrequency * playbackRate * stackBoost * (index === 1 ? 1.02 : 1), startAt);
        oscillator.connect(gainNode);
        oscillator.start(startAt);
        oscillator.stop(startAt + duration + preset.decay);
      });
    } catch {
      reportRuntimeError?.("audio-playback", "Audio playback failed.");
      diagnostics?.log("audio.skip", {
        actionId,
        reason: "playback-error",
      });
      // Audio is best-effort; visual effects must keep working even if WebAudio dies.
    }
  }

  function suspend(): void {
    const context = state.audioContext;
    if (!context || context.state !== "running") return;
    void context.suspend().catch(() => {});
  }

  return { playSound, suspend };
}
