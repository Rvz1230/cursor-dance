import { describe, expect, it } from "vitest";
import { createWorkbenchCursorCommands } from "./workbenchCursorCommands";
import type { CursorCommandDraft } from "./workbenchStateTypes";

function createHarness(cursorStateId = "pointer") {
  const defaultSkinState = { hotspot: { x: 2, y: 3 } };
  const skinStates: Record<string, typeof defaultSkinState> = { default: defaultSkinState };
  let current: CursorCommandDraft = {
    cursorModes: { default: "源", pointer: "继承" },
    cursorStateActions: { default: "leftClick", pointer: "leftClick" },
    cursorStateAssets: { default: { size: 48 }, pointer: {} },
    cursorSkin: {
      version: 1,
      enabled: true,
      transitionMs: 80,
      states: skinStates,
    },
  };
  const commands = createWorkbenchCursorCommands({
    selected: { cursorStateId },
    draft: current,
    updateCurrentTheme(updater) {
      current = updater(current);
    },
  });
  return { commands, current: () => current };
}

describe("workbench cursor commands", () => {
  it("marks non-default state assets as overrides", () => {
    const harness = createHarness();
    harness.commands.updateCursorStateAsset({ size: 64 });
    expect(harness.current().cursorModes.pointer).toBe("覆盖");
    expect(harness.current().cursorStateAssets.pointer).toEqual({ size: 64 });
  });

  it("copies the default skin without sharing nested references", () => {
    const harness = createHarness();
    harness.commands.copyDefaultCursorSkinState("pointer");
    const states = harness.current().cursorSkin.states;
    expect(states.pointer).toEqual(states.default);
    expect(states.pointer).not.toBe(states.default);
  });

  it("clears one skin state without changing the default", () => {
    const harness = createHarness();
    harness.commands.copyDefaultCursorSkinState("pointer");
    harness.commands.clearCursorSkinState("pointer");
    expect(harness.current().cursorSkin.states.pointer).toBeUndefined();
    expect(harness.current().cursorSkin.states.default).toBeDefined();
  });
});
