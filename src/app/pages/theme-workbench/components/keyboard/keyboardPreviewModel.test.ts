import { describe, expect, it } from "vitest";
import { resolvePreviewEffectPosition } from "./keyboardPreviewModel";

const BASE = {
  originEdge: "bottom" as const,
  originMapping: "center" as const,
  globalOffsetX: 0.5,
  globalOffsetY: 0.5,
  bounceHeight: 120,
  layoutX: 0.5,
  typewriterX: 0.14,
};

describe("keyboard preview anchor geometry", () => {
  it("maps the same local position inside the foreground window", () => {
    const screen = resolvePreviewEffectPosition({ ...BASE, anchor: "screen" });
    const window = resolvePreviewEffectPosition({ ...BASE, anchor: "window" });
    expect(screen.x).toBeCloseTo(0.5);
    expect(window.x).toBeCloseTo(0.73);
    expect(window.y).toBeGreaterThan(0.26);
    expect(window.y).toBeLessThan(0.82);
  });

  it("pins caret previews to the simulated insertion point", () => {
    expect(resolvePreviewEffectPosition({ ...BASE, anchor: "caret" })).toEqual({ x: 0.79, y: 0.58 });
  });
});
