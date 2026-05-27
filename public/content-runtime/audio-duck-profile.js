(function registerContentAudioDuckProfiles(globalThis) {
  const modules = globalThis.CursorDanceContentModules || (globalThis.CursorDanceContentModules = {});

  function buildBaseDuration(audioConfig) {
    return Math.max(900, (audioConfig?.soundFadeOut || 120) + (audioConfig?.soundDelay || 0) + 780);
  }

  modules.resolveAudioDuckProfile = function resolveAudioDuckProfile({ audioConfig, blendMode }) {
    var baseDurationMs = buildBaseDuration(audioConfig);

    if (blendMode === "保持原音量") {
      return {
        siteKey: "default",
        blendMode: blendMode,
        skip: true,
        durationMs: 0,
        targetVolume: null,
        mute: false,
        reassertIntervalMs: 0,
      };
    }

    if (blendMode === "仅插件音效") {
      return {
        siteKey: "default",
        blendMode: blendMode,
        skip: false,
        durationMs: baseDurationMs,
        targetVolume: 0,
        mute: true,
        reassertIntervalMs: 0,
      };
    }

    return {
      siteKey: "default",
      blendMode: blendMode,
      skip: false,
      durationMs: baseDurationMs,
      targetVolume: 0.12,
      mute: false,
      reassertIntervalMs: 0,
    };
  };
})(window);
