import { describe, expect, it } from "vitest";

import { getRuntimeConfig, normalizeStoredConfig } from "./runtimeConfig";
import { defaultConfig } from "@/shared/config/default-config";

describe("runtimeConfig", () => {
  it("accepts complete v4 and resets incomplete data", () => {
    const valid = { ...defaultConfig, enabled: false };
    expect(normalizeStoredConfig(valid)).toBe(valid);
    expect(normalizeStoredConfig({ enabled: false })).toBe(defaultConfig);
    expect(normalizeStoredConfig(null)).toBe(defaultConfig);
  });

  it("matches v4 glob hosts carried through the path-rule editor model", () => {
    expect(getRuntimeConfig().matchPattern("docs.example.com", "/guide/start", {
      type: "path",
      hostType: "glob",
      value: "*.example.com/guide",
    })).toBe(true);
    expect(getRuntimeConfig().matchPattern("docs.example.com", "/blog", {
      type: "path",
      hostType: "glob",
      value: "*.example.com/guide",
    })).toBe(false);
  });
});
