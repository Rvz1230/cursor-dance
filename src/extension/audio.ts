import { createAudioRuntime, type AudioRuntimeModule } from "@/shared/effect-runtime/audio-runtime";
import { resolveAudioDuckProfile, type AudioDuckProfile } from "./audio-duck-profile";

export interface MediaDuckSnapshot {
  originalVolume: number;
  originalMuted: boolean;
  restoreTimer: number | null;
  reassertTimer: number | null;
}

export interface ContentAudioState {
  audioContext?: AudioContext | null;
  lastSoundAtByAction?: Record<string, number>;
  mediaDuckState: WeakMap<HTMLMediaElement, MediaDuckSnapshot>;
}

interface ContentAudioDiagnostics {
  log(scope: string, payload: Record<string, unknown>): void;
  describeMedia?(media: HTMLMediaElement): unknown;
}

interface ContentAudioConfigStore {
  getActionAudioConfig(config: Record<string, unknown> | undefined): Record<string, unknown>;
  getActionTriggerConfig(config: Record<string, unknown> | undefined): Record<string, unknown>;
}

interface ContentAudioRuntime {
  window: Window;
  document: Document;
  state: ContentAudioState;
  diagnostics?: ContentAudioDiagnostics;
  configStore: ContentAudioConfigStore;
  reportRuntimeError?: (type: string, detail: string) => void;
}

function describeMedia(runtime: ContentAudioRuntime, media: HTMLMediaElement): unknown {
  return runtime.diagnostics?.describeMedia?.(media);
}

export function createContentAudioRuntime(runtime: ContentAudioRuntime): AudioRuntimeModule {
  const { window, document, state, diagnostics, configStore } = runtime;

  function applyDuckTarget(
    media: HTMLMediaElement,
    duckState: MediaDuckSnapshot,
    profile: AudioDuckProfile,
  ): void {
    if (profile.mute) {
      media.muted = true;
      media.volume = typeof profile.targetVolume === "number" ? profile.targetVolume : 0;
      return;
    }
    media.muted = false;
    if (typeof profile.targetVolume === "number") {
      media.volume = Math.min(duckState.originalVolume, profile.targetVolume);
    }
  }

  function scheduleDuckReassert(
    media: HTMLMediaElement,
    profile: AudioDuckProfile,
    meta: { actionId: string; blendMode: string },
  ): void {
    const current = state.mediaDuckState.get(media);
    if (!current) return;
    if (current.reassertTimer !== null) {
      window.clearInterval(current.reassertTimer);
      current.reassertTimer = null;
    }
    if (!profile.reassertIntervalMs) return;

    diagnostics?.log("audio.duck.reassert-scheduled", {
      ...meta,
      siteKey: profile.siteKey,
      reassertIntervalMs: profile.reassertIntervalMs,
      media: describeMedia(runtime, media),
    });
    current.reassertTimer = window.setInterval(() => {
      const latest = state.mediaDuckState.get(media);
      if (!latest) return;
      applyDuckTarget(media, latest, profile);
      diagnostics?.log("audio.duck.reasserted", {
        ...meta,
        siteKey: profile.siteKey,
        reassertIntervalMs: profile.reassertIntervalMs,
        media: describeMedia(runtime, media),
      });
    }, profile.reassertIntervalMs);
  }

  function scheduleMediaRestore(
    media: HTMLMediaElement,
    profile: AudioDuckProfile,
    meta: { actionId: string; blendMode: string },
  ): void {
    const current = state.mediaDuckState.get(media);
    if (!current) return;
    if (current.restoreTimer !== null) window.clearTimeout(current.restoreTimer);
    diagnostics?.log("audio.duck.restore-scheduled", {
      ...meta,
      siteKey: profile.siteKey,
      durationMs: profile.durationMs,
      media: describeMedia(runtime, media),
    });
    current.restoreTimer = window.setTimeout(() => {
      const latest = state.mediaDuckState.get(media);
      if (!latest) return;
      if (latest.reassertTimer !== null) window.clearInterval(latest.reassertTimer);
      media.volume = latest.originalVolume;
      media.muted = latest.originalMuted;
      state.mediaDuckState.delete(media);
      diagnostics?.log("audio.duck.restored", {
        ...meta,
        siteKey: profile.siteKey,
        durationMs: profile.durationMs,
        media: describeMedia(runtime, media),
      });
    }, profile.durationMs);
  }

  function duckPageMedia(actionConfig: Record<string, unknown>, actionId: string): void {
    const audioConfig = configStore.getActionAudioConfig(actionConfig);
    const blendMode = typeof audioConfig.soundBlendMode === "string"
      ? audioConfig.soundBlendMode
      : "保持原音量";
    const siteKey = (window as Window & { __CURSORDANCE_AUDIO_SITE_KEY__?: unknown })
      .__CURSORDANCE_AUDIO_SITE_KEY__;
    const profile = resolveAudioDuckProfile({
      hostname: window.location.hostname,
      siteKey,
      audioConfig,
      blendMode,
    });

    if (profile.skip) {
      diagnostics?.log("audio.duck.skip", {
        actionId,
        reason: "keep-original-volume",
        blendMode,
        siteKey: profile.siteKey,
      });
      return;
    }

    const mediaElements = Array.from(document.querySelectorAll<HTMLMediaElement>("audio,video"));
    diagnostics?.log("audio.duck.profile", {
      actionId,
      blendMode,
      siteKey: profile.siteKey,
      durationMs: profile.durationMs,
      targetVolume: profile.targetVolume,
      mute: profile.mute,
      reassertIntervalMs: profile.reassertIntervalMs,
    });
    diagnostics?.log("audio.duck.scan", {
      actionId,
      blendMode,
      siteKey: profile.siteKey,
      durationMs: profile.durationMs,
      targetVolume: profile.targetVolume,
      mediaCount: mediaElements.length,
    });

    const MediaElement = (window as Window & {
      HTMLMediaElement?: typeof HTMLMediaElement;
    }).HTMLMediaElement;
    for (const media of mediaElements) {
      if (!MediaElement || !(media instanceof MediaElement)) continue;
      if (media.paused && media.readyState < 2) {
        diagnostics?.log("audio.duck.target-skip", {
          actionId,
          reason: "inactive-media",
          blendMode,
          siteKey: profile.siteKey,
          media: describeMedia(runtime, media),
        });
        continue;
      }
      if (!state.mediaDuckState.has(media)) {
        state.mediaDuckState.set(media, {
          originalVolume: media.volume,
          originalMuted: media.muted,
          restoreTimer: null,
          reassertTimer: null,
        });
      }
      const duckState = state.mediaDuckState.get(media);
      if (!duckState) continue;
      applyDuckTarget(media, duckState, profile);
      diagnostics?.log("audio.duck.target", {
        actionId,
        blendMode,
        siteKey: profile.siteKey,
        durationMs: profile.durationMs,
        targetVolume: profile.targetVolume,
        media: describeMedia(runtime, media),
      });
      const meta = { actionId, blendMode };
      scheduleDuckReassert(media, profile, meta);
      scheduleMediaRestore(media, profile, meta);
    }
  }

  return createAudioRuntime({ ...runtime, beforePlay: duckPageMedia });
}
