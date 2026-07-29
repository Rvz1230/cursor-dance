import fs from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import * as sharedHelpers from "@/shared/effect-core/text-semantics";

const RUNTIME_PATH = new URL("../../../../extension/config-runtime/text-semantics.js", import.meta.url);

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

describe("extension/shared text-semantics parity", () => {
  const baseConfig = {
    textKind: "数字飘字",
    textStyle: "阿拉伯数字 (1, 2, 3)",
    textMode: "默认模式 (+1)",
    textTemplate: "+${number}",
    textContent: "",
    textTags: [],
    textTagPlayMode: "顺序播放",
    textFontFamily: "系统默认",
    comboEnabled: true,
  };

  it("infers text kind, number style and mode identically", () => {
    const effects = [
      { kind: "text", content: "命中", tags: ["命中", "Nice!"] },
      { kind: "number", content: "" },
      { content: "+${number}", numberStyle: "zh", mode: "template" },
      { content: "three", numberStyle: "en" },
    ];

    for (const effect of effects) {
      expect(runtimeHelpers.inferTextKindFromEffect(effect)).toBe(sharedHelpers.inferTextKindFromEffect(effect));
      expect(runtimeHelpers.resolveNumberStyleFromEffect(effect, baseConfig.textStyle)).toBe(
        sharedHelpers.resolveNumberStyleFromEffect(effect, baseConfig.textStyle),
      );
      expect(runtimeHelpers.resolveTextModeFromEffect(effect, baseConfig.textMode)).toBe(
        sharedHelpers.resolveTextModeFromEffect(effect, baseConfig.textMode),
      );
    }
  });

  it("hydrates and serializes stored text effects identically", () => {
    const effects = [
      { kind: "text", content: "命中", tags: ["命中", "Nice!"], fontFamily: "宋体" },
      { kind: "number", mode: "template", template: "+${number}", comboEnabled: false },
    ];

    for (const effect of effects) {
      expect(runtimeHelpers.resolveActionTextConfigFromEffect(baseConfig, effect)).toEqual(
        sharedHelpers.resolveActionTextConfigFromEffect(baseConfig, effect),
      );
    }

    const actionConfig = { ...baseConfig, textKind: "文本飘字", textContent: "命中" };
    const orderedTags = ["命中", "Nice!"];
    expect(runtimeHelpers.buildStoredTextEffectPayload(actionConfig, orderedTags)).toEqual(
      sharedHelpers.buildStoredTextEffectPayload(actionConfig, orderedTags),
    );
  });
});
