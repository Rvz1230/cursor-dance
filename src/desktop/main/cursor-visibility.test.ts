import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { ipcHandle, ipcRemoveHandler, spawnMock } = vi.hoisted(() => ({
  ipcHandle: vi.fn(),
  ipcRemoveHandler: vi.fn(),
  spawnMock: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: ipcHandle,
    removeHandler: ipcRemoveHandler,
  },
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

import { restoreNativeCursor, setNativeCursorHidden } from "./cursor-visibility";

function createHelper() {
  const helper = new EventEmitter() as EventEmitter & {
    killed: boolean;
    stderr: EventEmitter;
    stdin: { write: ReturnType<typeof vi.fn> };
    kill: ReturnType<typeof vi.fn>;
  };
  helper.killed = false;
  helper.stderr = new EventEmitter();
  helper.stdin = { write: vi.fn((_chunk, callback) => callback?.()) };
  helper.kill = vi.fn(() => {
    helper.killed = true;
    return true;
  });
  return helper;
}

describe("cursor visibility helper", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  afterEach(() => {
    restoreNativeCursor();
    vi.restoreAllMocks();
  });

  it("handles an asynchronous python3 spawn error without an unhandled error event", () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    const helper = createHelper();
    spawnMock.mockReturnValue(helper);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    setNativeCursorHidden(true);
    expect(() => helper.emit("error", Object.assign(new Error("spawn python3 ENOENT"), { code: "ENOENT" })))
      .not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      "[cursordance] macOS cursor helper 启动失败:",
      expect.objectContaining({ code: "ENOENT" })
    );

    expect(spawnMock).toHaveBeenCalledTimes(1);
  });
});
