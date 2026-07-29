import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  globalThis.window = globalThis;
  await import("./audio-duck-profile.js");
});

describe("resolveAudioDuckProfile", () => {
  it("keeps generic pages on the default ducking profile", () => {
    const resolveAudioDuckProfile = globalThis.CursorDanceContentModules.resolveAudioDuckProfile;
    const profile = resolveAudioDuckProfile({
      hostname: "example.com",
      audioConfig: {
        soundDelay: 40,
        soundFadeOut: 160,
      },
      blendMode: "压低页面音频",
    });

    expect(profile).toMatchObject({
      siteKey: "default",
      targetVolume: 0.12,
      mute: false,
      reassertIntervalMs: 0,
    });
    expect(profile.durationMs).toBeGreaterThanOrEqual(980);
  });

  it("skips ducking when blendMode is keep original volume", () => {
    const resolveAudioDuckProfile = globalThis.CursorDanceContentModules.resolveAudioDuckProfile;
    const profile = resolveAudioDuckProfile({
      hostname: "example.com",
      audioConfig: {
        soundDelay: 20,
        soundFadeOut: 120,
      },
      blendMode: "保持原音量",
    });

    expect(profile).toMatchObject({
      siteKey: "default",
      skip: true,
      durationMs: 0,
      targetVolume: null,
      mute: false,
    });
  });

  it("mutes page audio when blendMode is plugin-only", () => {
    const resolveAudioDuckProfile = globalThis.CursorDanceContentModules.resolveAudioDuckProfile;
    const profile = resolveAudioDuckProfile({
      hostname: "example.com",
      audioConfig: {
        soundDelay: 0,
        soundFadeOut: 120,
      },
      blendMode: "仅插件音效",
    });

    expect(profile).toMatchObject({
      siteKey: "default",
      targetVolume: 0,
      mute: true,
      reassertIntervalMs: 0,
    });
    expect(profile.durationMs).toBeGreaterThanOrEqual(900);
  });

  it("strengthens bilibili ducking and plugin-only muting", () => {
    const resolveAudioDuckProfile = globalThis.CursorDanceContentModules.resolveAudioDuckProfile;
    const duckProfile = resolveAudioDuckProfile({
      hostname: "www.bilibili.com",
      audioConfig: { soundDelay: 20, soundFadeOut: 120 },
      blendMode: "压低页面音频",
    });
    const muteProfile = resolveAudioDuckProfile({
      hostname: "www.bilibili.com",
      audioConfig: { soundDelay: 20, soundFadeOut: 120 },
      blendMode: "仅插件音效",
    });

    expect(duckProfile).toMatchObject({
      siteKey: "bilibili",
      targetVolume: 0.035,
      mute: false,
      reassertIntervalMs: 120,
    });
    expect(muteProfile).toMatchObject({
      siteKey: "bilibili",
      targetVolume: 0,
      mute: true,
      reassertIntervalMs: 90,
    });
    expect(muteProfile.durationMs).toBeGreaterThan(duckProfile.durationMs);
  });

  it("allows a local site override for smoke validation", () => {
    const resolveAudioDuckProfile = globalThis.CursorDanceContentModules.resolveAudioDuckProfile;
    const profile = resolveAudioDuckProfile({
      hostname: "localhost",
      siteKey: "bilibili",
      audioConfig: { soundDelay: 0, soundFadeOut: 120 },
      blendMode: "仅插件音效",
    });

    expect(profile).toMatchObject({
      siteKey: "bilibili",
      targetVolume: 0,
      mute: true,
      reassertIntervalMs: 90,
    });
  });
});
