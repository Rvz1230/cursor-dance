import { describe, expect, it } from "vitest";
import { defaultConfig } from "@/shared/config/default-config";
import { hydrateWorkbenchState } from "../../lib/workbenchConfig";
import { buildCreateThemePayload } from "../../lib/themeWorkbenchThemeLifecycle";
import {
  buildConfigWithNewThemes,
  buildImmediateEnabledConfig,
} from "./useWorkbenchImmediatePersistence";
import { initialState } from "../themeWorkbenchStateStore";

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

  it("persists only newly added themes without applying unrelated draft edits", () => {
    const hydrated = hydrateWorkbenchState(defaultConfig, { host: "example.com", path: "/" });
    const state = structuredClone(initialState);
    state.domain = hydrated.domain;
    state.domain.themes[0].draft.actionConfigs.leftClick.textContent = "unsaved-edit";
    const added = buildCreateThemePayload(state.domain.themes, {
      name: "New Theme",
      description: "",
      basedOnThemeId: "blank",
    }).theme;
    state.domain.themes.push(added);

    const next = buildConfigWithNewThemes(defaultConfig, state);

    expect(next.themes.slice(0, defaultConfig.themes.length)).toEqual(defaultConfig.themes);
    expect(next.themes[next.themes.length - 1]?.id).toBe(added.meta.id);
    expect(next.activeThemeId).toBe(defaultConfig.activeThemeId);
    expect(next.contextRules).toEqual(defaultConfig.contextRules);
  });
});
