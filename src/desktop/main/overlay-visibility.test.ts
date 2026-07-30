import { describe, expect, it } from "vitest";
import { defaultConfig } from "@/shared/config/default-config";
import { shouldKeepOverlaysVisible } from "./overlay-visibility";

describe("shouldKeepOverlaysVisible", () => {
  it("keeps overlays visible for the global enabled state", () => {
    expect(shouldKeepOverlaysVisible(defaultConfig)).toBe(true);
  });

  it("hides overlays when globally disabled without an application opt-in", () => {
    expect(shouldKeepOverlaysVisible({ ...defaultConfig, enabled: false })).toBe(false);
  });

  it("keeps overlays available when an enabled desktop rule can opt in", () => {
    expect(shouldKeepOverlaysVisible({
      ...defaultConfig,
      enabled: false,
      contextRules: [{
        id: "enable-code",
        context: "desktop",
        enabled: true,
        match: { type: "exact", target: "process", value: "Code" },
        action: { type: "enable", themeId: "drift" },
      }],
    })).toBe(true);
  });

  it("fails open for corrupted storage until it is reset", () => {
    expect(shouldKeepOverlaysVisible({ schemaVersion: 3, enabled: false })).toBe(true);
  });
});
