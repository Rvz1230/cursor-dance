import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { ipcHandle, ipcRemoveHandler, spawnMock } = vi.hoisted(() => ({
  ipcHandle: vi.fn(),
  ipcRemoveHandler: vi.fn(),
  spawnMock: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    isPackaged: false,
    getAppPath: () => "/project",
  },
  ipcMain: {
    handle: ipcHandle,
    removeHandler: ipcRemoveHandler,
  },
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

import {
  registerCursorVisibilityIpc,
  restoreNativeCursor,
  setNativeCursorHidden,
  unregisterCursorVisibilityIpc,
} from "./cursor-visibility";
import {
  __testing__ as ipcSecurityTesting,
  registerIpcSender,
} from "./ipc-security";

function createHelper() {
  const helper = new EventEmitter() as EventEmitter & {
    killed: boolean;
    stderr: EventEmitter;
    stdout: EventEmitter;
    stdin: { write: ReturnType<typeof vi.fn> };
    kill: ReturnType<typeof vi.fn>;
  };
  helper.killed = false;
  helper.stderr = new EventEmitter();
  helper.stdout = new EventEmitter();
  helper.stdin = { write: vi.fn((_chunk, callback) => callback?.()) };
  helper.kill = vi.fn(() => {
    helper.killed = true;
    return true;
  });
  return helper;
}

describe("cursor visibility helper", () => {
  beforeEach(() => {
    ipcHandle.mockReset();
    ipcRemoveHandler.mockReset();
    spawnMock.mockReset();
    ipcSecurityTesting.reset();
  });

  afterEach(() => {
    restoreNativeCursor();
    vi.restoreAllMocks();
  });

  it("starts the bundled native helper and handles an asynchronous spawn error", () => {
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

    expect(spawnMock).toHaveBeenCalledWith(
      `/project/build/native/${process.arch}/cursordance-cursor-helper`,
      [],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
  });

  it("keeps the cursor hidden until every renderer requester releases it", () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    const helper = createHelper();
    spawnMock.mockReturnValue(helper);
    registerCursorVisibilityIpc();
    const handler = ipcHandle.mock.calls[0]?.[1];
    const senderOne = Object.assign(new EventEmitter(), { id: 1 });
    const senderTwo = Object.assign(new EventEmitter(), { id: 2 });
    registerIpcSender(senderOne, "overlay");
    registerIpcSender(senderTwo, "overlay");

    handler({ sender: senderOne }, true);
    helper.stdout.emit("data", "ready\n");
    handler({ sender: senderTwo }, true);
    handler({ sender: senderOne }, false);
    expect(helper.stdin.write.mock.calls.map(([command]) => command)).toEqual(["hide\n"]);

    handler({ sender: senderTwo }, false);
    expect(helper.stdin.write.mock.calls.map(([command]) => command)).toEqual(["hide\n", "show\n"]);
    unregisterCursorVisibilityIpc();
  });

  it("releases a hidden-cursor request when its renderer is destroyed", () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    const helper = createHelper();
    spawnMock.mockReturnValue(helper);
    registerCursorVisibilityIpc();
    const handler = ipcHandle.mock.calls[0]?.[1];
    const sender = Object.assign(new EventEmitter(), { id: 7 });
    registerIpcSender(sender, "overlay");

    handler({ sender }, true);
    helper.stdout.emit("data", "ready\n");
    sender.emit("destroyed");

    expect(helper.stdin.write.mock.calls.map(([command]) => command)).toEqual(["hide\n", "show\n"]);
    unregisterCursorVisibilityIpc();
  });

  it("rejects cursor visibility requests from Workbench", () => {
    registerCursorVisibilityIpc();
    const handler = ipcHandle.mock.calls[0]?.[1];
    const sender = Object.assign(new EventEmitter(), { id: 9 });
    registerIpcSender(sender, "workbench");

    expect(() => handler({ sender }, true)).toThrow(/access denied/);
    unregisterCursorVisibilityIpc();
  });
});
