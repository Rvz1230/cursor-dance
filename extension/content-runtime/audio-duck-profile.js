(function registerContentAudioDuckProfiles(globalThis) {
  const modules = globalThis.CursorDanceContentModules || (globalThis.CursorDanceContentModules = {});

  function normalizeHost(hostname) {
    return typeof hostname === "string" ? hostname.trim().toLowerCase() : "";
  }

  function getSiteKey(hostname, siteKeyOverride) {
    if (typeof siteKeyOverride === "string" && siteKeyOverride.trim()) {
      return siteKeyOverride.trim().toLowerCase();
    }
    const host = normalizeHost(hostname);
    if (host === "bilibili.com" || host.endsWith(".bilibili.com")) {
      return "bilibili";
    }
    return "default";
  }

  function buildBaseDuration(audioConfig) {
    return Math.max(900, (audioConfig?.soundFadeOut || 120) + (audioConfig?.soundDelay || 0) + 780);
  }

  modules.resolveAudioDuckProfile = function resolveAudioDuckProfile({ hostname, siteKey: siteKeyOverride, audioConfig, blendMode }) {
    const siteKey = getSiteKey(hostname, siteKeyOverride);
    var baseDurationMs = buildBaseDuration(audioConfig);

    if (blendMode === "保持原音量") {
      return {
        siteKey,
        blendMode: blendMode,
        skip: true,
        durationMs: 0,
        targetVolume: null,
        mute: false,
        reassertIntervalMs: 0,
      };
    }

    if (siteKey === "bilibili") {
      if (blendMode === "仅插件音效") {
        return {
          siteKey,
          blendMode,
          skip: false,
          durationMs: Math.max(1700, baseDurationMs + 620),
          targetVolume: 0,
          mute: true,
          reassertIntervalMs: 90,
        };
      }

      return {
        siteKey,
        blendMode,
        skip: false,
        durationMs: Math.max(1500, baseDurationMs + 520),
        targetVolume: 0.035,
        mute: false,
        reassertIntervalMs: 120,
      };
    }

    if (blendMode === "仅插件音效") {
      return {
        siteKey,
        blendMode: blendMode,
        skip: false,
        durationMs: baseDurationMs,
        targetVolume: 0,
        mute: true,
        reassertIntervalMs: 0,
      };
    }

    return {
      siteKey,
      blendMode: blendMode,
      skip: false,
      durationMs: baseDurationMs,
      targetVolume: 0.12,
      mute: false,
      reassertIntervalMs: 0,
    };
  };
})(window);
