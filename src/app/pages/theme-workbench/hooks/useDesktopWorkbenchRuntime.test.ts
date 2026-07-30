import { describe, expect, it } from "vitest";
import type { ActiveWindowSnapshot } from "@/shared/app-rules";
import { resolveDesktopWorkbenchBootstrap } from "./useDesktopWorkbenchRuntime";

const activeWindow: ActiveWindowSnapshot = {
  authorized: true,
  owner: { name: "Code", bundleId: "com.microsoft.VSCode" },
  processName: "Code",
  title: "CursorDance",
};

describe("desktop Workbench bootstrap", () => {
  it("opens the welcome dialog and exposes the active window snapshot", () => {
    expect(resolveDesktopWorkbenchBootstrap(
      { status: "fulfilled", value: true },
      { status: "fulfilled", value: activeWindow },
    )).toEqual({
      welcomeState: "open",
      accessibilityAuthorized: true,
      activeWindowSnapshot: activeWindow,
    });
  });

  it("fails closed when desktop bootstrap queries fail", () => {
    const reason = new Error("IPC unavailable");
    expect(resolveDesktopWorkbenchBootstrap(
      { status: "rejected", reason },
      { status: "rejected", reason },
    )).toEqual({
      welcomeState: "closed",
      accessibilityAuthorized: false,
      activeWindowSnapshot: null,
    });
  });
});
