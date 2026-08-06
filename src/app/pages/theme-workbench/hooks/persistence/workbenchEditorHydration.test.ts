import { describe, expect, it } from "vitest";

import { createThemeDraft } from "../../model/workbenchSchema";
import type { WorkbenchTheme } from "../workbenchStateTypes";
import { resolveWorkbenchEditorHydration } from "./workbenchEditorHydration";

function createTheme(id: string): WorkbenchTheme {
  return {
    meta: { id, name: id, kind: "自定义", summary: "", tone: "slate" },
    draft: createThemeDraft(id),
  };
}

const currentEditor = {
  workspaceId: "workbench",
  actionId: "leftClick",
  cursorStateId: "default",
};

describe("resolveWorkbenchEditorHydration", () => {
  it("restores valid navigation and marks a stored theme override as unsaved", () => {
    const result = resolveWorkbenchEditorHydration({
      currentEditor,
      storedEditor: {
        workspaceId: "states",
        themeId: "drift",
        actionId: "wheel",
        cursorStateId: "pointer",
      },
      themes: [createTheme("mono-geo"), createTheme("drift")],
      configActiveThemeId: "mono-geo",
      availableCursorStateIds: ["default", "pointer"],
    });

    expect(result).toEqual({
      editor: { workspaceId: "states", actionId: "wheel", cursorStateId: "pointer" },
      activeThemeId: "drift",
      hasUnsavedThemeSelection: true,
    });
  });

  it("ignores stale navigation values and keeps the canonical active theme", () => {
    const result = resolveWorkbenchEditorHydration({
      currentEditor,
      storedEditor: {
        workspaceId: "removed-workspace",
        themeId: "removed-theme",
        actionId: "removed-action",
        cursorStateId: "crosshair",
      },
      themes: [createTheme("mono-geo")],
      configActiveThemeId: "mono-geo",
      availableCursorStateIds: ["default", "pointer"],
    });

    expect(result.editor).toEqual(currentEditor);
    expect(result.activeThemeId).toBe("mono-geo");
    expect(result.hasUnsavedThemeSelection).toBe(false);
  });
});
