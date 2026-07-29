import { describe, expect, it } from "vitest";
import {
  buildStoredTextEffectPayload,
  resolveActionTextConfigFromEffect,
} from "./text-semantics";

const baseConfig = {
  textKind: "数字飘字",
  textStyle: "阿拉伯数字 (1, 2, 3)",
  textMode: "默认模式 (+1)",
  textTemplate: "${number}",
  textContent: "",
  textTags: [],
  textTagPlayMode: "按顺序显示",
  comboEnabled: true,
};

describe("shared text semantics", () => {
  it("preserves number semantics when tags still match the base setup", () => {
    const nextConfig = resolveActionTextConfigFromEffect(
      { ...baseConfig, textTags: ["功德 +1"] },
      { content: "功德 +1", tags: ["功德 +1"] },
    );

    expect(nextConfig).toMatchObject({ textKind: "数字飘字", comboEnabled: true, textContent: "" });
  });

  it("switches to text semantics and serializes ordered tags", () => {
    const nextConfig = resolveActionTextConfigFromEffect(baseConfig, {
      kind: "text",
      content: "命中",
      tags: ["命中", "继续"],
      tagPlayMode: "随机显示",
    });

    expect(nextConfig).toMatchObject({
      textKind: "文本飘字",
      textContent: "命中",
      textTags: ["命中", "继续"],
      comboEnabled: false,
      textTagPlayMode: "随机显示",
    });
    expect(buildStoredTextEffectPayload(nextConfig, nextConfig.textTags as string[])).toMatchObject({
      kind: "text",
      content: "命中",
      tags: ["命中", "继续"],
    });
  });
});
