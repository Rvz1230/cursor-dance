import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  consumeSseChunk,
  readJsonSseEvents,
} from "../src/transport/sse-client.js";

function createChunkedResponse(chunks) {
  const encoder = new TextEncoder();
  const state = { cancelCount: 0, readCount: 0, released: false };
  const values = chunks.map((chunk) => encoder.encode(chunk));
  return {
    response: {
      body: {
        getReader() {
          return {
            async read() {
              const value = values[state.readCount];
              state.readCount += 1;
              return value ? { done: false, value } : { done: true };
            },
            async cancel() {
              state.cancelCount += 1;
            },
            releaseLock() {
              state.released = true;
            },
          };
        },
      },
    },
    state,
  };
}

describe("browser SSE transport", () => {
  it("keeps split event and data lines between chunks", () => {
    const first = consumeSseChunk("", "message", "event: prog");
    assert.deepEqual(first.events, []);
    const second = consumeSseChunk(
      first.remainder,
      first.eventType,
      'ress\r\ndata: {"reply":"生成中"}\r\n',
    );
    assert.deepEqual(second.events, [{ type: "progress", data: { reply: "生成中" } }]);
    assert.equal(second.remainder, "");
  });

  it("reads chunked events and flushes a final line without a newline", async () => {
    const { response, state } = createChunkedResponse([
      'event: progress\ndata: {"reply":"生',
      '成中"}\n\nevent: result\ndata: {"ok":true}',
    ]);
    const events = [];
    for await (const event of readJsonSseEvents(response)) events.push(event);

    assert.deepEqual(events, [
      { type: "progress", data: { reply: "生成中" } },
      { type: "result", data: { ok: true } },
    ]);
    assert.equal(state.cancelCount, 0);
    assert.equal(state.released, true);
  });

  it("ignores malformed JSON without losing later events", async () => {
    const { response } = createChunkedResponse([
      'event: progress\ndata: not-json\ndata: {"reply":"有效"}\n',
    ]);
    const events = [];
    for await (const event of readJsonSseEvents(response)) events.push(event);
    assert.deepEqual(events, [{ type: "progress", data: { reply: "有效" } }]);
  });

  it("cancels and releases the reader when iteration stops early", async () => {
    const { response, state } = createChunkedResponse([
      'event: result\ndata: {"ok":true}\n',
      'event: progress\ndata: {"reply":"late"}\n',
    ]);
    for await (const event of readJsonSseEvents(response)) {
      assert.equal(event.type, "result");
      break;
    }
    assert.equal(state.cancelCount, 1);
    assert.equal(state.released, true);
  });

  it("honors an already aborted signal before reading", async () => {
    const { response, state } = createChunkedResponse([]);
    const controller = new AbortController();
    controller.abort();
    const iterator = readJsonSseEvents(response, { signal: controller.signal });
    await assert.rejects(iterator.next(), { name: "AbortError" });
    assert.equal(state.readCount, 0);
    assert.equal(state.cancelCount, 1);
    assert.equal(state.released, true);
  });
});
