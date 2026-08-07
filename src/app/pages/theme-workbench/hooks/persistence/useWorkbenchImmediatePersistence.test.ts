import { describe, expect, it } from "vitest";
import { defaultConfig } from "@/shared/config/default-config";
import { buildImmediateEnabledConfig } from "./useWorkbenchImmediatePersistence";

describe("buildImmediateEnabledConfig", () => {
  it("changes only the enabled field on the last saved config", () => {
    const next = buildImmediateEnabledConfig(defaultConfig, false);
    expect(next).toEqual({ ...defaultConfig, enabled: false });
    expect(next?.themes).toBe(defaultConfig.themes);
    expect(next?.contextRules).toBe(defaultConfig.contextRules);
  });

  it("does not manufacture a config before hydration", () => {
    expect(buildImmediateEnabledConfig(null, false)).toBeNull();
  });
});
