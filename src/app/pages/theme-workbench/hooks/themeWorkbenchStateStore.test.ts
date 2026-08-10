import { beforeEach, describe, expect, it } from "vitest";

import { createThemeDraft } from "../model/workbenchSchema";
import { buildStoredConfigFromWorkbench, hydrateWorkbenchState } from "../lib/themeDraftAdapter";
import { initialState, reducer } from "./themeWorkbenchStateStore";
import { defaultConfig } from "@/shared/config/default-config";
import { findWorkbenchTheme } from "./workbenchThemeSelectors";

function installWindowStub() {
  globalThis.window = {} as Window & typeof globalThis;
}

describe("themeWorkbenchStateStore", () => {
  beforeEach(() => {
    installWindowStub();
  });
  it("resets current theme key feedback config with the theme draft defaults", () => {
    const themeId = initialState.domain.activeThemeId;
    const draft = {
      ...createThemeDraft(themeId),
      keyFeedbackConfig: { ...createThemeDraft(themeId).keyFeedbackConfig, color: "#00FFAA", fontSize: 72 },
      resetKeyFeedbackConfig: { ...createThemeDraft(themeId).keyFeedbackConfig, color: "#22CCDD", fontSize: 66 },
    };
    const editedState = reducer(
      {
        ...initialState,
        domain: {
          ...initialState.domain,
          themes: initialState.domain.themes.map((theme) =>
            theme.meta.id === themeId ? { ...theme, draft } : theme
          ),
        },
      },
      {
        type: "theme/update-current",
        payload: (current) => ({
          ...current,
          keyFeedbackConfig: { ...current.keyFeedbackConfig, color: "#FF00AA", fontSize: 90 },
        }),
      }
    );

    expect(findWorkbenchTheme(editedState.domain.themes, themeId)?.draft.keyFeedbackConfig.color).toBe("#FF00AA");

    const resetState = reducer(editedState, { type: "theme/reset-current" });

    expect(findWorkbenchTheme(resetState.domain.themes, themeId)?.draft.keyFeedbackConfig.color).toBe("#22CCDD");
    expect(findWorkbenchTheme(resetState.domain.themes, themeId)?.draft.keyFeedbackConfig.fontSize).toBe(66);
  });

  it("marks theme selection changes as unsaved so live preview switches active theme", () => {
    const themeA = initialState.domain.activeThemeId;
    const themeB = initialState.domain.themes.find((theme) => theme.meta.id !== themeA)?.meta.id;
    const selectedState = reducer(
      {
        ...initialState,
        status: {
          ...initialState.status,
          unsaved: false,
        },
      },
      { type: "theme/select", payload: themeB }
    );

    expect(selectedState.domain.activeThemeId).toBe(themeB);
    expect(selectedState.status.unsaved).toBe(true);
  });

  it("adds, edits, and removes metadata with its draft as one theme aggregate", () => {
    const themeId = "aggregate-theme";
    const addedState = reducer(initialState, {
      type: "theme/add",
      payload: {
        theme: {
          meta: {
            id: themeId,
            name: "聚合主题",
            kind: "自定义",
            summary: "聚合状态回归",
            tone: "amber",
          },
          draft: createThemeDraft(themeId),
        },
      },
    });

    const renamedState = reducer(addedState, {
      type: "theme/rename",
      payload: { themeId, name: "聚合主题 2" },
    });
    const aggregate = findWorkbenchTheme(renamedState.domain.themes, themeId);
    expect(aggregate?.meta.name).toBe("聚合主题 2");
    expect(aggregate?.draft.actionConfigs.leftClick).toBeDefined();

    const removedState = reducer(renamedState, {
      type: "theme/remove",
      payload: { themeId, nextSelectedThemeId: initialState.domain.activeThemeId },
    });
    expect(findWorkbenchTheme(removedState.domain.themes, themeId)).toBeUndefined();
  });

  it("keeps editor-only navigation out of the persisted config dirty state", () => {
    const cleanState = {
      ...initialState,
      status: {
        ...initialState.status,
        unsaved: false,
        saveError: "previous save error",
      },
    };

    const workspaceState = reducer(cleanState, { type: "workspace/set", payload: "states" });
    const actionState = reducer(workspaceState, { type: "action/select", payload: "wheel" });
    const cursorState = reducer(actionState, { type: "cursor-state/select", payload: "pointer" });

    expect(cursorState.editor).toMatchObject({ workspaceId: "states", actionId: "wheel", cursorStateId: "pointer" });
    expect(cursorState.status.unsaved).toBe(false);
    expect(cursorState.status.saveError).toBe("previous save error");
    expect(cursorState.domain).toBe(cleanState.domain);
    expect(cursorState.status).toBe(cleanState.status);
  });

  it("preserves editor navigation when an external config hydration arrives", () => {
    const navigatedState = {
      ...initialState,
      editor: { workspaceId: "states", actionId: "wheel", cursorStateId: "pointer" },
    };
    const hydratedState = reducer(navigatedState, {
      type: "hydrate",
      payload: hydrateWorkbenchState(defaultConfig, { host: "example.com" }),
    });

    expect(hydratedState.editor).toEqual(navigatedState.editor);
    expect(hydratedState.domain.activeThemeId).toBe(defaultConfig.activeThemeId);
  });

  it("composes editor, rules, and lifecycle reducers without changing unrelated partitions", () => {
    const editorState = reducer(initialState, { type: "workspace/set", payload: "sites" });
    const rulesState = reducer(editorState, {
      type: "rules/add",
      payload: {
        collection: "siteRules",
        rule: {
          id: "docs-rule",
          pattern: { type: "exact", value: "docs.example.com" },
          action: "disable",
        },
      },
    });

    expect(rulesState.editor).toBe(editorState.editor);
    expect(rulesState.domain.siteRules).toHaveLength(1);
    expect(rulesState.domain.themes).toBe(editorState.domain.themes);
    expect(rulesState.runtime).toBe(editorState.runtime);

    const savingState = reducer(rulesState, { type: "save/start" });
    expect(savingState.domain).toBe(rulesState.domain);
    expect(savingState.editor).toBe(rulesState.editor);
    expect(savingState.status.isSaving).toBe(true);
  });

  it("returns the existing state for repeated navigation and enabled values", () => {
    expect(reducer(initialState, { type: "workspace/set", payload: initialState.editor.workspaceId })).toBe(initialState);
    expect(reducer(initialState, { type: "theme/select", payload: initialState.domain.activeThemeId })).toBe(initialState);
    expect(reducer(initialState, { type: "action/select", payload: initialState.editor.actionId })).toBe(initialState);
    expect(reducer(initialState, { type: "cursor-state/select", payload: initialState.editor.cursorStateId })).toBe(initialState);
    expect(reducer(initialState, { type: "global-enabled/set", payload: initialState.domain.enabled })).toBe(initialState);
  });

  it("keeps key feedback configs isolated after save and theme switch", () => {
    const themeA = initialState.domain.activeThemeId;
    const themeB = initialState.domain.themes.find((theme) => theme.meta.id !== themeA)?.meta.id;
    const editedState = reducer(initialState, {
      type: "theme/update-current",
      payload: (current) => ({
        ...current,
        keyFeedbackConfig: { ...current.keyFeedbackConfig, color: "#00FFAA", fontSize: 72 },
      }),
    });

    const storedConfig = buildStoredConfigFromWorkbench(
      defaultConfig,
      editedState
    );
    const hydratedState = reducer(initialState, {
      type: "hydrate",
      payload: hydrateWorkbenchState(storedConfig, { host: "example.com" }),
    });
    const switchedState = reducer(hydratedState, { type: "theme/select", payload: themeB });

    expect(findWorkbenchTheme(switchedState.domain.themes, themeA)?.draft.keyFeedbackConfig.color).toBe("#00FFAA");
    expect(findWorkbenchTheme(switchedState.domain.themes, themeB)?.draft.keyFeedbackConfig.color).not.toBe("#00FFAA");
    expect(findWorkbenchTheme(switchedState.domain.themes, themeB)?.draft.keyFeedbackConfig.fontSize).not.toBe(72);
  });

  it("updates an explicit theme without touching the currently selected theme", () => {
    const themeA = initialState.domain.activeThemeId;
    const themeB = initialState.domain.themes.find((theme) => theme.meta.id !== themeA)?.meta.id;
    if (!themeB) throw new Error("Test requires two themes");
    const switched = reducer(initialState, { type: "theme/select", payload: themeB });
    const next = reducer(switched, {
      type: "theme/update-by-id",
      payload: {
        themeId: themeA,
        updater: (current) => ({ ...current, atmosphere: { ...current.atmosphere, marker: "restored" } }),
      },
    });

    expect(findWorkbenchTheme(next.domain.themes, themeA)?.draft.atmosphere.marker).toBe("restored");
    expect(findWorkbenchTheme(next.domain.themes, themeB)?.draft.atmosphere.marker).toBeUndefined();
    expect(next.domain.activeThemeId).toBe(themeB);
  });
});
