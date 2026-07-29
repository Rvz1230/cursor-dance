import fs from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import * as sharedHelpers from "@/shared/effect-core/action-config";

const RUNTIME_PATH = new URL("../../../../extension/config-runtime/action-config.js", import.meta.url);

const FIELD_GROUPS = [
  "ACTION_TRIGGER_FIELDS",
  "ACTION_TEXT_FIELDS",
  "ACTION_PARTICLE_FIELDS",
  "ACTION_RIPPLE_FIELDS",
  "ACTION_AUDIO_FIELDS",
  "ACTION_ANIMATION_FIELDS",
  "ACTION_IMAGE_FIELDS",
  "ACTION_CURSOR_FEEDBACK_FIELDS",
] as const;

type RuntimeHelpers = typeof sharedHelpers;

let runtimeHelpers: RuntimeHelpers;

beforeAll(() => {
  const globals = globalThis as typeof globalThis & {
    CursorDanceConfigHelpers?: RuntimeHelpers;
  };
  const previousWindow = globalThis.window;
  const previousHelpers = globals.CursorDanceConfigHelpers;

  globalThis.window = globalThis as typeof globalThis.window;
  globals.CursorDanceConfigHelpers = {} as RuntimeHelpers;
  new Function(fs.readFileSync(RUNTIME_PATH, "utf8"))();
  runtimeHelpers = globals.CursorDanceConfigHelpers;

  globalThis.window = previousWindow;
  globals.CursorDanceConfigHelpers = previousHelpers;
});

describe("extension/shared action-config parity", () => {
  it("keeps every action field group in the same order", () => {
    for (const groupName of FIELD_GROUPS) {
      expect(runtimeHelpers[groupName], groupName).toEqual(sharedHelpers[groupName]);
    }
  });

  it("keeps shared pure helper behavior aligned", () => {
    for (const [hex, alpha] of [["#f59e0b", 0.5], ["#fff", 1], [undefined, 0.25]] as const) {
      expect(runtimeHelpers.hexToRgba(hex, alpha)).toBe(sharedHelpers.hexToRgba(hex, alpha));
    }

    for (const easing of ["线性", "缓入", "缓入缓出", "弹跳", "弹性", "unknown"]) {
      expect(runtimeHelpers.getAnimationEasing(easing)).toBe(sharedHelpers.getAnimationEasing(easing));
    }

    for (const weight of ["加粗", "中等", "常规"]) {
      expect(runtimeHelpers.getTextWeightValue(weight)).toBe(sharedHelpers.getTextWeightValue(weight));
    }
  });

  it("does not drop delayed-effect fields when selecting runtime config", () => {
    const config = {
      textDelay: 10,
      rippleDelay: 20,
      animationDelay: 30,
      imageDelay: 40,
    };

    expect(runtimeHelpers.getActionTextConfig(config).textDelay).toBe(10);
    expect(runtimeHelpers.getActionRippleConfig(config).rippleDelay).toBe(20);
    expect(runtimeHelpers.getActionAnimationConfig(config).animationDelay).toBe(30);
    expect(runtimeHelpers.getActionImageConfig(config).imageDelay).toBe(40);
  });

  it("keeps cursor override capability detection aligned", () => {
    for (const cursorOverride of ["切换到 pointer", "木鱼（增强态）", "跟随当前状态", undefined]) {
      const config = { cursorOverride };
      expect(runtimeHelpers.hasCursorOverride(config)).toBe(sharedHelpers.hasCursorOverride(config));
    }
  });
});
