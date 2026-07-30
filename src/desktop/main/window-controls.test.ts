// window-controls IPC 单元测试
//
// 不实例化 BrowserWindow（vitest node 环境无 electron），只验证：
//   1. snapshot() 把 isMaximized / isFullScreen 透传出来
//   2. senderWindow() 在 webContents 找不到 / 已销毁时返回 null
//   3. bindWindowStateBroadcast 注册四个事件并在 unbind 时解绑
//
// IPC 注册路径（registerWindowControlsIpc / unregisterWindowControlsIpc）由
// electron-store.test 等同形态覆盖过，这里不重复 mock。

import { describe, it, expect, vi } from "vitest";

vi.mock("electron", () => ({
  BrowserWindow: {
    fromWebContents: (sender: unknown) =>
      sender && (sender as { _win?: unknown })._win ? (sender as { _win: unknown })._win : null,
  },
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
}));

import { __testing__, bindWindowStateBroadcast } from "./window-controls";

const { snapshot, senderWindow } = __testing__;

interface FakeWindow {
  isMaximized: () => boolean;
  isFullScreen: () => boolean;
  isDestroyed: () => boolean;
  webContents: { send: ReturnType<typeof vi.fn> };
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
}

function makeFakeWindow(overrides: Partial<FakeWindow> = {}): FakeWindow {
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  const win: FakeWindow = {
    isMaximized: () => false,
    isFullScreen: () => false,
    isDestroyed: () => false,
    webContents: { send: vi.fn() },
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event)!.push(handler);
      return win;
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const list = handlers.get(event);
      if (!list) return win;
      handlers.set(
        event,
        list.filter((h) => h !== handler),
      );
      return win;
    }),
    ...overrides,
  };
  return win;
}

describe("snapshot", () => {
  it("透传 isMaximized 和 isFullScreen", () => {
    const win = makeFakeWindow({
      isMaximized: () => true,
      isFullScreen: () => false,
    });
    expect(snapshot(win as unknown as Electron.BrowserWindow)).toEqual({
      isMaximized: true,
      isFullScreen: false,
    });
  });
});

describe("senderWindow", () => {
  it("找不到对应 BrowserWindow 时返回 null", () => {
    const event = { sender: {} } as unknown as Electron.IpcMainInvokeEvent;
    expect(senderWindow(event)).toBeNull();
  });

  it("窗口已销毁时返回 null", () => {
    const win = makeFakeWindow({ isDestroyed: () => true });
    const event = { sender: { _win: win } } as unknown as Electron.IpcMainInvokeEvent;
    expect(senderWindow(event)).toBeNull();
  });

  it("正常窗口透传", () => {
    const win = makeFakeWindow();
    const event = { sender: { _win: win } } as unknown as Electron.IpcMainInvokeEvent;
    expect(senderWindow(event)).toBe(win);
  });
});

describe("bindWindowStateBroadcast", () => {
  it("注册 4 个事件并在 unbind 时解绑", () => {
    const win = makeFakeWindow();
    const unbind = bindWindowStateBroadcast(win as unknown as Electron.BrowserWindow);
    expect(win.on).toHaveBeenCalledTimes(4);
    const events = (win.on as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(events).toEqual(
      expect.arrayContaining([
        "maximize",
        "unmaximize",
        "enter-full-screen",
        "leave-full-screen",
      ]),
    );

    unbind();
    expect(win.off).toHaveBeenCalledTimes(4);
  });

  it("事件触发后通过 webContents.send 推送 snapshot", () => {
    const win = makeFakeWindow({ isMaximized: () => true });
    bindWindowStateBroadcast(win as unknown as Electron.BrowserWindow);
    const handler = (win.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === "maximize",
    )![1] as () => void;
    handler();
    expect(win.webContents.send).toHaveBeenCalledWith(
      "cursordance:window-state-changed",
      { isMaximized: true, isFullScreen: false },
    );
  });

  it("窗口销毁后事件触发不会 send（防 webContents 已挂的崩溃）", () => {
    let destroyed = false;
    const win = makeFakeWindow({ isDestroyed: () => destroyed });
    bindWindowStateBroadcast(win as unknown as Electron.BrowserWindow);
    destroyed = true;
    const handler = (win.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === "maximize",
    )![1] as () => void;
    handler();
    expect(win.webContents.send).not.toHaveBeenCalled();
  });
});
