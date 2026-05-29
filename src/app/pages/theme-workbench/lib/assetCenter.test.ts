import { describe, expect, it } from "vitest";
import { buildAssetCenterSummary, getConfiguredCursorAssetEntries } from "./assetCenter";

describe("assetCenter", () => {
  it("collects only configured cursor assets", () => {
    const entries = getConfiguredCursorAssetEntries({
      default: { imageDataUrl: "data:image/png;base64,AAA", size: 48, hotspotX: 16, hotspotY: 32 },
      pointer: { imageDataUrl: "", size: 48, hotspotX: 16, hotspotY: 32 },
      wait: { imageDataUrl: "data:image/png;base64,BBB", size: 64, hotspotX: 24, hotspotY: 36 },
    });

    expect(entries).toHaveLength(2);
    expect(entries.map((item) => item.id)).toEqual(["default", "wait"]);
  });

  it("summarizes action, cursor, and recent assets without leaking empty entries", () => {
    const summary = buildAssetCenterSummary({
      actionId: "leftClick",
      actionConfig: {
        imageEnabled: true,
        imageDataUrl: "data:image/png;base64,CCC",
        imageSize: 108,
        imageLabel: "命中贴纸",
      },
      cursorStateAssets: {
        default: { imageDataUrl: "data:image/png;base64,AAA", size: 48, hotspotX: 16, hotspotY: 32 },
      },
      recentCursorAssets: [
        { id: "recent-1", imageDataUrl: "data:image/png;base64,DDD", name: "recent-one", size: 48, hotspotX: 16, hotspotY: 32 },
        { id: "recent-2", imageDataUrl: "", name: "empty-entry" },
      ],
    });

    expect(summary.actionImageAsset?.actionLabel).toBe("左键单击");
    expect(summary.counts).toEqual({
      total: 3,
      cursor: 1,
      recent: 1,
      hasActionImageAsset: true,
    });
    expect(summary.recentAssets).toHaveLength(1);
  });
});
