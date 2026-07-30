import { describe, expect, it, vi } from "vitest";
import {
  createPreviewEffectEngine,
  getPreviewTriggerDelayMs,
  resolvePreviewImageConfig,
} from "./preview-engine";

describe("preview effect engine", () => {
  it("derives delays only for simulated multi-step actions", () => {
    expect(getPreviewTriggerDelayMs("leftClick", { holdMs: 500 })).toBe(0);
    expect(getPreviewTriggerDelayMs("doubleClick", { holdMs: 320 })).toBe(80);
    expect(getPreviewTriggerDelayMs("longPress", { holdMs: 680 })).toBe(680);
  });

  it("resolves asset-backed images without changing inline images", () => {
    const resolver = vi.fn((assetId: string) => `asset://${assetId}`);
    expect(resolvePreviewImageConfig({ imageAssetId: "sha256:abc" }, resolver)).toMatchObject({
      imageAssetId: "sha256:abc",
      imageDataUrl: "asset://sha256:abc",
    });
    expect(resolvePreviewImageConfig({ imageDataUrl: "data:image/png;base64,x" }, resolver)).toMatchObject({
      imageDataUrl: "data:image/png;base64,x",
    });
    expect(resolver).toHaveBeenCalledOnce();
  });

  it("exposes a preview-only runtime without desktop input handlers", () => {
    const engine = createPreviewEffectEngine({
      window: {} as Window,
      document: {} as Document,
      constants: { ROOT_ID: "preview-root", STYLE_ID: "preview-style" },
      state: { activeEffects: 0, ready: true },
      getActionConfig: () => ({}),
    });

    expect(typeof engine.visualEffects.ensureRoot).toBe("function");
    expect(typeof engine.triggerAt).toBe("function");
    expect("triggerHandlers" in engine).toBe(false);
  });
});
