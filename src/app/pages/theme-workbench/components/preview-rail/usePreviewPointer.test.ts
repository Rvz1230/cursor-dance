import { describe, expect, it } from "vitest";
import { getLocalPointerPosition } from "./usePreviewPointer";

describe("preview pointer interaction", () => {
  it("converts viewport coordinates into stage-local coordinates", () => {
    expect(getLocalPointerPosition({ left: 120, top: 80 }, 310, 230)).toEqual({
      x: 190,
      y: 150,
      inside: true,
    });
  });
});
