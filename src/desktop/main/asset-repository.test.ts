import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/unused") },
}));

import { defaultConfig } from "../renderer/engine/default-config";
import {
  __testing__,
  collectReferencedAssetIds,
  DESKTOP_ASSET_GC_GRACE_MS,
  hydrateThemeAssets,
  materializeConfigAssets,
  storeDataUrlAsset,
  sweepUnreferencedAssets,
} from "./asset-repository";

const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const SECOND_PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z1pAAAAAASUVORK5CYII=";

let temporaryDirectory = "";

beforeEach(async () => {
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "cursordance-assets-"));
  __testing__.setAssetsDirectory(temporaryDirectory);
});

afterEach(async () => {
  __testing__.setAssetsDirectory(null);
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

describe("desktop asset repository", () => {
  it("deduplicates equal bytes by sha256", async () => {
    const first = await storeDataUrlAsset(PNG_DATA_URL);
    const second = await storeDataUrlAsset(PNG_DATA_URL);
    expect(first).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(second).toBe(first);
    expect(await fs.readdir(temporaryDirectory)).toEqual([first.slice("sha256:".length)]);
  });

  it("materializes cursor and action images and hydrates portable exports", async () => {
    const config = JSON.parse(JSON.stringify(defaultConfig));
    const theme = config.themes[0];
    theme.cursorSkin.states.default = {
      image: { kind: "dataUrl", mimeType: "image/png", dataUrl: PNG_DATA_URL, width: 1, height: 1 },
      hotspot: { x: 0, y: 0 },
      size: { mode: "fixedBox", boxSize: 32 },
    };
    theme.actionConfigs.leftClick.imageEnabled = true;
    theme.actionConfigs.leftClick.imageDataUrl = PNG_DATA_URL;

    const stored = await materializeConfigAssets(config);
    const storedTheme = stored.themes[0];
    const cursorImage = storedTheme.cursorSkin.states.default.image;
    expect(cursorImage.kind).toBe("asset");
    expect(storedTheme.actionConfigs.leftClick).not.toHaveProperty("imageDataUrl");
    expect(storedTheme.actionConfigs.leftClick.imageAssetId).toBe(
      cursorImage.kind === "asset" ? cursorImage.assetId : "",
    );

    const portable = await hydrateThemeAssets(storedTheme);
    expect(portable.cursorSkin.states.default.image.kind).toBe("dataUrl");
    expect(portable.actionConfigs.leftClick.imageDataUrl).toBe(PNG_DATA_URL);
    expect(portable.actionConfigs.leftClick).not.toHaveProperty("imageAssetId");
  });

  it("sweeps only unreferenced content-addressed files", async () => {
    const kept = await storeDataUrlAsset(PNG_DATA_URL);
    const removed = await storeDataUrlAsset(SECOND_PNG_DATA_URL);
    await fs.writeFile(path.join(temporaryDirectory, "README"), "keep");
    const oldTimestamp = new Date(Date.now() - DESKTOP_ASSET_GC_GRACE_MS - 1_000);
    await fs.utimes(path.join(temporaryDirectory, removed.slice("sha256:".length)), oldTimestamp, oldTimestamp);

    const references = collectReferencedAssetIds({ imageAssetId: kept });
    expect(await sweepUnreferencedAssets(references)).toBe(1);
    expect(await fs.readdir(temporaryDirectory)).toEqual(expect.arrayContaining([
      "README",
      kept.slice("sha256:".length),
    ]));
    expect(await fs.readdir(temporaryDirectory)).not.toContain(removed.slice("sha256:".length));
  });

  it("rejects remote and malformed renderer image sources", async () => {
    const config = JSON.parse(JSON.stringify(defaultConfig));
    config.themes[0].actionConfigs.leftClick.imageDataUrl = "https://example.com/tracker.png";
    await expect(materializeConfigAssets(config)).rejects.toThrow(/data URL or asset id/);

    config.themes[0].actionConfigs.leftClick.imageDataUrl = "cursordance-asset://asset/not-a-hash";
    await expect(materializeConfigAssets(config)).rejects.toThrow(/URL is invalid/);
  });
});
