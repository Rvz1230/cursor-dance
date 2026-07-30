(function registerContentAudioRuntime(globalThis) {
  const modules = globalThis.CursorDanceContentModules || (globalThis.CursorDanceContentModules = {});
  const { createAudioRuntime: createSharedAudioRuntime } = globalThis.CursorDanceEffectRuntime || {};

  if (typeof createSharedAudioRuntime !== "function") {
    throw new Error("CursorDance shared audio runtime is not loaded.");
  }

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

    return createSharedAudioRuntime({
      ...runtime,
      beforePlay: duckPageMedia,
    });
  };
})(window);
