import type { CursorDanceTheme } from "@/shared/domain/cursor-dance";
import {
  PREVIEW_MESSAGE_TYPE,
  getChromeApi,
  postLocalPreviewMessage,
} from "./chrome-api";
import { readActiveSiteContext } from "./active-site-context";

export async function previewThemePack(
  themeId: string,
  themePack: CursorDanceTheme,
  actionId = "leftClick",
): Promise<boolean> {
  const chromeApi = getChromeApi();
  const site = await readActiveSiteContext();
  if (!chromeApi?.tabs?.sendMessage) {
    if (!site.isSupportedPage) return false;
    postLocalPreviewMessage({ type: "preview-theme", themeId, themePack, actionId });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("CURSORDANCE_POPUP_PREVIEW", {
        detail: { themeId, themePack, actionId },
      }));
    }
    return true;
  }
  if (site.tabId == null || !site.isSupportedPage) return false;
  try {
    await chromeApi.tabs.sendMessage(site.tabId, {
      type: PREVIEW_MESSAGE_TYPE,
      themeId,
      themePack,
      actionId,
    });
    return true;
  } catch {
    return false;
  }
}
