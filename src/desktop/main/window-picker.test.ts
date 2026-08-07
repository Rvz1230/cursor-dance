import { BrowserWindow } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiveWindowSnapshot } from "../../shared/app-rules";
import { createWindowPickerController } from "./window-picker";

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: vi.fn() },
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
}));

const pickedSnapshot: ActiveWindowSnapshot = {
  authorized: true,
  owner: { name: "Code", bundleId: "com.microsoft.VSCode" },
  processName: "Code",
  title: "README",
};

describe("window picker", () => {
  let minimized = false;
  const fakeWindow = {
    minimize: vi.fn(() => { minimized = true; }),
    isMinimized: vi.fn(() => minimized),
    restore: vi.fn(() => { minimized = false; }),
    show: vi.fn(),
    focus: vi.fn(),
    isDestroyed: vi.fn(() => false),
  };
  const sender = { isDestroyed: vi.fn(() => false) };

  beforeEach(() => {
    vi.useFakeTimers();
    minimized = false;
    vi.clearAllMocks();
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(fakeWindow as never);
  });

  afterEach(() => vi.useRealTimers());

  it("waits for a real left click, reads the clicked window, then restores the workbench", async () => {
    const controller = createWindowPickerController({
      readSnapshot: () => pickedSnapshot,
      settleMs: 0,
    });
    const result = controller.begin(sender as never);

    expect(fakeWindow.minimize).toHaveBeenCalledOnce();
    controller.handleCursorEvent({ type: "mousemove", x: 1, y: 2, timestamp: 1 });
    controller.handleCursorEvent({ type: "mousedown", button: 0, x: 1, y: 2, timestamp: 2 });
    await vi.advanceTimersByTimeAsync(0);

    await expect(result).resolves.toEqual({ status: "picked", snapshot: pickedSnapshot });
    expect(fakeWindow.restore).toHaveBeenCalledOnce();
    expect(fakeWindow.focus).toHaveBeenCalledOnce();
  });

  it("cancels from the global Escape key", async () => {
    const controller = createWindowPickerController({ readSnapshot: () => pickedSnapshot });
    const result = controller.begin(sender as never);

    controller.handleKeyboardEvent({
      type: "keydown",
      keycode: 1,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      timestamp: 1,
    });

    await expect(result).resolves.toEqual({ status: "cancelled" });
    expect(fakeWindow.restore).toHaveBeenCalledOnce();
  });
});
