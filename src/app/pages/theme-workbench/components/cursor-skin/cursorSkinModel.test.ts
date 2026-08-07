import { describe, expect, it } from "vitest";
import {
  buildSkinStateFromAsset,
  getDefaultHotspot,
  getResolvedSkinState,
  matchStateId,
  planCursorBatchImport,
} from "./cursorSkinModel";

describe("cursor skin model", () => {
  it("matches common cursor asset file names to semantic states", () => {
    expect(matchStateId("arrow-default.png")).toBe("default");
    expect(matchStateId("hand-pointer.webp")).toBe("pointer");
    expect(matchStateId("wait-spinner.svg")).toBe("busy");
    expect(matchStateId("brand-logo.png")).toBe("");
    // resize / crosshair / move 等状态运行时不可达，已从真值源移除，不再匹配。
    expect(matchStateId("resize-horizontal.svg")).toBe("");
  });

  it("seeds a required default skin before assigning named batch assets", () => {
    expect(planCursorBatchImport(["pointer.png", "text.png", "brand.png"], false)).toEqual([
      { fileIndex: 0, stateIds: ["default", "pointer"], pending: false },
      { fileIndex: 1, stateIds: ["text"], pending: false },
      { fileIndex: 2, stateIds: [], pending: true },
    ]);
  });

  it("keeps duplicate and unmatched batch assets available for manual assignment", () => {
    expect(planCursorBatchImport(["arrow.png", "default-alt.png", "brand.png"], true)).toEqual([
      { fileIndex: 0, stateIds: ["default"], pending: false },
      { fileIndex: 1, stateIds: [], pending: true },
      { fileIndex: 2, stateIds: [], pending: true },
    ]);
  });

  // 最近素材缓存的 hotspotX/Y 是原图像素；cursorSkin.hotspot 是 0–1 分数。
  // 这个边界负责折算，所以 4/40 与 6/42。
  it("converts recent assets into cursor skin states with a normalized hotspot", () => {
    expect(buildSkinStateFromAsset({
      imageDataUrl: "data:image/png;base64,AA==",
      hotspotX: 4,
      hotspotY: 6,
      size: 32,
      sourceWidth: 40,
      sourceHeight: 42,
    })).toEqual({
      image: {
        kind: "dataUrl",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,AA==",
        width: 40,
        height: 42,
      },
      hotspot: { x: 4 / 40, y: 6 / 42 },
      size: { mode: "fixedBox", boxSize: 32 },
    });
  });

  it("returns recommended hotspots as fractions so they generalize across image sizes", () => {
    expect(getDefaultHotspot({ defaultHotspot: "center" })).toEqual({ x: 0.5, y: 0.5 });
    // 箭头尖历史上定在 48px 素材的 (10, 8)，折成分数后对任意尺寸的素材都成立
    expect(getDefaultHotspot({ defaultHotspot: "topLeft" })).toEqual({ x: 10 / 48, y: 8 / 48 });
  });

  it("falls back to the default skin for inherited states", () => {
    const defaultState = {
      image: {
        kind: "dataUrl" as const,
        mimeType: "image/png" as const,
        dataUrl: "default",
        width: 48,
        height: 48,
      },
      hotspot: { x: 0, y: 0 },
      size: { mode: "fixedBox" as const, boxSize: 48 },
    };
    expect(getResolvedSkinState({
      version: 1,
      enabled: true,
      transitionMs: 80,
      states: { default: defaultState },
    }, "pointer")).toEqual({
      state: defaultState,
      inherited: true,
    });
  });
});
