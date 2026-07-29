import { describe, expect, it } from "vitest";
import { shouldKeepOverlaysVisible } from "./overlay-visibility";

describe("shouldKeepOverlaysVisible", () => {
  it("keeps overlays visible for the global enabled state", () => {
    expect(shouldKeepOverlaysVisible({ enabled: true, appRules: [] })).toBe(true);
  });

  it("hides overlays when globally disabled without an application opt-in", () => {
    expect(shouldKeepOverlaysVisible({
      enabled: false,
      appRules: [{
        id: "disable-code",
        pattern: { type: "exact", value: "Code", target: "process" },
        action: "disable",
        enabled: true,
      }],
    })).toBe(false);
  });

  it("keeps overlays available when an enabled application rule can opt in", () => {
    expect(shouldKeepOverlaysVisible({
      enabled: false,
      appRules: [{
        id: "enable-code",
        pattern: { type: "exact", value: "Code", target: "process" },
        action: { enable: true, theme: "drift" },
        enabled: true,
      }],
    })).toBe(true);
  });
});
