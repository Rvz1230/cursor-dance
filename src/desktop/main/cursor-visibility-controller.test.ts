import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCursorVisibilityController } from "./cursor-visibility-controller";

function createHelper() {
  const helper = new EventEmitter() as EventEmitter & {
    killed: boolean;
    stdin: { write: ReturnType<typeof vi.fn> };
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };
  helper.killed = false;
  helper.stdin = { write: vi.fn((_chunk, callback) => callback?.()) };
  helper.stdout = new EventEmitter();
  helper.stderr = new EventEmitter();
  helper.kill = vi.fn(() => {
    helper.killed = true;
    return true;
  });
  return helper;
}

function commands(helper: ReturnType<typeof createHelper>): string[] {
  return helper.stdin.write.mock.calls.map(([command]) => command);
}

describe("cursor visibility controller", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("waits for helper readiness and acknowledges hidden state", () => {
    const helper = createHelper();
    const log = { info: vi.fn(), error: vi.fn() };
    const controller = createCursorVisibilityController({
      spawnHelper: () => helper as never,
      log,
    });

    controller.setHidden(true);
    expect(commands(helper)).toEqual([]);
    helper.stdout.emit("data", "ready\n");
    expect(commands(helper)).toEqual(["hide\n"]);
    helper.stdout.emit("data", "hidden\n");
    expect(log.info).toHaveBeenCalledWith("[cursordance] macOS native cursor hidden: true");
    controller.stop();
  });

  it("recovers a possibly leaked hide count before re-hiding after a crash", async () => {
    const first = createHelper();
    const second = createHelper();
    const spawnHelper = vi.fn()
      .mockReturnValueOnce(first as never)
      .mockReturnValueOnce(second as never);
    const controller = createCursorVisibilityController({
      spawnHelper,
      log: { info: vi.fn(), error: vi.fn() },
    });

    controller.setHidden(true);
    first.stdout.emit("data", "ready\nhidden\n");
    first.emit("close", 1, null);
    await vi.advanceTimersByTimeAsync(100);
    second.stdout.emit("data", "ready\n");

    expect(commands(second)).toEqual(["recover\n", "hide\n"]);
    controller.stop();
  });

  it("watchdog terminates an unresponsive helper", async () => {
    const helper = createHelper();
    const controller = createCursorVisibilityController({
      spawnHelper: () => helper as never,
      log: { info: vi.fn(), error: vi.fn() },
    });

    controller.setHidden(true);
    helper.stdout.emit("data", "ready\nhidden\n");
    await vi.advanceTimersByTimeAsync(2_000);
    expect(commands(helper)).toContain("ping\n");
    await vi.advanceTimersByTimeAsync(2_000);
    expect(helper.kill).toHaveBeenCalledWith("SIGTERM");
    controller.stop();
  });

  it("restarts when the native backend reports a protocol error", () => {
    const helper = createHelper();
    const controller = createCursorVisibilityController({
      spawnHelper: () => helper as never,
      log: { info: vi.fn(), error: vi.fn() },
      platformLabel: "Windows",
    });

    controller.setHidden(true);
    helper.stdout.emit("data", "ready\nerror\n");

    expect(helper.kill).toHaveBeenCalledWith("SIGTERM");
    controller.stop();
  });

  it("stops retrying and degrades safely after repeated launch failures", async () => {
    const onUnavailable = vi.fn();
    const controller = createCursorVisibilityController({
      spawnHelper: () => { throw new Error("missing helper"); },
      log: { info: vi.fn(), error: vi.fn() },
      onUnavailable,
    });

    controller.setHidden(true);
    await vi.advanceTimersByTimeAsync(100 + 200 + 400);

    expect(onUnavailable).toHaveBeenCalledTimes(1);
    controller.stop();
  });
});
