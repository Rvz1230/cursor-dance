import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultConfig } from "@/desktop/renderer/engine/default-config";
import { writeLivePreviewConfig } from "./config-io";
import { __testing__ as repositoryTesting } from "./repository";

const ASSET_ID = `sha256:${"b".repeat(64)}`;
const DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

function configWithInlineImages() {
  const config = JSON.parse(JSON.stringify(defaultConfig));
  const theme = config.themes[0];
  theme.cursorSkin.states.default = {
    image: { kind: "dataUrl", mimeType: "image/png", dataUrl: DATA_URL, width: 1, height: 1 },
    hotspot: { x: 0, y: 0 },
    size: { mode: "fixedBox", boxSize: 32 },
  };
  theme.actionConfigs.leftClick.imageEnabled = true;
  theme.actionConfigs.leftClick.imageDataUrl = DATA_URL;
  return config;
}

function materializedResult(payload) {
  const stored = JSON.parse(JSON.stringify(payload));
  const theme = stored.themes[0];
  theme.cursorSkin.states.default.image = {
    kind: "asset",
    assetId: ASSET_ID,
    mimeType: "image/png",
    width: 1,
    height: 1,
  };
  theme.actionConfigs.leftClick.imageAssetId = ASSET_ID;
  delete theme.actionConfigs.leftClick.imageDataUrl;
  return stored;
}

afterEach(() => {
  repositoryTesting.reset();
  Reflect.deleteProperty(globalThis, "window");
});

describe("desktop config asset transport", () => {
  it("sends an inline image once and reuses its materialized asset id", async () => {
    const payloads: unknown[] = [];
    const setLivePreview = vi.fn(async (payload) => {
      payloads.push(payload);
      return materializedResult(payload);
    });
    Object.assign(globalThis, {
      window: {
        CursorDanceDefaultConfig: defaultConfig,
        cursorDanceStorage: { setLivePreview },
      },
    });

    const config = configWithInlineImages();
    await writeLivePreviewConfig(config);
    await writeLivePreviewConfig(config);

    const cleared = materializedResult(config);
    cleared.themes[0].actionConfigs.leftClick.imageDataUrl = "";
    await writeLivePreviewConfig(cleared);

    const first = payloads[0] as ReturnType<typeof configWithInlineImages>;
    const second = payloads[1] as ReturnType<typeof configWithInlineImages>;
    expect(first.themes[0].cursorSkin.states.default.image.kind).toBe("dataUrl");
    expect(first.themes[0].actionConfigs.leftClick.imageDataUrl).toBe(DATA_URL);
    expect(second.themes[0].cursorSkin.states.default.image).toMatchObject({ kind: "asset", assetId: ASSET_ID });
    expect(second.themes[0].actionConfigs.leftClick).toMatchObject({ imageAssetId: ASSET_ID });
    expect(second.themes[0].actionConfigs.leftClick).not.toHaveProperty("imageDataUrl");
    const third = payloads[2] as ReturnType<typeof configWithInlineImages>;
    expect(third.themes[0].actionConfigs.leftClick).not.toHaveProperty("imageAssetId");
    expect(third.themes[0].actionConfigs.leftClick.imageDataUrl).toBe("");
  });
});
