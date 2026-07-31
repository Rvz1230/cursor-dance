import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  requestAiAgentRun,
  requestAiSchemeEditStreaming,
} from "cursor-dance-api/client";

const originalFetch = globalThis.fetch;

function createSseResponse(chunks) {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    ok: true,
    status: 200,
    body: {
      getReader() {
        return {
          async read() {
            const chunk = chunks[index];
            index += 1;
            return chunk === undefined
              ? { done: true }
              : { done: false, value: encoder.encode(chunk) };
          },
          async cancel() {},
          releaseLock() {},
        };
      },
    },
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("public AI streaming client", () => {
  it("returns the proposal result and forwards progress", async () => {
    globalThis.fetch = async () => createSseResponse([
      'event: progress\ndata: {"reply":"正在生成"}\n\n',
      'event: result\ndata: {"mode":"modify_action","patch":{"sound":false}}\n\n',
    ]);
    const progress = [];
    const { result } = await requestAiSchemeEditStreaming({
      prompt: "关闭声音",
      currentConfig: { sound: true },
      actionLabel: "左键单击",
      actionId: "leftClick",
      taskMode: "modify_action",
      onProgress: (reply) => progress.push(reply),
    });

    assert.deepEqual(progress, ["正在生成"]);
    assert.deepEqual(result.patch, { sound: false });
  });

  it("collects Agent result metadata and forwards typed events", async () => {
    globalThis.fetch = async () => createSseResponse([
      'event: step_start\ndata: {"step":1}\n\n',
      'event: result\ndata: {"proposal":{"mode":"modify_action"},"totalTokens":12,"durationMs":30}\n\n',
    ]);
    const events = [];
    const { result } = await requestAiAgentRun({
      prompt: "关闭声音",
      currentConfig: { sound: true },
      actionConfigs: { leftClick: { sound: true } },
      actionLabel: "左键单击",
      actionId: "leftClick",
      taskMode: "modify_action",
      onEvent: (type, data) => events.push({ type, data }),
    });

    assert.equal(result.mode, "modify_action");
    assert.equal(result.totalTokens, 12);
    assert.equal(result.durationMs, 30);
    assert.deepEqual(events[0], { type: "step_start", data: { step: 1 } });
  });
});
