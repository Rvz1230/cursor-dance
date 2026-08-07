import { describe, expect, it } from "vitest";
import { applicationNameFromBundlePath } from "./installed-applications";

describe("installed applications", () => {
  it("derives the user-facing name from a macOS application bundle", () => {
    expect(applicationNameFromBundlePath("/Applications/Visual Studio Code.app")).toBe("Visual Studio Code");
    expect(applicationNameFromBundlePath("/System/Applications/Preview.app")).toBe("Preview");
  });
});
