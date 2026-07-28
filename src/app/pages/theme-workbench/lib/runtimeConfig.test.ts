import { beforeEach, describe, expect, it } from "vitest";

import { normalizeStoredConfig } from "./runtimeConfig";

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

  it("falls back to the provided config or default config without a runtime adapter", () => {
    const defaultConfig = { enabled: true, activeThemePackId: "mono-geo" };

    installWindowStub({
      CursorDanceDefaultConfig: defaultConfig,
    });

    expect(normalizeStoredConfig({ enabled: false })).toEqual({ enabled: false });
    expect(normalizeStoredConfig(null)).toEqual(defaultConfig);
  });
});
