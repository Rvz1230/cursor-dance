import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSystemPrompt,
  buildUserPrompt,
  selectPromptModules,
} from "../src/model-provider/prompt-builder.mjs";

describe("model prompt builder", () => {
  it("includes the extension version exactly once", () => {
    const prompt = buildUserPrompt({ prompt: "添加粒子", extensionVersion: "0.6.0" });
    assert.equal(prompt.match(/扩展版本：/g)?.length, 1);
    assert.match(prompt, /扩展版本：0\.6\.0/);
  });

  it("selects only relevant field modules plus cursor context", () => {
    assert.deepEqual(selectPromptModules("增加粒子和波纹"), ["particle", "ripple", "cursor"]);
    const systemPrompt = buildSystemPrompt("modify_action", "增加粒子");
    assert.match(systemPrompt, /粒子字段/);
    assert.match(systemPrompt, /光标反馈字段/);
    assert.doesNotMatch(systemPrompt, /音效字段/);
  });

  it("falls back to every field module for an empty prompt", () => {
    assert.deepEqual(selectPromptModules(""), [
      "text",
      "particle",
      "ripple",
      "audio",
      "cursor",
      "animation",
      "image",
    ]);
  });
});
