import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultConfig } from "@/shared/config/default-config";
import { readActiveSiteContext } from "./active-site-context";
import { previewThemePack } from "./preview-transport";
import { buildThemeExportPayload } from "./theme-file-io";

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("workbench storage capabilities", () => {
  it("builds the stable v4 theme export envelope", () => {
    const theme = defaultConfig.themes[0];
    const payload = buildThemeExportPayload(theme);

    expect(payload.format).toBe("cursordance-theme");
    expect(payload.schemaVersion).toBe(4);
    expect(payload.theme).toBe(theme);
    expect(Number.isNaN(Date.parse(payload.exportedAt))).toBe(false);
  });

  it("derives local preview context and sends a preview through one transport", async () => {
    const postMessage = vi.fn();
    const dispatchEvent = vi.fn();
    class FakeBroadcastChannel {
      constructor(_name: string) {}
      postMessage = postMessage;
    }
    Object.assign(globalThis, {
      window: {
        location: {
          protocol: "https:",
          hostname: "docs.example.com",
          pathname: "/guide/start",
        },
        BroadcastChannel: FakeBroadcastChannel,
        dispatchEvent,
      },
    });

    await expect(readActiveSiteContext()).resolves.toEqual({
      host: "docs.example.com",
      path: "/guide/start",
      isSupportedPage: true,
      isPreviewMode: true,
      tabId: 0,
    });
    await expect(previewThemePack("mono-geo", defaultConfig.themes[0], "leftClick"))
      .resolves.toBe(true);
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: "preview-theme",
      themeId: "mono-geo",
      actionId: "leftClick",
    }));
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });
});
