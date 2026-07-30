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
import { getDefaultActionConfigs } from "@/shared/effect-core/default-action-configs";
import { resolveWebContextRule } from "./site-matcher";
import type {
  CursorDanceConfigV4,
  CursorDanceThemeV4,
} from "@/shared/config-schema-v4";

type ActionConfig = Record<string, unknown>;
export type ContentTheme = CursorDanceThemeV4;
export type ContentConfig = CursorDanceConfigV4;

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
  getActiveScheme(): ContentTheme;
  getActionConfig(scheme: ContentTheme | null | undefined, actionId: string): ActionConfig | null;
  getCursorStateBinding(scheme: ContentTheme | null | undefined, stateId: string, actionId: string): {
    cursorStateId: string;
    actionId: string;
    inheritedFromDefault: boolean;
  };
  getEffectiveCursorStateConfig(scheme: ContentTheme | null | undefined, stateId: string): unknown;
  resolveCursorStateId(target: unknown): string;
  matchesTriggerZone(target: unknown, triggerZone: unknown, event: unknown, meta?: Record<string, unknown>): boolean;
  isCurrentSiteEnabled(): boolean;
  getMaxActiveEffects(): number;
  syncConfigFromStorage(options: { clearStateCursorOverlay(): void }): Promise<void>;
  debouncedSyncConfigFromStorage(options: { clearStateCursorOverlay(): void }): void;
  getAtmosphereConfig(scheme: ContentTheme | null | undefined): { mode: string };
  setOnSyncComplete(callback: (() => void) | null): void;
  destroy(): void;
}

const defaultActionConfigsByThemeId = new Map<string | null, Record<string, ActionConfig>>();

function getCachedDefaultActionConfigs(themeId: string | null): Record<string, ActionConfig> {
  let configs = defaultActionConfigsByThemeId.get(themeId);
  if (!configs) {
    configs = getDefaultActionConfigs(themeId) as Record<string, ActionConfig>;
    defaultActionConfigsByThemeId.set(themeId, configs);
  }
  return configs;
}

function mergeActionConfig(base: ActionConfig, overlay?: ActionConfig): ActionConfig {
  const safeOverlay = overlay
    ? Object.fromEntries(Object.entries(overlay).filter(([, value]) => value !== undefined))
    : {};
  return {
    ...base,
    ...safeOverlay,
    textTags: Array.isArray(overlay?.textTags)
      ? [...overlay.textTags]
      : (Array.isArray(base.textTags) ? [...base.textTags] : []),
  };
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
  const cursorStateIdCache: { target: unknown; stateId: string } = { target: null, stateId: "default" };
  const ElementCtor = (window as Window & { Element?: typeof Element }).Element;

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

  function getSchemeById(schemeId: string | undefined): ContentTheme {
    const config = getConfig();
    return config.themes.find((theme) => theme.id === schemeId) || config.themes[0];
  }

  function getResolvedWebRule() {
    return resolveWebContextRule(
      getConfig().contextRules,
      window.location.hostname.trim().toLowerCase(),
      window.location.pathname || "/",
    );
  }

  function getActiveScheme(): ContentTheme {
    const action = getResolvedWebRule();
    const themeId = action?.type === "enable" ? action.themeId : undefined;
    return getSchemeById(themeId || getConfig().activeThemeId);
  }

  function isCurrentSiteEnabled(): boolean {
    const action = getResolvedWebRule();
    if (action?.type === "disable") return false;
    if (action?.type === "enable") return true;
    return getConfig().enabled;
  }

  function getMaxActiveEffects(): number {
    return getConfig().performance?.maxActiveEffects || 48;
  }

  function getActionConfig(
    scheme: ContentTheme | null | undefined,
    actionId: string,
  ): ActionConfig | null {
    if (!scheme) return null;
    const defaults = getCachedDefaultActionConfigs(scheme.id || null);
    const base = defaults[actionId] || defaults.leftClick;
    const stored = scheme.actionConfigs?.[actionId];
    return base ? mergeActionConfig(base, stored) : stored || null;
  }

  function getCursorStateBinding(
    scheme: ContentTheme | null | undefined,
    stateId: string,
    sourceActionId: string,
  ) {
    if (sourceActionId !== "leftClick") {
      return { cursorStateId: stateId, actionId: sourceActionId, inheritedFromDefault: false };
    }
    const defaultBinding = scheme?.cursorBindings?.default;
    const stateBinding = scheme?.cursorBindings?.[stateId];
    const defaultActionId = defaultBinding?.actionId || "leftClick";
    const inheritedFromDefault = stateId !== "default" && stateBinding?.mode !== "override";
    const actionId = inheritedFromDefault
      ? defaultActionId
      : (stateBinding?.actionId || defaultActionId || sourceActionId);
    return { cursorStateId: stateId, actionId, inheritedFromDefault };
  }

  function getEffectiveCursorStateConfig(
    scheme: ContentTheme | null | undefined,
    stateId: string,
  ): unknown {
    return scheme?.cursorSkin?.states?.[stateId] || scheme?.cursorSkin?.states?.default || null;
  }

  function asElement(target: unknown): Element | null {
    return ElementCtor && target instanceof ElementCtor ? target : null;
  }

  function resolveCursorStateId(target: unknown): string {
    const element = asElement(target);
    if (!element) return "default";
    if (element === cursorStateIdCache.target) return cursorStateIdCache.stateId;
    const cursor = window.getComputedStyle(element).cursor || "";
    let stateId = "default";
    if (["pointer", "grab", "grabbing", "move", "copy", "alias", "cell", "all-scroll", "crosshair", "context-menu", "zoom-in", "zoom-out"].includes(cursor) || cursor.endsWith("-resize")) {
      stateId = "pointer";
    } else if (cursor === "text" || cursor === "vertical-text") stateId = "text";
    else if (cursor === "help") stateId = "help";
    else if (cursor === "wait" || cursor === "progress") stateId = "wait";
    else if (cursor === "not-allowed" || cursor === "no-drop") stateId = "notAllowed";
    else if (element.closest(constants.TEXT_EDITABLE_SELECTOR)) stateId = "text";
    else if (element.closest(":disabled,[aria-disabled='true']")) stateId = "notAllowed";
    else if (element.closest(constants.INTERACTIVE_SELECTOR)) stateId = "pointer";
    cursorStateIdCache.target = element;
    cursorStateIdCache.stateId = stateId;
    return stateId;
  }

  function isInteractiveTarget(target: unknown): boolean {
    return Boolean(asElement(target)?.closest(constants.INTERACTIVE_SELECTOR));
  }

  function matchesTriggerZone(
    target: unknown,
    triggerZone: unknown,
    event: unknown,
    meta: Record<string, unknown> = {},
  ): boolean {
    const zone = typeof triggerZone === "string" ? triggerZone : "";
    const pointerEvent = event as { pointerType?: string; deltaY?: number } | null;
    let matched = true;
    if (zone.includes("按钮和链接")) matched = Boolean(asElement(target)?.closest("a,button,[role='button']"));
    else if (zone.includes("可交互元素")) matched = isInteractiveTarget(target);
    else if (zone.includes("空白区域")) matched = !isInteractiveTarget(target);
    else if (zone.includes("内容卡片")) matched = Boolean(asElement(target)?.closest("article,section,li,div"));
    else if (zone.includes("仅向上滚动")) matched = Number(pointerEvent?.deltaY) < 0;
    else if (zone.includes("仅向下滚动")) matched = Number(pointerEvent?.deltaY) > 0;
    diagnostics?.log("trigger-zone.check", {
      actionId: meta.actionId || null,
      triggerSource: meta.triggerSource || null,
      triggerZone: zone || "任意区域",
      matched,
      pointerType: pointerEvent?.pointerType || null,
      deltaY: Number.isFinite(pointerEvent?.deltaY) ? pointerEvent?.deltaY : null,
      target: diagnostics.describeTarget?.(target),
    });
    return matched;
  }

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

  function getAtmosphereConfig(scheme: ContentTheme | null | undefined): { mode: string } {
    const mode = scheme?.atmosphere?.mode;
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
    getActiveScheme,
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
