import { beforeEach, describe, expect, it } from "vitest";

import { getRuntimeConfig, normalizeStoredConfig } from "./runtimeConfig";
import { defaultConfig } from "@/desktop/renderer/engine/default-config";

function installWindowStub(overrides = {}) {
  globalThis.window = {
    CursorDanceDefaultConfig: {},
    CursorDanceConfigRuntime: {},
    ...overrides,
  } as unknown as Window & typeof globalThis;
}

describe("runtimeConfig", () => {
  beforeEach(() => {
    installWindowStub();
  });

  it("delegates normalization to the runtime adapter when available", () => {
    const defaultConfig = { enabled: true, themePacks: [{ id: "mono-geo" }] };
    const inputConfig = { enabled: false };
    const normalizedConfig = { normalized: true };
    const calls = [];

    installWindowStub({
      CursorDanceDefaultConfig: defaultConfig,
      CursorDanceConfigRuntime: {
        normalizeConfig(value, fallbackConfig) {
          calls.push([value, fallbackConfig]);
          return normalizedConfig;
        },
      },
    });

    expect(normalizeStoredConfig(inputConfig)).toBe(normalizedConfig);
    expect(calls).toEqual([[inputConfig, defaultConfig]]);
  });

  it("accepts complete v4 and resets incomplete data without a runtime adapter", () => {
    installWindowStub({
      CursorDanceDefaultConfig: defaultConfig,
    });

    const valid = { ...defaultConfig, enabled: false };
    expect(normalizeStoredConfig(valid)).toBe(valid);
    expect(normalizeStoredConfig({ enabled: false })).toBe(defaultConfig);
    expect(normalizeStoredConfig(null)).toBe(defaultConfig);
  });

  it("matches v4 glob hosts carried through the path-rule editor model", () => {
    installWindowStub();
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
