(function registerContentAudioRuntime(globalThis) {
  const modules = globalThis.CursorDanceContentModules || (globalThis.CursorDanceContentModules = {});

  modules.createAudioRuntime = function createAudioRuntime(runtime) {
    const {
      window,
      document,
      state,
      diagnostics,
      configStore,
    } = runtime;
    const resolveAudioDuckProfile = modules.resolveAudioDuckProfile
      || (({ audioConfig, blendMode }) => ({
        siteKey: "default",
        blendMode,
        skip: blendMode === "保持原音量",
        durationMs: Math.max(900, (audioConfig?.soundFadeOut || 120) + (audioConfig?.soundDelay || 0) + 780),
        targetVolume: blendMode === "仅插件音效" ? 0 : 0.12,
        mute: blendMode === "仅插件音效",
        reassertIntervalMs: 0,
      }));

    function getAudioContext() {
      if (state.audioContext) return state.audioContext;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      state.audioContext = new AudioContextClass();
      return state.audioContext;
    }

    function getPageMediaElements() {
      return Array.from(document.querySelectorAll("audio,video"));
    }

    function applyDuckTarget(media, duckState, duckProfile) {
      if (duckProfile.mute) {
        media.muted = true;
        media.volume = typeof duckProfile.targetVolume === "number" ? duckProfile.targetVolume : 0;
        return;
      }

      media.muted = false;
      if (typeof duckProfile.targetVolume === "number") {
        media.volume = Math.min(duckState.originalVolume, duckProfile.targetVolume);
      }
    }

    function scheduleDuckReassert(media, duckProfile, meta = {}) {
      const current = state.mediaDuckState.get(media);
      if (!current) return;
      if (current.reassertTimer) {
        window.clearInterval(current.reassertTimer);
        current.reassertTimer = null;
      }
      if (!duckProfile.reassertIntervalMs) return;

      diagnostics?.log("audio.duck.reassert-scheduled", {
        actionId: meta.actionId || null,
        blendMode: meta.blendMode || null,
        siteKey: duckProfile.siteKey || "default",
        reassertIntervalMs: duckProfile.reassertIntervalMs,
        media: diagnostics?.describeMedia(media),
      });

      current.reassertTimer = window.setInterval(() => {
        const latest = state.mediaDuckState.get(media);
        if (!latest) return;
        applyDuckTarget(media, latest, duckProfile);
        diagnostics?.log("audio.duck.reasserted", {
          actionId: meta.actionId || null,
          blendMode: meta.blendMode || null,
          siteKey: duckProfile.siteKey || "default",
          reassertIntervalMs: duckProfile.reassertIntervalMs,
          media: diagnostics?.describeMedia(media),
        });
      }, duckProfile.reassertIntervalMs);
    }

    function scheduleMediaRestore(media, duckProfile, meta = {}) {
      const current = state.mediaDuckState.get(media);
      if (!current) return;
      if (current.restoreTimer) {
        window.clearTimeout(current.restoreTimer);
      }
      diagnostics?.log("audio.duck.restore-scheduled", {
        actionId: meta.actionId || null,
        blendMode: meta.blendMode || null,
        siteKey: duckProfile.siteKey || "default",
        durationMs: duckProfile.durationMs,
        media: diagnostics?.describeMedia(media),
      });
      current.restoreTimer = window.setTimeout(() => {
        const latest = state.mediaDuckState.get(media);
        if (!latest) return;
        if (latest.reassertTimer) {
          window.clearInterval(latest.reassertTimer);
        }
        media.volume = latest.originalVolume;
        media.muted = latest.originalMuted;
        state.mediaDuckState.delete(media);
        diagnostics?.log("audio.duck.restored", {
          actionId: meta.actionId || null,
          blendMode: meta.blendMode || null,
          siteKey: duckProfile.siteKey || "default",
          durationMs: duckProfile.durationMs,
          media: diagnostics?.describeMedia(media),
        });
      }, duckProfile.durationMs);
    }

    function duckPageMedia(actionConfig, actionId) {
      const audioConfig = configStore.getActionAudioConfig(actionConfig);
      const blendMode = audioConfig.soundBlendMode || "保持原音量";
      const duckProfile = resolveAudioDuckProfile({
        hostname: window.location.hostname,
        siteKey: window.__CURSORDANCE_AUDIO_SITE_KEY__ || null,
        audioConfig,
        blendMode,
      });

      if (duckProfile.skip) {
        diagnostics?.log("audio.duck.skip", {
          actionId,
          reason: "keep-original-volume",
          blendMode,
          siteKey: duckProfile.siteKey || "default",
        });
        return;
      }
      const mediaElements = getPageMediaElements();

      diagnostics?.log("audio.duck.profile", {
        actionId,
        blendMode,
        siteKey: duckProfile.siteKey || "default",
        durationMs: duckProfile.durationMs,
        targetVolume: duckProfile.targetVolume,
        mute: duckProfile.mute,
        reassertIntervalMs: duckProfile.reassertIntervalMs,
      });
      diagnostics?.log("audio.duck.scan", {
        actionId,
        blendMode,
        siteKey: duckProfile.siteKey || "default",
        durationMs: duckProfile.durationMs,
        targetVolume: duckProfile.targetVolume,
        mediaCount: mediaElements.length,
      });

      mediaElements.forEach((media) => {
        if (!(media instanceof HTMLMediaElement)) return;
        if (media.paused && media.readyState < 2) {
          diagnostics?.log("audio.duck.target-skip", {
            actionId,
            reason: "inactive-media",
            blendMode,
            siteKey: duckProfile.siteKey || "default",
            media: diagnostics?.describeMedia(media),
          });
          return;
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
        applyDuckTarget(media, duckState, duckProfile);
        diagnostics?.log("audio.duck.target", {
          actionId,
          blendMode,
          siteKey: duckProfile.siteKey || "default",
          durationMs: duckProfile.durationMs,
          targetVolume: duckProfile.targetVolume,
          media: diagnostics?.describeMedia(media),
        });
        scheduleDuckReassert(media, duckProfile, { actionId, blendMode });
        scheduleMediaRestore(media, duckProfile, { actionId, blendMode });
        state.mediaDuckState.set(media, duckState);
      });
    }

    function getSoundPreset(soundFile) {
      if (soundFile === "woodfish-deep.wav") {
        return {
          waveform: "triangle",
          frequency: 196,
          overtone: 294,
          durationMs: 240,
          decay: 0.14,
        };
      }
      if (soundFile === "tick-light.wav") {
        return {
          waveform: "square",
          frequency: 620,
          overtone: 930,
          durationMs: 90,
          decay: 0.04,
        };
      }
      return {
        waveform: "sine",
        frequency: 262,
        overtone: 392,
        durationMs: 180,
        decay: 0.09,
      };
    }

    function playSound(actionConfig, actionId, runContext = {}) {
      const audioConfig = configStore.getActionAudioConfig(actionConfig);
      const triggerConfig = configStore.getActionTriggerConfig(actionConfig);
      if (!audioConfig.sound || (audioConfig.volume || 0) <= 0) {
        diagnostics?.log("audio.skip", {
          actionId,
          reason: "disabled-or-muted",
          soundEnabled: Boolean(audioConfig.sound),
          volume: audioConfig.volume || 0,
        });
        return;
      }

      const now = Date.now();
      const mode = audioConfig.soundTriggerMode || "每次触发";
      const throttleMs = mode === "节流播放" ? Math.max(140, audioConfig.soundDelay || 0, triggerConfig.holdMs || 0) : 0;
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
        soundDelay: audioConfig.soundDelay || 0,
        soundFadeOut: audioConfig.soundFadeOut || 0,
        soundFile: audioConfig.soundFile || "",
      });
      duckPageMedia(actionConfig, actionId);

      const context = getAudioContext();
      if (!context) {
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
        const startAt = context.currentTime + ((audioConfig.soundDelay || 0) / 1000);
        const duration = Math.max(0.06, ((audioConfig.soundFadeOut || preset.durationMs) || preset.durationMs) / 1000);
        const gainNode = context.createGain();
        const baseGain = Math.min(1, Math.max(0, (audioConfig.volume || 0) / 100) * 0.22);
        const playbackRate = Math.max(0.5, (audioConfig.playbackRate || 100) / 100);
        const comboIndex = runContext.comboIndex || 1;
        const stackBoost = mode === "连击叠加" ? Math.min(1.18, 1 + (comboIndex - 1) * 0.06) : 1;
        diagnostics?.log("audio.play", {
          actionId,
          mode,
          comboIndex,
          playbackRate,
          baseGain: Number(baseGain.toFixed(3)),
          startDelayMs: audioConfig.soundDelay || 0,
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
        diagnostics?.log("audio.skip", {
          actionId,
          reason: "playback-error",
        });
        // Audio is best-effort in content scripts; visual effects should keep working.
      }
    }

    return {
      playSound,
    };
  };
})(window);
