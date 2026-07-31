import { describe, expect, it } from "vitest";
import {
  getEffectiveActiveThemeId,
  getSiteAction,
  resolveNextConfigForThemeChange,
  type PopupSiteContext,
} from "./popupConfigModel";
import { defaultConfig, type CursorDanceConfig } from "@/shared/config/default-config";

const site: PopupSiteContext = {
  host: "docs.example.com",
  isSupportedPage: true,
  isPreviewMode: false,
  tabId: 1,
};

const config: CursorDanceConfig = {
  ...defaultConfig,
  activeThemeId: "mono-geo",
  contextRules: [
    {
      id: "docs",
      context: "web",
      enabled: true,
      match: { type: "glob", host: "*.example.com" },
      action: { type: "enable", themeId: "drift" },
    },
  ],
};

describe("popupConfigModel", () => {
  it("resolves the same stored web rule used by the extension runtime", () => {
    const action = getSiteAction(config, site.host, "/");
    expect(action).toEqual({ type: "enable", themeId: "drift" });
    expect(getEffectiveActiveThemeId(action, "mono-geo")).toBe("drift");
  });

  it("updates a matching site override instead of the global active theme", () => {
    const next = resolveNextConfigForThemeChange(config, site, "sunset");
    expect(next.activeThemeId).toBe("mono-geo");
    expect(next.contextRules?.[0]).toMatchObject({
      id: "docs",
      action: { type: "enable", themeId: "sunset" },
    });
  });

  it("updates the global theme when no site rule matches", () => {
    const next = resolveNextConfigForThemeChange(
      config,
      { ...site, host: "other.test" },
      "sunset",
    );
    expect(next.activeThemeId).toBe("sunset");
    expect(next.contextRules).toBe(config.contextRules);
  });
});
