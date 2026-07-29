import { afterEach, describe, expect, it, vi } from "vitest";
import { createVisualEffects } from "./visual-effects";
import type { EngineDeps } from "./types";

afterEach(() => {
  vi.useRealTimers();
});

function createHarness() {
  const body = { style: { cursor: "crosshair" } };
  const deps = {
    window: { setTimeout, clearTimeout },
    document: {
      body,
      getElementById: vi.fn(() => null),
    },
    constants: { ROOT_ID: "root", STYLE_ID: "style", HIDE_CURSOR_CLASS: "hidden" },
    state: { activeEffects: 0 },
    configStore: {
      getActionCursorFeedbackConfig: (config: Record<string, unknown>) => config,
      getMaxActiveEffects: () => 48,
    },
  } as unknown as EngineDeps;
  return { body, effects: createVisualEffects(deps), state: deps.state };
}

describe("visual effect handles", () => {
  it("restores the original pointer only after overlapping handles are disposed", () => {
    vi.useFakeTimers();
    const { body, effects } = createHarness();
    const config = { cursorOverride: "切换到 pointer" };
    const first = effects.renderCursorOverride(0, 0, config);
    const second = effects.renderCursorOverride(0, 0, config);

    expect(body.style.cursor).toBe("pointer");
    first.dispose();
    expect(body.style.cursor).toBe("pointer");
    second.dispose();
    expect(body.style.cursor).toBe("crosshair");
  });

  it("restores all temporary pointer handles when the surface is cleared", () => {
    vi.useFakeTimers();
    const { body, effects } = createHarness();
    effects.renderCursorOverride(0, 0, { cursorOverride: "切换到 pointer" });
    effects.renderCursorOverride(0, 0, { cursorOverride: "切换到 pointer" });

    effects.clearEffects();

    expect(body.style.cursor).toBe("crosshair");
  });

  it("resets the active effect count even when the root is already absent", () => {
    const { effects, state } = createHarness();
    state.activeEffects = 3;

    effects.clearEffects();

    expect(state.activeEffects).toBe(0);
  });
});
