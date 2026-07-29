import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORE_GET, STORE_SET } from "../../shared/ipc-channels";

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  readConfig: vi.fn<() => unknown>(),
  writeConfig: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      mocks.handlers.set(channel, handler);
    }),
    removeHandler: vi.fn(),
  },
}));

vi.mock("./electron-store", () => ({
  readConfig: mocks.readConfig,
  writeConfig: mocks.writeConfig,
  readLivePreview: vi.fn(() => null),
  writeLivePreview: vi.fn(),
  clearLivePreview: vi.fn(),
}));

import { registerStoreIpc } from "./ipc-handlers";
import { __testing__, registerIpcSender } from "./ipc-security";

function eventFor(id: number) {
  return { sender: { id } } as Electron.IpcMainInvokeEvent;
}

function validConfig(enabled: boolean) {
  return {
    schemaVersion: 3,
    enabled,
    activeThemePackId: "test-theme",
    themePacks: [{ id: "test-theme" }],
  };
}

describe("store IPC contracts", () => {
  beforeEach(() => {
    mocks.handlers.clear();
    mocks.readConfig.mockReset().mockReturnValue(null);
    mocks.writeConfig.mockReset();
    __testing__.reset();
    registerStoreIpc(() => []);
  });

  it("validates Workbench writes before persistence", () => {
    registerIpcSender({ id: 1 }, "workbench");
    const handler = mocks.handlers.get(STORE_SET)!;
    handler(eventFor(1), validConfig(false));
    expect(mocks.writeConfig).toHaveBeenCalledWith(expect.objectContaining({
      schemaVersion: 3,
      enabled: false,
      themePacks: expect.any(Array),
    }));
  });

  it("allows Overlay reads but rejects Overlay writes", () => {
    registerIpcSender({ id: 2 }, "overlay");
    expect(() => mocks.handlers.get(STORE_GET)!(eventFor(2))).not.toThrow();
    expect(() => mocks.handlers.get(STORE_SET)!(eventFor(2), validConfig(false))).toThrow(/access denied/);
    expect(mocks.writeConfig).not.toHaveBeenCalled();
  });
});
