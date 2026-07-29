import { beforeEach, describe, expect, it } from "vitest";

import { createThemeDraft } from "../model/workbenchSchema";
import { buildStoredConfigFromWorkbench, hydrateWorkbenchState } from "../lib/themeDraftAdapter";
import { initialState, reducer } from "./themeWorkbenchStateStore";
import { defaultConfig, normalizeConfig } from "@/desktop/renderer/engine/default-config";

function installWindowStub() {
  globalThis.window = {
    CursorDanceDefaultConfig: defaultConfig,
    CursorDanceConfigRuntime: { normalizeConfig },
    CursorDanceConfigHelpers: {},
  } as unknown as Window & typeof globalThis;
}

describe("themeWorkbenchStateStore", () => {
  beforeEach(() => {
    installWindowStub();
  });
  it("resets current theme key feedback config with the theme draft defaults", () => {
    const themeId = initialState.selection.themeId;
    const draft = {
      ...createThemeDraft(themeId),
      keyFeedbackConfig: { ...createThemeDraft(themeId).keyFeedbackConfig, color: "#00FFAA", fontSize: 72 },
      resetKeyFeedbackConfig: { ...createThemeDraft(themeId).keyFeedbackConfig, color: "#22CCDD", fontSize: 66 },
    };
    const editedState = reducer(
      {
        ...initialState,
        draftsByTheme: {
          ...initialState.draftsByTheme,
          [themeId]: draft,
        },
      },
      {
        type: "key-feedback/update",
        payload: { color: "#FF00AA", fontSize: 90 },
      }
    );

    expect(editedState.draftsByTheme[themeId].keyFeedbackConfig.color).toBe("#FF00AA");

    const resetState = reducer(editedState, { type: "theme/reset-current" });

    expect(resetState.draftsByTheme[themeId].keyFeedbackConfig.color).toBe("#22CCDD");
    expect(resetState.draftsByTheme[themeId].keyFeedbackConfig.fontSize).toBe(66);
  });

  it("marks theme selection changes as unsaved so live preview switches active theme", () => {
    const themeA = initialState.selection.themeId;
    const themeB = initialState.themeLibrary.find((theme) => theme.id !== themeA)?.id;
    const selectedState = reducer(
      {
        ...initialState,
        ui: {
          ...initialState.ui,
          unsaved: false,
        },
      },
      { type: "theme/select", payload: themeB }
    );

    expect(selectedState.selection.themeId).toBe(themeB);
    expect(selectedState.ui.unsaved).toBe(true);
  });

  it("keeps key feedback configs isolated after save and theme switch", () => {
    const themeA = initialState.selection.themeId;
    const themeB = initialState.themeLibrary.find((theme) => theme.id !== themeA)?.id;
    const editedState = reducer(initialState, {
      type: "key-feedback/update",
      payload: { color: "#00FFAA", fontSize: 72 },
    });

    const storedConfig = buildStoredConfigFromWorkbench(
      defaultConfig,
      editedState
    );
    const hydratedState = hydrateWorkbenchState(storedConfig, { host: "example.com" });
    const switchedState = reducer(hydratedState, { type: "theme/select", payload: themeB });

    expect(switchedState.draftsByTheme[themeA].keyFeedbackConfig.color).toBe("#00FFAA");
    expect(switchedState.draftsByTheme[themeB].keyFeedbackConfig.color).not.toBe("#00FFAA");
    expect(switchedState.draftsByTheme[themeB].keyFeedbackConfig.fontSize).not.toBe(72);
  });
});
