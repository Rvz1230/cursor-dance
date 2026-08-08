import { describe, expect, it } from "vitest";
import { defaultConfig } from "@/shared/config/default-config";
import { shouldKeepOverlaysVisible } from "./overlay-visibility";

const codeSnapshot = {
  authorized: true as const,
  owner: { name: "Code", bundleId: "com.microsoft.VSCode" },
  processName: "Code",
  title: "README — CursorDance",
};

const safariSnapshot = {
  authorized: true as const,
  owner: { name: "Safari", bundleId: "com.apple.Safari" },
  processName: "Safari",
  title: "CursorDance",
};

describe("shouldKeepOverlaysVisible", () => {
  it("keeps overlays visible for the global enabled state", () => {
    expect(shouldKeepOverlaysVisible(defaultConfig)).toBe(true);
  });

  it("hides overlays when globally disabled without an application opt-in", () => {
    expect(shouldKeepOverlaysVisible({ ...defaultConfig, enabled: false })).toBe(false);
  });

  it("shows a globally disabled overlay only when an application opt-in matches", () => {
    const config = {
      ...defaultConfig,
      enabled: false,
      contextRules: [{
        id: "enable-code",
        context: "desktop",
        enabled: true,
        match: { type: "exact", target: "process", value: "Code" },
        action: { type: "enable", themeId: "drift" },
      }],
    };

    expect(shouldKeepOverlaysVisible(config, codeSnapshot)).toBe(true);
    expect(shouldKeepOverlaysVisible(config, safariSnapshot)).toBe(false);
  });

  it("hides a globally enabled overlay while a matching disable rule is active", () => {
    const config = {
      ...defaultConfig,
      contextRules: [{
        id: "disable-code",
        context: "desktop" as const,
        enabled: true,
        match: { type: "glob" as const, target: "title" as const, value: "*CursorDance*" },
        action: { type: "disable" as const },
      }],
    };

    expect(shouldKeepOverlaysVisible(config, codeSnapshot)).toBe(false);
    expect(shouldKeepOverlaysVisible(config, { ...safariSnapshot, title: "Example" })).toBe(true);
  });

  it("prioritizes a direct application override over an earlier advanced rule", () => {
    const config = {
      ...defaultConfig,
      contextRules: [{
        id: "advanced-disable",
        context: "desktop" as const,
        kind: "advanced" as const,
        enabled: true,
        match: { type: "glob" as const, target: "title" as const, value: "*CursorDance*" },
        action: { type: "disable" as const },
      }, {
        id: "application-enable",
        context: "desktop" as const,
        kind: "application" as const,
        enabled: true,
        match: { type: "exact" as const, target: "bundle" as const, value: "com.microsoft.VSCode" },
        action: { type: "enable" as const, themeId: "drift" },
      }],
    };

    expect(shouldKeepOverlaysVisible(config, codeSnapshot)).toBe(true);
  });

  it("falls back to the global switch when active-window access is unavailable", () => {
    const unauthorized = { authorized: false as const, message: "permission denied" };
    expect(shouldKeepOverlaysVisible(defaultConfig, unauthorized)).toBe(true);
    expect(shouldKeepOverlaysVisible({ ...defaultConfig, enabled: false }, unauthorized)).toBe(false);
  });

  it("fails open for corrupted storage until it is reset", () => {
    expect(shouldKeepOverlaysVisible({ schemaVersion: 3, enabled: false })).toBe(true);
  });
});
