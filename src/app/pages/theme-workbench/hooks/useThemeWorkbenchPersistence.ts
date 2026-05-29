import { useEffect, useRef } from "react";
import {
  buildStoredConfigFromWorkbench,
  clearLivePreviewConfig,
  hydrateWorkbenchState,
  readActiveSiteContext,
  readExtensionConfig,
  readRecentCursorAssets,
  subscribeExtensionConfig,
  writeLivePreviewConfig,
} from "../lib/extensionConfig";

export function useThemeWorkbenchPersistence({ state, dispatch, configRef }) {
  const debounceRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

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

    if (!configRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const latestState = stateRef.current;
      const baseConfig = configRef.current;
      if (!baseConfig || !latestState.ui.unsaved) return;
      void writeLivePreviewConfig(buildStoredConfigFromWorkbench(baseConfig, latestState));
    }, 180);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [configRef, state]);
}
