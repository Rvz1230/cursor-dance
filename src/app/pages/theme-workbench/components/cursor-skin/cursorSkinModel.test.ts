import { describe, expect, it } from "vitest";
import {
  buildSkinStateFromAsset,
  getResolvedSkinState,
  matchStateId,
} from "./cursorSkinModel";

describe("cursor skin model", () => {
  it("matches common cursor asset file names to semantic states", () => {
    expect(matchStateId("arrow-default.png")).toBe("default");
    expect(matchStateId("hand-pointer.webp")).toBe("pointer");
    expect(matchStateId("resize-horizontal.svg")).toBe("resizeHorizontal");
    expect(matchStateId("brand-logo.png")).toBe("");
  });

  it("converts recent assets into cursor skin states", () => {
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
      hotspot: { x: 4, y: 6 },
      size: { mode: "fixedBox", boxSize: 32 },
    });
  });

  it("falls back to the default skin for inherited states", () => {
    const defaultState = { image: { kind: "dataUrl", dataUrl: "default" } };
    expect(getResolvedSkinState({ states: { default: defaultState } }, "pointer")).toEqual({
      state: defaultState,
      inherited: true,
    });
  });
});
