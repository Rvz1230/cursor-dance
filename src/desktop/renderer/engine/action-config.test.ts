import { describe, expect, it } from "vitest";
import { toDesktopAssetUrl } from "../../../shared/asset-reference";
import { getActionImageConfig } from "./action-config";

const ASSET_ID = `sha256:${"c".repeat(64)}`;

describe("desktop action image config", () => {
  it("turns a stored asset id into a renderer-safe source URL", () => {
    expect(getActionImageConfig({ imageEnabled: true, imageAssetId: ASSET_ID })).toMatchObject({
      imageEnabled: true,
      imageAssetId: ASSET_ID,
      imageDataUrl: toDesktopAssetUrl(ASSET_ID),
    });
  });

  it("keeps an inline preview image when one is present", () => {
    expect(getActionImageConfig({
      imageEnabled: true,
      imageAssetId: ASSET_ID,
      imageDataUrl: "data:image/png;base64,AA==",
    }).imageDataUrl).toBe("data:image/png;base64,AA==");
  });
});
