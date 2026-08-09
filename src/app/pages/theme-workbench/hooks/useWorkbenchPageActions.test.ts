import { describe, expect, it, vi } from "vitest";
import { Circle } from "lucide-react";
import { buildWorkbenchCommands } from "./useWorkbenchPageActions";

const noop = vi.fn();

function build(overrides: Partial<Parameters<typeof buildWorkbenchCommands>[0]> = {}) {
  return buildWorkbenchCommands({
    workspaceItems: [{
      id: "workbench",
      label: "主题与效果",
      icon: Circle,
      group: "personalization",
    }],
    unsaved: false,
    themeScoped: true,
    isWorkbench: true,
    aiPanelOpen: false,
    undoLabel: null,
    redoLabel: null,
    setWorkspaceId: noop,
    setAiPanelOpen: noop,
    setLayoutPreset: noop,
    applyChanges: noop,
    restoreAppliedChanges: noop,
    resetCurrentTheme: noop,
    undo: noop,
    redo: noop,
    runtimeTarget: "desktop",
    openRuntimePreview: noop,
    ...overrides,
  });
}

describe("buildWorkbenchCommands", () => {
  it("keeps workspace and view commands available without unsaved edits", () => {
    const commands = build();
    expect(commands.map((command) => command.id)).toEqual([
      "workspace-workbench",
      "reset-theme",
      "toggle-ai",
      "layout-config",
      "layout-split",
      "layout-preview",
    ]);
  });

  it("adds persistence and history commands only when their state makes them actionable", () => {
    const commands = build({
      unsaved: true,
      undoLabel: "字号",
      redoLabel: "颜色",
    });
    expect(commands.map((command) => command.id)).toEqual(expect.arrayContaining([
      "apply",
      "restore-applied",
      "undo",
      "redo",
    ]));
    expect(commands.find((command) => command.id === "undo")?.label).toBe("撤销：字号");
  });

  it("uses local save language and exposes the real Web runtime", () => {
    const commands = build({ runtimeTarget: "local", unsaved: true });
    expect(commands.find((command) => command.id === "apply")?.label).toBe("保存到浏览器");
    expect(commands.find((command) => command.id === "open-runtime-preview")?.label).toBe("打开网页试用");
  });
});
