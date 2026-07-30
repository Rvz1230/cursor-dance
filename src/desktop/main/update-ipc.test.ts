import { beforeEach, describe, expect, it, vi } from "vitest";

const ipc = vi.hoisted(() => {
  const handlers = new Map<string, (event: unknown) => unknown>();
  return {
    handlers,
    handle: vi.fn((channel: string, handler: (event: unknown) => unknown) => {
      handlers.set(channel, handler);
    }),
    removeHandler: vi.fn((channel: string) => {
      handlers.delete(channel);
    }),
  };
});

vi.mock("electron", () => ({ ipcMain: ipc }));

import {
  APP_UPDATE_CHECK,
  APP_UPDATE_DOWNLOAD,
  APP_UPDATE_GET_STATE,
  APP_UPDATE_INSTALL,
} from "../../shared/ipc-channels";
import type { AutoUpdateController } from "./auto-updater";
import { __testing__, registerIpcSender } from "./ipc-security";
import { registerUpdateIpc } from "./update-ipc";

function invoke(channel: string, senderId = 1): unknown {
  const handler = ipc.handlers.get(channel);
  if (!handler) throw new Error(`No handler for ${channel}`);
  return handler({ sender: { id: senderId } });
}

describe("update IPC", () => {
  beforeEach(() => {
    ipc.handlers.clear();
    ipc.handle.mockClear();
    ipc.removeHandler.mockClear();
    __testing__.reset();
  });

  it("只向受信任 Workbench 暴露状态和显式更新操作", async () => {
    const controller: AutoUpdateController = {
      getState: vi.fn(() => ({ status: "available" as const, version: "0.7.0" })),
      checkForUpdates: vi.fn(async () => ({ status: "up-to-date" as const })),
      downloadUpdate: vi.fn(async () => ({ status: "downloaded" as const, version: "0.7.0" })),
      installUpdate: vi.fn(),
      stop: vi.fn(),
    };
    registerIpcSender({ id: 1 }, "workbench");
    registerIpcSender({ id: 2 }, "overlay");
    registerUpdateIpc(controller);

    expect(invoke(APP_UPDATE_GET_STATE)).toEqual({ status: "available", version: "0.7.0" });
    await expect(invoke(APP_UPDATE_CHECK)).resolves.toEqual({ status: "up-to-date" });
    await expect(invoke(APP_UPDATE_DOWNLOAD)).resolves.toEqual({ status: "downloaded", version: "0.7.0" });
    expect(invoke(APP_UPDATE_INSTALL)).toBeUndefined();
    expect(controller.installUpdate).toHaveBeenCalledOnce();
    expect(() => invoke(APP_UPDATE_CHECK, 2)).toThrow(/access denied/);
  });

  it("注销时移除全部 handler", () => {
    const controller = {
      getState: vi.fn(() => ({ status: "idle" as const })),
      checkForUpdates: vi.fn(async () => ({ status: "idle" as const })),
      downloadUpdate: vi.fn(async () => ({ status: "idle" as const })),
      installUpdate: vi.fn(),
      stop: vi.fn(),
    };
    const unregister = registerUpdateIpc(controller);
    expect(ipc.handlers.size).toBe(4);

    unregister();
    expect(ipc.handlers.size).toBe(0);
    expect(ipc.removeHandler).toHaveBeenCalledTimes(4);
  });
});
