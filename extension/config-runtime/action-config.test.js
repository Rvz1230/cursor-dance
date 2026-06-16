import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  globalThis.window = globalThis;
  await import("./action-config.js");
});

describe("config-runtime action config helpers", () => {
  it("picks only audio fields from a larger action config", () => {
    const { getActionAudioConfig } = globalThis.CursorDanceConfigHelpers;
    const audioConfig = getActionAudioConfig({
      sound: true,
      volume: 88,
      playbackRate: 110,
      soundDelay: 24,
      soundFadeOut: 160,
      soundTriggerMode: "节流播放",
      soundBlendMode: "压低页面音频",
      soundFile: "woodfish-deep.wav",
      textKind: "数字飘字",
      imageEnabled: true,
    });

    expect(audioConfig).toEqual({
      sound: true,
      volume: 88,
      playbackRate: 110,
      soundDelay: 24,
      soundFadeOut: 160,
      soundTriggerMode: "节流播放",
      soundBlendMode: "压低页面音频",
      soundFile: "woodfish-deep.wav",
    });
  });

  it("exposes the shared trigger field list through the helper bundle", () => {
    const { ACTION_TRIGGER_FIELDS, getActionTriggerConfig } = globalThis.CursorDanceConfigHelpers;
    expect(ACTION_TRIGGER_FIELDS).toEqual(["triggerTiming", "triggerZone", "holdMs"]);
    expect(
      getActionTriggerConfig({
        triggerTiming: "抬起时",
        triggerZone: "当前页面可点击区域",
        holdMs: 80,
        sound: true,
      })
    ).toEqual({
      triggerTiming: "抬起时",
      triggerZone: "当前页面可点击区域",
      holdMs: 80,
    });
  });
});
