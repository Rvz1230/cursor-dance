import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendToolCallDeltas,
  consumeSseChunk,
  extractReplyFromPartialJson,
  finalizeToolCalls,
  safeJsonParse,
} from "../src/model-provider/chat-completions-client.mjs";

describe("chat completions parsing", () => {
  it("extracts JSON from plain and wrapped model output", () => {
    assert.deepEqual(safeJsonParse('{"ok":true}'), { ok: true });
    assert.deepEqual(safeJsonParse('```json\n{"ok":true}\n```'), { ok: true });
    assert.equal(safeJsonParse("not json"), null);
  });

  it("extracts a completed reply from partial JSON", () => {
    assert.equal(extractReplyFromPartialJson('{"reply":"第一行\\n第二行","mode":'), "第一行\n第二行");
    assert.equal(extractReplyFromPartialJson('{"reply":"尚未结束'), null);
  });

  it("preserves incomplete SSE lines between chunks", () => {
    const first = consumeSseChunk("", 'data: {"choices":[{"del');
    assert.deepEqual(first.data, []);
    const second = consumeSseChunk(first.remainder, 'ta":{}}]}\n\ndata: [DONE]\n');
    assert.deepEqual(second.data, ['{"choices":[{"delta":{}}]}']);
    assert.equal(second.remainder, "");
  });

  it("joins streamed tool call names and JSON arguments", () => {
    const accumulator = {};
    appendToolCallDeltas(accumulator, [{
      index: 0,
      id: "call-1",
      function: { name: "apply_", arguments: '{"enabled":' },
    }]);
    appendToolCallDeltas(accumulator, [{
      index: 0,
      function: { name: "config", arguments: "true}" },
    }]);
    assert.deepEqual(finalizeToolCalls(accumulator), [{
      id: "call-1",
      name: "apply_config",
      arguments: { enabled: true },
    }]);
  });
});
