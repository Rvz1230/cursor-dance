import { describe, expect, it } from "vitest";
import {
  ACTION_TRIGGER_FIELDS,
  getActionAudioConfig,
  getActionTriggerConfig,
} from "./action-config";

describe("shared action config helpers", () => {
  it("picks only audio fields from a larger action config", () => {
    expect(getActionAudioConfig({
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
    })).toEqual({
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

  it("keeps the trigger field contract explicit", () => {
    expect(ACTION_TRIGGER_FIELDS).toEqual(["triggerTiming", "triggerZone", "holdMs"]);
    expect(getActionTriggerConfig({
      triggerTiming: "抬起时",
      triggerZone: "当前页面可点击区域",
      holdMs: 80,
      sound: true,
    })).toEqual({
      triggerTiming: "抬起时",
      triggerZone: "当前页面可点击区域",
      holdMs: 80,
    });
  });
});
