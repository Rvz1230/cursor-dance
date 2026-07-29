import { describe, expect, it } from "vitest";
import {
  assetIdFromDesktopAssetUrl,
  isDesktopAssetId,
  resolveDesktopImageSource,
  toDesktopAssetUrl,
} from "./asset-reference";

const ASSET_ID = `sha256:${"a".repeat(64)}`;

describe("desktop asset references", () => {
  it("round-trips a bounded sha256 asset id", () => {
    const url = toDesktopAssetUrl(ASSET_ID);
    expect(url).toBe(`cursordance-asset://asset/sha256%3A${"a".repeat(64)}`);
    expect(assetIdFromDesktopAssetUrl(url)).toBe(ASSET_ID);
    expect(isDesktopAssetId(ASSET_ID)).toBe(true);
  });

  it("rejects malformed ids and URLs", () => {
    expect(toDesktopAssetUrl("../config.json")).toBe("");
    expect(assetIdFromDesktopAssetUrl("https://example.com/image.png")).toBeNull();
    expect(assetIdFromDesktopAssetUrl("cursordance-asset://other/sha256%3Adeadbeef")).toBeNull();
  });

  it("resolves inline and stored image sources", () => {
    expect(resolveDesktopImageSource({ kind: "dataUrl", dataUrl: "data:image/png;base64,AA==" }))
      .toBe("data:image/png;base64,AA==");
    expect(resolveDesktopImageSource({ kind: "asset", assetId: ASSET_ID }))
      .toBe(toDesktopAssetUrl(ASSET_ID));
  });
});
