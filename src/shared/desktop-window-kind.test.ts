import { describe, expect, it } from "vitest";
import {
  desktopWindowKindArgument,
  resolveDesktopWindowKind,
} from "./desktop-window-kind";

describe("desktop preload window kind", () => {
  it("round-trips the trusted BrowserWindow argument", () => {
    expect(resolveDesktopWindowKind([desktopWindowKindArgument("workbench")])).toBe("workbench");
    expect(resolveDesktopWindowKind([desktopWindowKindArgument("overlay")])).toBe("overlay");
  });

  it("rejects missing or unknown window kinds", () => {
    expect(resolveDesktopWindowKind([])).toBeNull();
    expect(resolveDesktopWindowKind(["--cursordance-window-kind=popup"])).toBeNull();
  });

  it("uses the BrowserWindow-injected trailing argument", () => {
    expect(resolveDesktopWindowKind([
      "--cursordance-window-kind=overlay",
      desktopWindowKindArgument("workbench"),
    ])).toBe("workbench");
  });
});
