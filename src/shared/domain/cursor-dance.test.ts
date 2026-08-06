import { describe, expect, it } from "vitest";
import { createCursorBindings, createCursorSkin } from "./cursor-dance";

describe("cursor dance domain factories", () => {
  it("creates canonical bindings with only the default state overridden", () => {
    expect(createCursorBindings(["default", "pointer", "busy"])).toEqual({
      default: { mode: "override", actionId: "leftClick" },
      pointer: { mode: "inherit", actionId: "leftClick" },
      busy: { mode: "inherit", actionId: "leftClick" },
    });
  });

  it("returns independent empty cursor skins", () => {
    const first = createCursorSkin();
    const second = createCursorSkin();

    expect(first).toEqual({ version: 1, enabled: true, transitionMs: 80, states: {} });
    expect(first).not.toBe(second);
    expect(first.states).not.toBe(second.states);
  });
});
