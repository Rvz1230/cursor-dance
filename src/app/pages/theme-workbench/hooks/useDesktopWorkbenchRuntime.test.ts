import { describe, expect, it } from "vitest";
import type { ActiveWindowSnapshot } from "@/shared/app-rules";
import { loadDesktopWorkbenchBootstrap } from "./useDesktopWorkbenchRuntime";

const activeWindow: ActiveWindowSnapshot = {
  authorized: true,
  owner: { name: "Code", bundleId: "com.microsoft.VSCode" },
  processName: "Code",
  title: "CursorDance",
};

describe("desktop Workbench bootstrap", () => {
  it("resolves the welcome state without waiting for the active-window query", async () => {
    const neverSettles = new Promise<ActiveWindowSnapshot>(() => {});
    const bootstrap = loadDesktopWorkbenchBootstrap({
      getFirstRun: async () => true,
      getActiveWindow: () => neverSettles,
      getAccessibilityState: async () => ({ status: "required" }),
    });

    await expect(bootstrap.welcomeState).resolves.toBe("open");
  });

  it("fails each independent query closed without blocking the other", async () => {
    const bootstrap = loadDesktopWorkbenchBootstrap({
      getFirstRun: async () => { throw new Error("first-run unavailable"); },
      getActiveWindow: async () => activeWindow,
      getAccessibilityState: async () => ({ status: "running" }),
    });

    await expect(bootstrap.welcomeState).resolves.toBe("closed");
    await expect(bootstrap.activeWindowSnapshot).resolves.toBe(activeWindow);
    await expect(bootstrap.accessibilityState).resolves.toEqual({ status: "running" });
  });
});
