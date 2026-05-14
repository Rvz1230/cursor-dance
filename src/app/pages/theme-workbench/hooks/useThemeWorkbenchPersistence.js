import { useEffect } from "react";
import {
  buildStoredConfigFromWorkbench,
  clearLivePreviewConfig,
  hydrateWorkbenchState,
  readActiveSiteContext,
  readExtensionConfig,
  readRecentCursorAssets,
  subscribeExtensionConfig,
  writeLivePreviewConfig,
} from "../lib/extensionConfig.js";

export function useThemeWorkbenchPersistence({ state, dispatch, configRef }) {
  useEffect(() => {
    let cancelled = false;

    function clearPreviewOnPageHide() {
      void clearLivePreviewConfig();
    }

    async function hydrate() {
      const [config, site, recentCursorAssets] = await Promise.all([
        readExtensionConfig(),
        readActiveSiteContext(),
        readRecentCursorAssets(),
      ]);
      if (cancelled) return;
      configRef.current = config;
      dispatch({ type: "hydrate", payload: { ...hydrateWorkbenchState(config, site), recentCursorAssets } });
    }

    hydrate();
    window.addEventListener("pagehide", clearPreviewOnPageHide);

    const unsubscribe = subscribeExtensionConfig(async (nextConfigOrUpdater) => {
      const site = await readActiveSiteContext();
      const nextConfig =
        typeof nextConfigOrUpdater === "function"
          ? nextConfigOrUpdater(configRef.current ?? {})
          : nextConfigOrUpdater;
      configRef.current = nextConfig;
      if (cancelled) return;
      dispatch({ type: "hydrate", payload: hydrateWorkbenchState(nextConfig, site) });
    });

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("pagehide", clearPreviewOnPageHide);
      void clearLivePreviewConfig();
    };
  }, [configRef, dispatch]);

  useEffect(() => {
    if (!state.ui.isHydrated) return;

    if (!state.ui.unsaved) {
      void clearLivePreviewConfig();
      return;
    }

    const baseConfig = configRef.current;
    if (!baseConfig) return;

    const livePreviewConfig = buildStoredConfigFromWorkbench(baseConfig, state);
    void writeLivePreviewConfig(livePreviewConfig);
  }, [configRef, state]);
}
