import { describe, expect, it } from "vitest";
import { defaultKeyFeedbackConfig } from "@/shared/config/key-feedback";
import { createWorkbenchCursorCommands } from "./workbenchCursorCommands";
import type { WorkbenchThemeDraft } from "./workbenchStateTypes";

function createHarness(cursorStateId = "pointer") {
  const defaultSkinState = {
    image: {
      kind: "dataUrl" as const,
      mimeType: "image/png" as const,
      dataUrl: "data:image/png;base64,default",
      width: 48,
      height: 48,
    },
    hotspot: { x: 0.2, y: 0.2 },
    size: { mode: "fixedBox" as const, boxSize: 48 },
  };
  const skinStates: Record<string, typeof defaultSkinState> = { default: defaultSkinState };
  let current: WorkbenchThemeDraft = {
    actionConfigs: {},
    resetActionConfigs: {},
    cursorBindings: {
      default: { mode: "override", actionId: "leftClick" },
      pointer: { mode: "inherit", actionId: "leftClick" },
    },
    cursorSkin: {
      version: 1,
      enabled: true,
      transitionMs: 80,
      states: skinStates,
    },
    keyFeedbackConfig: defaultKeyFeedbackConfig,
    resetKeyFeedbackConfig: defaultKeyFeedbackConfig,
    atmosphere: {},
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
  it("updates the canonical cursor skin directly", () => {
    const harness = createHarness();
    const pointerState = {
      ...harness.current().cursorSkin.states.default,
      size: { mode: "fixedBox" as const, boxSize: 64 },
    };
    harness.commands.updateCursorSkinState("pointer", pointerState);
    expect(harness.current().cursorSkin.states.pointer).toEqual(pointerState);
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
