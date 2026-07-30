import { describe, expect, it, vi } from "vitest";
import {
  createCursorOverlay,
  cursorSkinStateToOverlayState,
  type CursorOverlayRenderState,
} from "./cursor-overlay";

function createHarness() {
  const classes = new Set<string>();
  const root = { append: vi.fn() };
  const created: Array<Record<string, unknown>> = [];
  const document = {
    documentElement: {
      classList: {
        add: (value: string) => classes.add(value),
        remove: (value: string) => classes.delete(value),
      },
    },
    createElement(tag: string) {
      const node: Record<string, unknown> = {
        tag,
        style: {},
        hidden: false,
        append: vi.fn(),
      };
      if (tag === "img") Object.assign(node, { src: "", alt: "", draggable: true });
      created.push(node);
      return node;
    },
  } as unknown as Document;
  const state: CursorOverlayRenderState = {};
  const overlay = createCursorOverlay({
    document,
    state,
    constants: { HIDE_CURSOR_CLASS: "hide-cursor" },
    visualEffects: { ensureRoot: () => root as unknown as HTMLElement },
  });
  return { classes, created, overlay, root, state };
}

describe("shared cursor overlay", () => {
  it("normalizes fixed and intrinsic cursor skin sizes", () => {
    const fixed = cursorSkinStateToOverlayState({
      image: { kind: "dataUrl", dataUrl: "data:image/png;base64,AA", width: 32, height: 48 },
      size: { mode: "fixedBox", boxSize: 64 },
      hotspot: { x: 4, y: 5 },
    });
    const intrinsic = cursorSkinStateToOverlayState({
      image: { kind: "asset", assetId: "asset", width: 32, height: 48 },
      size: { mode: "intrinsic" },
    }, () => "asset://resolved");

    expect(fixed).toEqual({
      imageDataUrl: "data:image/png;base64,AA",
      size: 64,
      hotspotX: 4,
      hotspotY: 5,
    });
    expect(intrinsic).toMatchObject({ imageDataUrl: "asset://resolved", size: 48 });
  });

  it("creates one cursor node, clamps its size and clears it", () => {
    const { classes, created, overlay, root, state } = createHarness();
    overlay.syncStateCursorOverlay(100, 80, {
      imageDataUrl: "data:image/png;base64,AA",
      size: 120,
      hotspotX: 5,
      hotspotY: 6,
    });

    expect(root.append).toHaveBeenCalledOnce();
    expect(created).toHaveLength(2);
    expect(state.stateCursorNode?.style.width).toBe("96px");
    expect(state.stateCursorNode?.style.transform).toBe("translate3d(95px, 74px, 0)");
    expect(state.stateCursorImg?.src).toBe("data:image/png;base64,AA");
    expect(classes.has("hide-cursor")).toBe(true);

    overlay.clearStateCursorOverlay();
    expect(state.stateCursorNode?.hidden).toBe(true);
    expect(classes.has("hide-cursor")).toBe(false);
  });
});
