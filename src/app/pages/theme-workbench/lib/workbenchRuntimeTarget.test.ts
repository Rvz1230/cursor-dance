import { describe, expect, it, vi } from "vitest";
import {
  detectWorkbenchRuntimeTarget,
  getWorkbenchRuntimeCopy,
  openLocalRuntimePreview,
} from "./workbenchRuntimeTarget";

describe("workbench runtime target", () => {
  it("distinguishes desktop, extension and standalone Web storage", () => {
    const location = { href: "http://127.0.0.1:5173/" } as Location;
    expect(detectWorkbenchRuntimeTarget({ location, cursorDanceApp: {} })).toBe("desktop");
    expect(detectWorkbenchRuntimeTarget({
      location,
      chrome: { runtime: { id: "extension-id" }, storage: { local: {} } },
    })).toBe("extension");
    expect(detectWorkbenchRuntimeTarget({ location })).toBe("local");
  });

  it("uses truthful copy for the local workbench", () => {
    expect(getWorkbenchRuntimeCopy("local")).toMatchObject({
      applyTheme: "保存到浏览器",
      appliedTheme: "已保存到浏览器",
    });
  });

  it("navigates the current tab to the runtime preview", () => {
    const assign = vi.fn();
    expect(openLocalRuntimePreview({
      location: { href: "http://127.0.0.1:5173/index.html", assign } as unknown as Location,
    })).toBe(true);
    expect(assign).toHaveBeenCalledWith("http://127.0.0.1:5173/runtime-preview.html");
  });
});
