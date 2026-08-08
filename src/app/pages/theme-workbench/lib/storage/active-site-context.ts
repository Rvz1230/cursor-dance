import { getChromeApi } from "./chrome-api";

interface ActiveSiteContext {
  host: string;
  path: string;
  isSupportedPage: boolean;
  isPreviewMode: boolean;
  tabId: number | null;
}

const UNSUPPORTED_SITE: ActiveSiteContext = {
  host: "example.com",
  path: "/",
  isSupportedPage: false,
  isPreviewMode: false,
  tabId: null,
};

export async function readActiveSiteContext(): Promise<ActiveSiteContext> {
  const chromeApi = getChromeApi();
  if (!chromeApi?.tabs?.query) {
    const isPreviewPage = typeof window !== "undefined"
      && /^(http|https):$/.test(window.location.protocol)
      && window.location.hostname.length > 0;
    return {
      host: isPreviewPage ? window.location.hostname.toLowerCase() : UNSUPPORTED_SITE.host,
      path: isPreviewPage ? window.location.pathname || "/" : "/",
      isSupportedPage: isPreviewPage,
      isPreviewMode: isPreviewPage,
      tabId: isPreviewPage ? 0 : null,
    };
  }
  try {
    const tabs = await chromeApi.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    const url = activeTab?.url ? new URL(activeTab.url) : null;
    const isSupportedPage = url?.protocol === "http:" || url?.protocol === "https:";
    return {
      host: isSupportedPage ? url.hostname.toLowerCase() : UNSUPPORTED_SITE.host,
      path: isSupportedPage ? url.pathname || "/" : "/",
      isSupportedPage,
      isPreviewMode: false,
      tabId: activeTab?.id ?? null,
    };
  } catch {
    return { ...UNSUPPORTED_SITE };
  }
}
