import { beforeEach, describe, expect, it } from "vitest";

import { createThemeDraft } from "../model/workbenchSchema";
import { buildStoredConfigFromWorkbench, hydrateWorkbenchState } from "../lib/themeDraftAdapter";
import { initialState, reducer } from "./themeWorkbenchStateStore";
import { defaultConfig } from "@/shared/config/default-config";

function installWindowStub() {
  globalThis.window = {} as Window & typeof globalThis;
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

  it("keeps editor-only navigation out of the persisted config dirty state", () => {
    const cleanState = {
      ...initialState,
      ui: {
        ...initialState.ui,
        unsaved: false,
        saveError: "previous save error",
      },
    };

    const workspaceState = reducer(cleanState, { type: "workspace/set", payload: "states" });
    const actionState = reducer(workspaceState, { type: "action/select", payload: "wheel" });
    const cursorState = reducer(actionState, { type: "cursor-state/select", payload: "pointer" });

    expect(cursorState.workspaceId).toBe("states");
    expect(cursorState.selection).toMatchObject({ actionId: "wheel", cursorStateId: "pointer" });
    expect(cursorState.ui.unsaved).toBe(false);
    expect(cursorState.ui.saveError).toBe("previous save error");
  });

  it("returns the existing state for repeated navigation and enabled values", () => {
    expect(reducer(initialState, { type: "workspace/set", payload: initialState.workspaceId })).toBe(initialState);
    expect(reducer(initialState, { type: "theme/select", payload: initialState.selection.themeId })).toBe(initialState);
    expect(reducer(initialState, { type: "action/select", payload: initialState.selection.actionId })).toBe(initialState);
    expect(reducer(initialState, { type: "cursor-state/select", payload: initialState.selection.cursorStateId })).toBe(initialState);
    expect(reducer(initialState, { type: "global-enabled/set", payload: initialState.ui.enabled })).toBe(initialState);
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
