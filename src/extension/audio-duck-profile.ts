export interface AudioDuckProfile {
  siteKey: string;
  blendMode: string;
  skip: boolean;
  durationMs: number;
  targetVolume: number | null;
  mute: boolean;
  reassertIntervalMs: number;
}

function getSiteKey(hostname: unknown, siteKeyOverride: unknown): string {
  if (typeof siteKeyOverride === "string" && siteKeyOverride.trim()) {
    return siteKeyOverride.trim().toLowerCase();
  }
  const host = typeof hostname === "string" ? hostname.trim().toLowerCase() : "";
  return host === "bilibili.com" || host.endsWith(".bilibili.com") ? "bilibili" : "default";
}

function numericField(config: Record<string, unknown>, key: string, fallback: number): number {
  const value = config[key];
  return typeof value === "number" && value ? value : fallback;
}

export function resolveAudioDuckProfile(options: {
  hostname?: unknown;
  siteKey?: unknown;
  audioConfig?: Record<string, unknown>;
  blendMode: string;
}): AudioDuckProfile {
  const audioConfig = options.audioConfig || {};
  const siteKey = getSiteKey(options.hostname, options.siteKey);
  const baseDurationMs = Math.max(
    900,
    numericField(audioConfig, "soundFadeOut", 120)
      + numericField(audioConfig, "soundDelay", 0)
      + 780,
  );

  if (options.blendMode === "保持原音量") {
    return {
      siteKey,
      blendMode: options.blendMode,
      skip: true,
      durationMs: 0,
      targetVolume: null,
      mute: false,
      reassertIntervalMs: 0,
    };
  }

  if (siteKey === "bilibili") {
    if (options.blendMode === "仅插件音效") {
      return {
        siteKey,
        blendMode: options.blendMode,
        skip: false,
        durationMs: Math.max(1700, baseDurationMs + 620),
        targetVolume: 0,
        mute: true,
        reassertIntervalMs: 90,
      };
    }
    return {
      siteKey,
      blendMode: options.blendMode,
      skip: false,
      durationMs: Math.max(1500, baseDurationMs + 520),
      targetVolume: 0.035,
      mute: false,
      reassertIntervalMs: 120,
    };
  }

  return {
    siteKey,
    blendMode: options.blendMode,
    skip: false,
    durationMs: baseDurationMs,
    targetVolume: options.blendMode === "仅插件音效" ? 0 : 0.12,
    mute: options.blendMode === "仅插件音效",
    reassertIntervalMs: 0,
  };
}
