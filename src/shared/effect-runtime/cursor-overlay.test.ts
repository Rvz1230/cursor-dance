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
      image: { kind: "dataUrl", mimeType: "image/png", dataUrl: "data:image/png;base64,AA", width: 32, height: 48 },
      size: { mode: "fixedBox", boxSize: 64 },
      hotspot: { x: 4 / 32, y: 5 / 48 },
    });
    const intrinsic = cursorSkinStateToOverlayState({
      image: { kind: "asset", assetId: "asset", mimeType: "image/png", width: 32, height: 48 },
      hotspot: { x: 0.5, y: 0.5 },
      size: { mode: "source" },
    }, () => "asset://resolved");

    expect(fixed).toEqual({
      imageDataUrl: "data:image/png;base64,AA",
      size: 64,
      hotspotNormX: 4 / 32,
      hotspotNormY: 5 / 48,
    });
    expect(intrinsic).toMatchObject({ imageDataUrl: "asset://resolved", size: 48 });
  });

  it("creates one cursor node, clamps its size and clears it", () => {
    const { classes, created, overlay, root, state } = createHarness();
    overlay.syncStateCursorOverlay(100, 80, {
      imageDataUrl: "data:image/png;base64,AA",
      size: 120,
      hotspotNormX: 0.25,
      hotspotNormY: 0.5,
    });

    expect(root.append).toHaveBeenCalledOnce();
    expect(created).toHaveLength(2);
    // size 120 被夹到 96；偏移必须按夹取后的 96 算：0.25*96=24、0.5*96=48
    expect(state.stateCursorNode?.style.width).toBe("96px");
    expect(state.stateCursorNode?.style.transform).toBe("translate3d(76px, 32px, 0)");
    expect(state.stateCursorImg?.src).toBe("data:image/png;base64,AA");
    expect(classes.has("hide-cursor")).toBe(true);

    overlay.clearStateCursorOverlay();
    expect(state.stateCursorNode?.hidden).toBe(true);
    expect(classes.has("hide-cursor")).toBe(false);
  });

  // 原缺陷的回归护栏：编辑器按原图比例定位红点，运行时却把同一个值当 CSS px
  // 直接减、且没跟着被夹后的渲染尺寸换算。
  it("anchors a centered hotspot on the pointer regardless of image size or box size", () => {
    for (const [imageSize, boxSize, expectedOffset] of [
      [128, 32, 16],
      [128, 96, 48],
      [16, 32, 16],
    ] as const) {
      const { overlay, state } = createHarness();
      const overlayState = cursorSkinStateToOverlayState({
        image: { kind: "dataUrl", mimeType: "image/png", dataUrl: "data:image/png;base64,AA", width: imageSize, height: imageSize },
        size: { mode: "fixedBox", boxSize },
        hotspot: { x: 0.5, y: 0.5 },
      });
      overlay.syncStateCursorOverlay(200, 200, overlayState);
      expect(state.stateCursorNode?.style.transform)
        .toBe(`translate3d(${200 - expectedOffset}px, ${200 - expectedOffset}px, 0)`);
    }
  });
});
