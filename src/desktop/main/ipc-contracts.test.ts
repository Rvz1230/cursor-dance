import { describe, expect, it } from "vitest";
import {
  MAX_CONFIG_PAYLOAD_BYTES,
  MAX_AI_TRANSPORT_BYTES,
  validateConfigPayload,
  validateAiCancelRequest,
  validateAiSettingsPatch,
  validateAiStreamRequest,
  validateAiTransportPayload,
  validateExternalTarget,
  validateSaveThemeFileRequest,
  validateThemeFileContents,
} from "./ipc-contracts";

function validThemeContents(): string {
  return JSON.stringify({
    format: "cursordance-theme-pack",
    version: 1,
    themePack: {
      id: "test-theme",
      workbenchDraft: { actionConfigs: {} },
    },
  });
}

function validConfig(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 3,
    enabled: true,
    activeThemePackId: "test-theme",
    themePacks: [{ id: "test-theme" }],
    siteRules: [],
    appRules: [],
    ...overrides,
  };
}

describe("IPC payload contracts", () => {
  it("accepts bounded schema v3 desktop configs before persistence", () => {
    const config = validateConfigPayload(validConfig({ enabled: false }));
    expect(config.schemaVersion).toBe(3);
    expect(config.enabled).toBe(false);
    expect(config.themePacks).toHaveLength(1);
  });

  it("rejects invalid schema versions and oversized configs", () => {
    expect(() => validateConfigPayload(validConfig({ schemaVersion: 2 }))).toThrow(/schemaVersion/);
    const oversized = validConfig({ value: "x".repeat(MAX_CONFIG_PAYLOAD_BYTES) });
    expect(() => validateConfigPayload(oversized)).toThrow(/exceeds/);
  });

  it("limits theme and rule collection sizes", () => {
    expect(() => validateConfigPayload(validConfig({ themePacks: new Array(257).fill({ id: "x" }) }))).toThrow(/themePacks/);
    expect(() => validateConfigPayload(validConfig({ appRules: new Array(1_001).fill({}) }))).toThrow(/appRules/);
  });

  it("requires a valid active theme reference", () => {
    expect(() => validateConfigPayload(validConfig({ activeThemePackId: "missing" }))).toThrow(/activeThemePackId/);
    expect(() => validateConfigPayload(validConfig({ themePacks: [{ name: "missing-id" }] }))).toThrow(/non-empty id/);
  });

  it("accepts valid theme exports and rejects paths or malformed JSON", () => {
    expect(validateSaveThemeFileRequest({
      defaultFileName: "theme.cursordance-theme.json",
      contents: validThemeContents(),
    }).defaultFileName).toBe("theme.cursordance-theme.json");
    expect(() => validateSaveThemeFileRequest({
      defaultFileName: "../theme.json",
      contents: validThemeContents(),
    })).toThrow(/must not contain a path/);
    expect(() => validateThemeFileContents("not json")).toThrow(/valid JSON/);
    expect(() => validateThemeFileContents(JSON.stringify({ hello: "world" }))).toThrow(/behavior settings/);
  });

  it("allows only bounded known AI settings fields", () => {
    expect(validateAiSettingsPatch({
      baseUrl: "https://api.example.com/v1",
      model: "model-x",
      apiMode: "responses",
    })).toEqual({
      baseUrl: "https://api.example.com/v1",
      model: "model-x",
      apiMode: "responses",
    });
    expect(() => validateAiSettingsPatch({ unexpected: "value" })).toThrow(/unknown/);
    expect(() => validateAiSettingsPatch({ baseUrl: "file:///tmp/key" })).toThrow(/protocol/);
    expect(() => validateAiSettingsPatch({ apiMode: "legacy" })).toThrow(/not supported/);
  });

  it("bounds AI transport payloads and validates request ids", () => {
    expect(validateAiTransportPayload({ prompt: "做成蓝色" })).toEqual({ prompt: "做成蓝色" });
    expect(validateAiStreamRequest({
      requestId: "request_01-test",
      payload: { prompt: "做成蓝色" },
    })).toEqual({
      requestId: "request_01-test",
      payload: { prompt: "做成蓝色" },
    });
    expect(validateAiCancelRequest({ requestId: "request_01-test" })).toEqual({ requestId: "request_01-test" });
    expect(() => validateAiStreamRequest({ requestId: "../escape", payload: {} })).toThrow(/id is invalid/);
    expect(() => validateAiTransportPayload({ prompt: "x".repeat(MAX_AI_TRANSPORT_BYTES) })).toThrow(/exceeds/);
  });

  it("bounds external targets before protocol validation", () => {
    expect(validateExternalTarget("https://example.com")).toBe("https://example.com");
    expect(() => validateExternalTarget(42)).toThrow(/bounded string/);
    expect(() => validateExternalTarget("x".repeat(4_097))).toThrow(/bounded string/);
  });
});
