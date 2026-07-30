import { describe, expect, it, vi } from "vitest";
import { createContentCursorOverlay } from "./cursor-overlay";

describe("extension cursor overlay adapter", () => {
  it("registers the adapter and clears immediately when the site is disabled", () => {
    const remove = vi.fn();
    const overlay = createContentCursorOverlay({
      document: {
        documentElement: { classList: { remove } },
      } as unknown as Document,
      constants: { HIDE_CURSOR_CLASS: "hide-cursor" },
      state: {},
      visualEffects: { ensureRoot: vi.fn() },
      configStore: {
        isCurrentSiteEnabled: () => false,
        getActiveScheme: vi.fn(),
        resolveCursorStateId: vi.fn(),
        getEffectiveCursorStateConfig: vi.fn(),
      },
    });

    overlay.syncStateCursorOverlay({ clientX: 1, clientY: 2, target: null });

    expect(remove).toHaveBeenCalledWith("hide-cursor");
    expect(globalThis.CursorDanceContentModules?.createCursorOverlay).toBe(createContentCursorOverlay);
  });
});
