import { describe, expect, it } from "vitest";
import { resolvePreviewAnchorBounds } from "./keyboardPreviewModel";

describe("keyboard preview anchor geometry", () => {
  it("maps the same local position inside the foreground window", () => {
    expect(resolvePreviewAnchorBounds("screen", { width: 1000, height: 600 })).toEqual({ x: 0, y: 0, width: 1000, height: 600 });
    const window = resolvePreviewAnchorBounds("window", { width: 1000, height: 600 });
    expect(window).toMatchObject({ x: 520, y: 156, width: 420 });
    expect(window.height).toBeCloseTo(336);
  });

  it("pins caret previews to the simulated insertion point", () => {
    expect(resolvePreviewAnchorBounds("caret", { width: 1000, height: 600 })).toEqual({ x: 790, y: 348, width: 0, height: 0 });
  });
});
