import { describe, expect, it } from "vitest";
import { resolveDesktopCapabilities } from "./desktop-capabilities";

describe("desktop capabilities", () => {
  it("declares the bundled macOS native helper as supported", () => {
    expect(resolveDesktopCapabilities("darwin").systemCursorReplacement).toMatchObject({
      status: "supported",
      backend: "bundled-native-helper",
    });
  });

  it("does not claim native cursor replacement on unfinished platforms", () => {
    expect(resolveDesktopCapabilities("win32").systemCursorReplacement.status).toBe("planned");
    expect(resolveDesktopCapabilities("linux").systemCursorReplacement.status).toBe("unsupported");
  });
});
