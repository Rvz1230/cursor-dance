import {
  getActionAnimationConfig,
  getActionAudioConfig,
  getActionCursorFeedbackConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
  getActionTriggerConfig,
} from "@/shared/effect-core/action-config";
import { createRuntimeConfigCore } from "@/shared/effect-runtime/runtime-config";
import { resolveWebContextRule } from "./site-matcher";
import type {
  CursorDanceConfig,
  CursorDanceTheme,
  CursorSkinState,
} from "@/shared/domain/cursor-dance";

type ActionConfig = Record<string, unknown>;
type ContentTheme = CursorDanceTheme;
export type ContentConfig = CursorDanceConfig;

interface ChromeStorageArea {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set?(items: Record<string, unknown>): Promise<void>;
}

interface ContentConfigStoreRuntime {
  window: Window;
  chrome?: {
    storage?: {
      local?: ChromeStorageArea;
      session?: ChromeStorageArea;
    };
  } | null;
  defaultConfig: ContentConfig;
  runtimeConfig?: {
    normalizeConfig?(value: unknown, fallback: ContentConfig): ContentConfig;
  };
  constants: {
    CONFIG_STORAGE_KEY: string;
    LIVE_PREVIEW_CONFIG_STORAGE_KEY: string;
    INTERACTIVE_SELECTOR: string;
    TEXT_EDITABLE_SELECTOR: string;
  };
  state: { config?: ContentConfig | null };
  diagnostics?: {
    log(scope: string, payload?: Record<string, unknown>): void;
    describeTarget?(target: unknown): unknown;
  };
  reportRuntimeError?(scope: string, message: string): void;
}

export interface ContentConfigStore {
  normalizeConfig(value: unknown): ContentConfig;
  setConfig(value: unknown): ContentConfig;
  getConfig(): ContentConfig;
  isLocalPreviewHost(): boolean;
  getActionTriggerConfig(config: ActionConfig | undefined): ActionConfig;
  getActionTextConfig(config: ActionConfig | undefined): ActionConfig;
  getActionParticleConfig(config: ActionConfig | undefined): ActionConfig;
  getActionRippleConfig(config: ActionConfig | undefined): ActionConfig;
  getActionAudioConfig(config: ActionConfig | undefined): ActionConfig;
  getActionAnimationConfig(config: ActionConfig | undefined): ActionConfig;
  getActionImageConfig(config: ActionConfig | undefined): ActionConfig;
  getActionCursorFeedbackConfig(config: ActionConfig | undefined): ActionConfig;
  getActiveTheme(): ContentTheme;
  getActionConfig(theme: ContentTheme | null | undefined, actionId: string): ActionConfig | null;
  getCursorStateBinding(theme: ContentTheme | null | undefined, stateId: string, actionId: string): {
    cursorStateId: string;
    actionId: string;
    inheritedFromDefault: boolean;
  };
  getEffectiveCursorStateConfig(theme: ContentTheme | null | undefined, stateId: string): CursorSkinState | null;
  resolveCursorStateId(target: unknown): string;
  matchesTriggerZone(target: unknown, triggerZone: unknown, event: unknown, meta?: Record<string, unknown>): boolean;
  isCurrentSiteEnabled(): boolean;
  getMaxActiveEffects(): number;
  syncConfigFromStorage(options: { clearStateCursorOverlay(): void }): Promise<void>;
  debouncedSyncConfigFromStorage(options: { clearStateCursorOverlay(): void }): void;
  getAtmosphereConfig(theme: ContentTheme | null | undefined): { mode: string };
  setOnSyncComplete(callback: (() => void) | null): void;
  destroy(): void;
}

export function createContentConfigStore(runtime: ContentConfigStoreRuntime): ContentConfigStore {
  const {
    window,
    chrome,
    defaultConfig,
    runtimeConfig,
    constants,
    state,
    diagnostics,
    reportRuntimeError,
  } = runtime;
  let onSyncComplete: (() => void) | null = null;
  let syncTimer: number | null = null;

  function normalizeConfig(value: unknown): ContentConfig {
    return runtimeConfig?.normalizeConfig?.(value, defaultConfig) || defaultConfig;
  }

  function setConfig(value: unknown): ContentConfig {
    state.config = normalizeConfig(value);
    return state.config;
  }

  function getConfig(): ContentConfig {
    return state.config || defaultConfig;
  }

  function isLocalPreviewHost(): boolean {
    return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  }

  function canUseWindowLocalStorage(): boolean {
    try {
      const probeKey = "__cursordance_content_probe__";
      window.localStorage.setItem(probeKey, "1");
      window.localStorage.removeItem(probeKey);
      return true;
    } catch {
      return false;
    }
  }

  function readLocalPreviewConfig(): ContentConfig | null {
    if (!isLocalPreviewHost() || !canUseWindowLocalStorage()) return null;
    try {
      const previewRaw = window.localStorage.getItem(constants.LIVE_PREVIEW_CONFIG_STORAGE_KEY);
      const storedRaw = window.localStorage.getItem(constants.CONFIG_STORAGE_KEY);
      const parsed = previewRaw ? JSON.parse(previewRaw) : (storedRaw ? JSON.parse(storedRaw) : null);
      return normalizeConfig(parsed || defaultConfig);
    } catch {
      return null;
    }
  }

  function getResolvedWebRule() {
    return resolveWebContextRule(
      getConfig().contextRules,
      window.location.hostname.trim().toLowerCase(),
      window.location.pathname || "/",
    );
  }

  const runtimeConfigCore = createRuntimeConfigCore({
    window,
    getConfig,
    resolveContextAction: getResolvedWebRule,
    interactiveSelector: constants.INTERACTIVE_SELECTOR,
    textEditableSelector: constants.TEXT_EDITABLE_SELECTOR,
    diagnostics,
  });
  const {
    getActiveTheme,
    isCurrentContextEnabled: isCurrentSiteEnabled,
    getMaxActiveEffects,
    getActionConfig,
    getCursorStateBinding,
    getEffectiveCursorStateConfig,
    resolveCursorStateId,
    matchesTriggerZone,
  } = runtimeConfigCore;

  function withResolvedCursorAssets(
    config: ContentConfig,
    assetEntries: Record<string, unknown>,
  ): ContentConfig {
    return {
      ...config,
      themes: config.themes.map((theme) => ({
        ...theme,
        cursorSkin: {
          ...theme.cursorSkin,
          states: Object.fromEntries(Object.entries(theme.cursorSkin?.states || {}).map(([stateId, stateConfig]) => {
            if (stateConfig?.image?.kind !== "asset" || !stateConfig.image.assetId) return [stateId, stateConfig];
            const asset = assetEntries[stateConfig.image.assetId] as { imageDataUrl?: string } | undefined;
            if (!asset?.imageDataUrl) return [stateId, stateConfig];
            const { assetId: _assetId, ...imageMetadata } = stateConfig.image;
            return [stateId, {
              ...stateConfig,
              image: { ...imageMetadata, kind: "dataUrl", dataUrl: asset.imageDataUrl },
            }];
          })),
        },
      })),
    };
  }

  function setOnSyncComplete(callback: (() => void) | null): void {
    onSyncComplete = callback;
  }

  function getAtmosphereConfig(theme: ContentTheme | null | undefined): { mode: string } {
    const mode = theme?.atmosphere?.mode;
    return { mode: typeof mode === "string" ? mode : "none" };
  }

  async function syncConfigFromStorage({ clearStateCursorOverlay }: {
    clearStateCursorOverlay(): void;
  }): Promise<void> {
    try {
      const localPreviewConfig = readLocalPreviewConfig();
      if (localPreviewConfig) {
        setConfig(localPreviewConfig);
      } else {
        let livePreviewConfig: unknown;
        try {
          const result = await chrome?.storage?.session?.get([constants.LIVE_PREVIEW_CONFIG_STORAGE_KEY]);
          livePreviewConfig = result?.[constants.LIVE_PREVIEW_CONFIG_STORAGE_KEY];
        } catch {
          reportRuntimeError?.("config-session-read", "Failed to read live preview from session storage.");
        }
        if (livePreviewConfig) {
          setConfig(livePreviewConfig);
        } else if (chrome?.storage?.local) {
          const result = await chrome.storage.local.get([constants.CONFIG_STORAGE_KEY]);
          const storedConfig = result[constants.CONFIG_STORAGE_KEY];
          const nextConfig = normalizeConfig(storedConfig || defaultConfig);
          const assetKeys = nextConfig.themes.flatMap((theme) => (
            Object.values(theme.cursorSkin?.states || {}).flatMap((cursorState) => (
              cursorState?.image?.kind === "asset" && cursorState.image.assetId
                ? [cursorState.image.assetId]
                : []
            ))
          ));
          const assetEntries = assetKeys.length
            ? await chrome.storage.local.get(assetKeys)
            : {};
          state.config = withResolvedCursorAssets(nextConfig, assetEntries);
          if ((!storedConfig || nextConfig !== storedConfig) && chrome.storage.local.set) {
            await chrome.storage.local.set({ [constants.CONFIG_STORAGE_KEY]: nextConfig });
          }
        } else setConfig(getConfig());
      }
      clearStateCursorOverlay();
      onSyncComplete?.();
    } catch {
      reportRuntimeError?.("config-sync", "Failed to sync config from storage; using defaults.");
      setConfig(getConfig());
      clearStateCursorOverlay();
      onSyncComplete?.();
    }
  }

  function debouncedSyncConfigFromStorage(options: { clearStateCursorOverlay(): void }): void {
    if (syncTimer !== null) window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      syncTimer = null;
      void syncConfigFromStorage(options);
    }, 60);
  }

  function destroy(): void {
    if (syncTimer !== null) window.clearTimeout(syncTimer);
    syncTimer = null;
    onSyncComplete = null;
  }

  return {
    normalizeConfig,
    setConfig,
    getConfig,
    isLocalPreviewHost,
    getActionTriggerConfig,
    getActionTextConfig,
    getActionParticleConfig,
    getActionRippleConfig,
    getActionAudioConfig,
    getActionAnimationConfig,
    getActionImageConfig,
    getActionCursorFeedbackConfig,
    getActiveTheme,
    getActionConfig,
    getCursorStateBinding,
    getEffectiveCursorStateConfig,
    resolveCursorStateId,
    matchesTriggerZone,
    isCurrentSiteEnabled,
    getMaxActiveEffects,
    syncConfigFromStorage,
    debouncedSyncConfigFromStorage,
    getAtmosphereConfig,
    setOnSyncComplete,
    destroy,
  };
}
