import { describe, expect, it, vi } from "vitest";
import { applyOverlaySpacePolicy, getOverlayWindowType } from "./overlay-space-policy";

function createWindowDouble() {
  const calls: string[] = [];
  return {
    calls,
    win: {
      setAlwaysOnTop: vi.fn(() => calls.push("always-on-top")),
      setVisibleOnAllWorkspaces: vi.fn(() => calls.push("visible-on-all-workspaces")),
    },
  };
}

describe("overlay Space policy", () => {
  it("uses an NSPanel on macOS so every display can join its fullscreen Spaces", () => {
    expect(getOverlayWindowType("darwin")).toBe("panel");
    expect(getOverlayWindowType("win32")).toBeUndefined();
    expect(getOverlayWindowType("linux")).toBeUndefined();
  });

  it("applies fullscreen visibility without hiding the window from Mission Control on macOS", () => {
    const { calls, win } = createWindowDouble();

    applyOverlaySpacePolicy(win as never, "darwin");

    expect(calls).toEqual(["always-on-top", "visible-on-all-workspaces"]);
    expect(win.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true, {
      visibleOnFullScreen: true,
    });
  });

  it("uses workspace visibility without macOS options on Linux", () => {
    const { calls, win } = createWindowDouble();

    applyOverlaySpacePolicy(win as never, "linux");

    expect(calls).toEqual(["always-on-top", "visible-on-all-workspaces"]);
    expect(win.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true);
  });

  it("skips the workspace API that Electron does not support on Windows", () => {
    const { calls, win } = createWindowDouble();

    applyOverlaySpacePolicy(win as never, "win32");

    expect(calls).toEqual(["always-on-top"]);
    expect(win.setVisibleOnAllWorkspaces).not.toHaveBeenCalled();
  });
});
