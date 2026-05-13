(function registerContentAudioRuntime(globalThis) {
  const modules = globalThis.CursorDanceContentModules || (globalThis.CursorDanceContentModules = {});

  modules.createAudioRuntime = function createAudioRuntime(runtime) {
    const {
      window,
      document,
      state,
      configStore,
    } = runtime;

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

    function scheduleMediaRestore(media, durationMs) {
      const current = state.mediaDuckState.get(media);
      if (!current) return;
      if (current.restoreTimer) {
        window.clearTimeout(current.restoreTimer);
      }
      current.restoreTimer = window.setTimeout(() => {
        const latest = state.mediaDuckState.get(media);
        if (!latest) return;
        media.volume = latest.originalVolume;
        media.muted = latest.originalMuted;
        state.mediaDuckState.delete(media);
      }, durationMs);
    }

    function duckPageMedia(actionConfig) {
      const audioConfig = configStore.getActionAudioConfig(actionConfig);
      const blendMode = audioConfig.soundBlendMode || "保持原音量";
      if (blendMode === "保持原音量") return;

      const durationMs = Math.max(900, (audioConfig.soundFadeOut || 120) + (audioConfig.soundDelay || 0) + 780);
      const targetVolume = blendMode === "仅插件音效" ? 0 : 0.12;

      getPageMediaElements().forEach((media) => {
        if (!(media instanceof HTMLMediaElement)) return;
        if (media.paused && media.readyState < 2) return;

        if (!state.mediaDuckState.has(media)) {
          state.mediaDuckState.set(media, {
            originalVolume: media.volume,
            originalMuted: media.muted,
            restoreTimer: null,
          });
        }

        const duckState = state.mediaDuckState.get(media);
        if (blendMode === "仅插件音效") {
          media.muted = true;
        } else {
          media.muted = false;
          media.volume = Math.min(duckState.originalVolume, targetVolume);
        }
        scheduleMediaRestore(media, durationMs);
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

    function playSound(actionConfig, actionId) {
      const audioConfig = configStore.getActionAudioConfig(actionConfig);
      const triggerConfig = configStore.getActionTriggerConfig(actionConfig);
      if (!audioConfig.sound || (audioConfig.volume || 0) <= 0) return;

      const now = Date.now();
      const mode = audioConfig.soundTriggerMode || "每次触发";
      const throttleMs = mode === "节流播放" ? Math.max(140, audioConfig.soundDelay || 0, triggerConfig.holdMs || 0) : 0;
      if (throttleMs && now - (state.lastSoundAtByAction[actionId] || 0) < throttleMs) return;
      state.lastSoundAtByAction[actionId] = now;
      duckPageMedia(actionConfig);

      const context = getAudioContext();
      if (!context) return;

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
        const stackBoost = mode === "连击叠加" ? Math.min(1.18, 1 + ((state.actionRunCounts[actionId] || 1) - 1) * 0.06) : 1;
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
        // Audio is best-effort in content scripts; visual effects should keep working.
      }
    }

    return {
      playSound,
    };
  };
})(window);
