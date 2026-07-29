import { describe, expect, it } from "vitest";
import { defaultConfig } from "../renderer/engine/default-config";
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
    format: "cursordance-theme",
    schemaVersion: 4,
    theme: defaultConfig.themes[0],
  });
}

describe("IPC payload contracts", () => {
  it("accepts a complete schema v4 config before persistence", () => {
    const input = { ...defaultConfig, enabled: false };
    const config = validateConfigPayload(input);
    expect(config).toBe(input);
    expect(config.schemaVersion).toBe(4);
  });

  it("rejects legacy, incomplete, unknown and oversized configs", () => {
    expect(() => validateConfigPayload({ ...defaultConfig, schemaVersion: 3 })).toThrow(/schema v4/);
    expect(() => validateConfigPayload({ ...defaultConfig, themes: [] })).toThrow(/themes/);
    expect(() => validateConfigPayload({ ...defaultConfig, editor: {} })).toThrow(/editor/);
    const oversized = { ...defaultConfig, value: "x".repeat(MAX_CONFIG_PAYLOAD_BYTES) };
    expect(() => validateConfigPayload(oversized)).toThrow(/exceeds/);
  });

  it("requires valid active theme and context-rule references", () => {
    expect(() => validateConfigPayload({ ...defaultConfig, activeThemeId: "missing" })).toThrow(/activeThemeId/);
    expect(() => validateConfigPayload({
      ...defaultConfig,
      contextRules: [{
        id: "bad-theme",
        context: "desktop",
        enabled: true,
        match: { type: "exact", target: "process", value: "Code" },
        action: { type: "enable", themeId: "missing" },
      }],
    })).toThrow(/themeId/);
  });

  it("accepts only v4 theme exports", () => {
    expect(validateSaveThemeFileRequest({
      defaultFileName: "theme.cursordance-theme.json",
      contents: validThemeContents(),
    }).defaultFileName).toBe("theme.cursordance-theme.json");
    expect(() => validateSaveThemeFileRequest({
      defaultFileName: "../theme.json",
      contents: validThemeContents(),
    })).toThrow(/must not contain a path/);
    expect(() => validateThemeFileContents("not json")).toThrow(/valid JSON/);
    expect(() => validateThemeFileContents(JSON.stringify({
      format: "cursordance-theme-pack",
      version: 1,
      themePack: defaultConfig.themes[0],
    }))).toThrow(/schema v4/);
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
