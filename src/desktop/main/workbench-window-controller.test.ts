import { describe, expect, it, vi } from "vitest";
import { createWorkbenchWindowController } from "./workbench-window-controller";

type FakeWindow = ReturnType<typeof createFakeWindow>;

function createFakeWindow(options: { minimized?: boolean; destroyed?: boolean } = {}) {
  let minimized = options.minimized ?? false;
  let destroyed = options.destroyed ?? false;
  let closedListener: (() => void) | null = null;

  return {
    focus: vi.fn(),
    isDestroyed: vi.fn(() => destroyed),
    isMinimized: vi.fn(() => minimized),
    restore: vi.fn(() => { minimized = false; }),
    show: vi.fn(),
    once: vi.fn((event: "closed", listener: () => void) => {
      if (event === "closed") closedListener = listener;
    }),
    closeForTest() {
      destroyed = true;
      closedListener?.();
    },
  };
}

describe("WorkbenchWindowController", () => {
  it("creates one Workbench and reuses it on repeated open calls", () => {
    const win = createFakeWindow();
    const createWindow = vi.fn(() => win);
    const controller = createWorkbenchWindowController(createWindow);

    expect(controller.open()).toBe(win);
    expect(controller.open()).toBe(win);

    expect(createWindow).toHaveBeenCalledTimes(1);
    expect(win.show).toHaveBeenCalledTimes(1);
    expect(win.focus).toHaveBeenCalledTimes(1);
  });

  it("restores a minimized Workbench before showing and focusing it", () => {
    const win = createFakeWindow({ minimized: true });
    const controller = createWorkbenchWindowController(() => win);

    controller.open();
    controller.open();

    expect(win.restore).toHaveBeenCalledTimes(1);
    expect(win.show).toHaveBeenCalledTimes(1);
    expect(win.focus).toHaveBeenCalledTimes(1);
  });

  it("clears a closed Workbench and creates a replacement on the next open", () => {
    const first = createFakeWindow();
    const second = createFakeWindow();
    const windows: FakeWindow[] = [first, second];
    const createWindow = vi.fn(() => windows.shift()!);
    const controller = createWorkbenchWindowController(createWindow);

    controller.open();
    first.closeForTest();

    expect(controller.getCurrent()).toBeNull();
    expect(controller.open()).toBe(second);
    expect(createWindow).toHaveBeenCalledTimes(2);
  });

  it("replaces a destroyed window even if its closed event was not observed", () => {
    const destroyed = createFakeWindow({ destroyed: true });
    const replacement = createFakeWindow();
    const createWindow = vi.fn()
      .mockReturnValueOnce(destroyed)
      .mockReturnValueOnce(replacement);
    const controller = createWorkbenchWindowController(createWindow);

    expect(controller.open()).toBe(destroyed);
    expect(controller.open()).toBe(replacement);
    expect(createWindow).toHaveBeenCalledTimes(2);
  });
});
