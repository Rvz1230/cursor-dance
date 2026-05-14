import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  globalThis.window = globalThis;
  await import("./text-semantics.js");
});

describe("config-runtime text semantics", () => {
  it("preserves number semantics when text tags still match the base numeric setup", () => {
    const { resolveActionTextConfigFromEffect } = globalThis.CursorDanceConfigHelpers;
    const nextConfig = resolveActionTextConfigFromEffect(
      {
        textKind: "数字飘字",
        textStyle: "阿拉伯数字 (1, 2, 3)",
        textMode: "默认模式 (+1)",
        textTemplate: "${number}",
        textContent: "",
        textTags: ["功德 +1"],
        textTagPlayMode: "按顺序显示",
        comboEnabled: true,
      },
      {
        content: "功德 +1",
        tags: ["功德 +1"],
      }
    );

    expect(nextConfig).toMatchObject({
      textKind: "数字飘字",
      comboEnabled: true,
      textContent: "",
    });
  });

  it("switches to text semantics and keeps ordered tags for text payloads", () => {
    const { resolveActionTextConfigFromEffect, buildStoredTextEffectPayload } = globalThis.CursorDanceConfigHelpers;
    const nextConfig = resolveActionTextConfigFromEffect(
      {
        textKind: "数字飘字",
        textStyle: "阿拉伯数字 (1, 2, 3)",
        textMode: "默认模式 (+1)",
        textTemplate: "${number}",
        textContent: "",
        textTags: [],
        textTagPlayMode: "按顺序显示",
        comboEnabled: true,
      },
      {
        kind: "text",
        content: "命中",
        tags: ["命中", "继续"],
        tagPlayMode: "随机显示",
      }
    );

    expect(nextConfig).toMatchObject({
      textKind: "文本飘字",
      textContent: "命中",
      textTags: ["命中", "继续"],
      comboEnabled: false,
      textTagPlayMode: "随机显示",
    });

    expect(buildStoredTextEffectPayload(nextConfig, nextConfig.textTags)).toMatchObject({
      kind: "text",
      content: "命中",
      tags: ["命中", "继续"],
    });
  });
});
