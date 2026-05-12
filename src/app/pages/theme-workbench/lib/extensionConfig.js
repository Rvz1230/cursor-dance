import { ACTIONS, CURSOR_STATES, THEMES, buildThemeDrafts, createThemeDraft } from "../model/workbenchSchema.js";

const CONFIG_STORAGE_KEY = "cursordance.config";
const LEGACY_ENABLED_STORAGE_KEY = "cursordance.enabled";
const PREVIEW_MESSAGE_TYPE = "CURSORDANCE_PREVIEW_SCHEME";
const LOCAL_PREVIEW_CHANNEL_NAME = "cursordance.local-preview";
const LIVE_PREVIEW_CONFIG_STORAGE_KEY = "cursordance.livePreviewConfig";
const CURSOR_ASSET_STORAGE_KEY_PREFIX = "cursordance.cursorAsset.";
const RECENT_CURSOR_ASSETS_STORAGE_KEY = "cursordance.cursorAssetRecents";
const MAX_CURSOR_ASSET_DATA_URL_LENGTH = 600 * 1024;
const MAX_RECENT_CURSOR_ASSETS = 6;
const THEME_TONES = ["amber", "teal", "sky", "rose"];
let localPreviewChannel = null;
let previewStorageAccessPromise = null;

function getChromeApi() {
  if (typeof window === "undefined") return null;
  return window.chrome ?? null;
}

function postLocalPreviewMessage(message) {
  if (typeof window === "undefined" || typeof window.BroadcastChannel !== "function") return;
  localPreviewChannel ??= new window.BroadcastChannel(LOCAL_PREVIEW_CHANNEL_NAME);
  localPreviewChannel.postMessage(message);
}

async function ensurePreviewStorageAccess(chromeApi) {
  if (!chromeApi?.storage?.session?.setAccessLevel) return;
  if (!previewStorageAccessPromise) {
    previewStorageAccessPromise = chromeApi.storage.session
      .setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })
      .catch(() => {});
  }
  await previewStorageAccessPromise;
}

function canUseLocalStorage() {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    const probeKey = "__cursordance_preview_probe__";
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

function readLocalStorageConfig() {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    const legacyEnabledRaw = window.localStorage.getItem(LEGACY_ENABLED_STORAGE_KEY);
    const defaultConfig = getDefaultConfig();
    const parsed = raw ? JSON.parse(raw) : null;
    return normalizeStoredConfig(
      parsed || {
        ...defaultConfig,
        enabled: legacyEnabledRaw !== "false",
      }
    );
  } catch {
    return normalizeStoredConfig(getDefaultConfig());
  }
}

function writeLocalStorageConfig(config) {
  if (!canUseLocalStorage()) return normalizeStoredConfig(config);
  const normalized = normalizeStoredConfig(config);
  try {
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(normalized));
    window.localStorage.setItem(LEGACY_ENABLED_STORAGE_KEY, String(normalized.enabled !== false));
    postLocalPreviewMessage({
      type: "config-updated",
      config: normalized,
    });
  } catch {
    return normalized;
  }
  return normalized;
}

function readLocalStoragePreviewConfig() {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(LIVE_PREVIEW_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    return normalizeStoredConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeLocalStoragePreviewConfig(config) {
  if (!canUseLocalStorage()) return normalizeStoredConfig(config);
  const normalized = normalizeStoredConfig(config);
  try {
    window.localStorage.setItem(LIVE_PREVIEW_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
    postLocalPreviewMessage({
      type: "preview-config-updated",
      config: normalized,
    });
  } catch {
    return normalized;
  }
  return normalized;
}

function clearLocalStoragePreviewConfig() {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.removeItem(LIVE_PREVIEW_CONFIG_STORAGE_KEY);
    postLocalPreviewMessage({ type: "preview-config-cleared" });
  } catch {
    // Ignore local preview cleanup failures.
  }
}

function getDefaultConfig() {
  return window.CursorDanceDefaultConfig ?? {};
}

function getRuntimeConfig() {
  return window.CursorDanceConfigRuntime ?? {};
}

function buildCursorAssetStorageKey(themeId, stateId) {
  return `${CURSOR_ASSET_STORAGE_KEY_PREFIX}${themeId}.${stateId}`;
}

function buildCursorAssetStorageKeys(config) {
  return (config.themePacks || []).flatMap((themePack) =>
    CURSOR_STATES.map((state) => buildCursorAssetStorageKey(themePack.id, state.id))
  );
}

function withResolvedCursorAssets(config, assetEntries) {
  const assetMap = assetEntries || {};
  const nextThemePacks = (config.themePacks || []).map((themePack) => ({
    ...themePack,
    cursorStates: Object.fromEntries(
      CURSOR_STATES.map((state) => {
        const currentState = themePack.cursorStates?.[state.id] || {};
        const assetRecord = assetMap[buildCursorAssetStorageKey(themePack.id, state.id)];
        return [
          state.id,
          {
            ...currentState,
            imageDataUrl: assetRecord?.imageDataUrl || currentState.imageDataUrl || "",
          },
        ];
      })
    ),
  }));

  return {
    ...config,
    themePacks: nextThemePacks,
    schemes: nextThemePacks,
  };
}

async function resolveCursorAssetsForConfig(config, chromeApi) {
  if (!chromeApi?.storage?.local) return config;
  const assetKeys = buildCursorAssetStorageKeys(config);
  if (!assetKeys.length) return config;
  const assetEntries = await chromeApi.storage.local.get(assetKeys);
  return withResolvedCursorAssets(config, assetEntries);
}

function stripInlineCursorAssets(config) {
  const nextThemePacks = (config.themePacks || []).map((themePack) => ({
    ...themePack,
    cursorStates: Object.fromEntries(
      Object.entries(themePack.cursorStates || {}).map(([stateId, stateConfig]) => [
        stateId,
        {
          ...stateConfig,
          imageDataUrl: "",
        },
      ])
    ),
  }));

  return {
    ...config,
    themePacks: nextThemePacks,
    schemes: nextThemePacks,
  };
}

export function normalizeStoredConfig(value) {
  const runtime = getRuntimeConfig();
  const defaultConfig = getDefaultConfig();
  if (typeof runtime.normalizeConfig === "function") {
    return runtime.normalizeConfig(value, defaultConfig);
  }
  return value ?? defaultConfig;
}

export async function readExtensionConfig() {
  const chromeApi = getChromeApi();
  const defaultConfig = getDefaultConfig();

  if (!chromeApi?.storage?.local) {
    return readLocalStorageConfig() || normalizeStoredConfig(defaultConfig);
  }

  const result = await chromeApi.storage.local.get([CONFIG_STORAGE_KEY, LEGACY_ENABLED_STORAGE_KEY]);
  const storedConfig = result[CONFIG_STORAGE_KEY];
  const nextConfig = normalizeStoredConfig(
    storedConfig || {
      ...defaultConfig,
      enabled: result[LEGACY_ENABLED_STORAGE_KEY] !== false,
    }
  );

  if (!storedConfig || getRuntimeConfig().needsMigration?.(storedConfig)) {
    return writeExtensionConfig(nextConfig);
  }

  return resolveCursorAssetsForConfig(nextConfig, chromeApi);
}

export async function readLivePreviewConfig() {
  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.session) {
    return readLocalStoragePreviewConfig();
  }

  await ensurePreviewStorageAccess(chromeApi);
  try {
    const result = await chromeApi.storage.session.get([LIVE_PREVIEW_CONFIG_STORAGE_KEY]);
    return result[LIVE_PREVIEW_CONFIG_STORAGE_KEY]
      ? normalizeStoredConfig(result[LIVE_PREVIEW_CONFIG_STORAGE_KEY])
      : null;
  } catch {
    return null;
  }
}

export async function writeExtensionConfig(config) {
  const chromeApi = getChromeApi();
  const normalized = normalizeStoredConfig(config);

  if (!chromeApi?.storage?.local) {
    return writeLocalStorageConfig(normalized);
  }

  const assetWrites = {};
  const assetRemovals = [];
  Object.values(normalized.themePacks || []).forEach((themePack) => {
    Object.entries(themePack?.cursorStates || {}).forEach(([stateId, stateConfig]) => {
      if ((stateConfig?.imageDataUrl || "").length > MAX_CURSOR_ASSET_DATA_URL_LENGTH) {
        throw new Error(`光标图片过大，当前 ${stateId} 状态请换成更小的 PNG / WebP 后再保存。`);
      }
      const assetKey = buildCursorAssetStorageKey(themePack.id, stateId);
      if (stateConfig?.imageDataUrl) {
        assetWrites[assetKey] = {
          imageDataUrl: stateConfig.imageDataUrl,
          updatedAt: Date.now(),
        };
      } else {
        assetRemovals.push(assetKey);
      }
    });
  });

  if (Object.keys(assetWrites).length) {
    await chromeApi.storage.local.set(assetWrites);
  }
  if (assetRemovals.length) {
    await chromeApi.storage.local.remove(assetRemovals);
  }

  const configForStorage = stripInlineCursorAssets(normalized);
  await chromeApi.storage.local.set({ [CONFIG_STORAGE_KEY]: configForStorage });
  return resolveCursorAssetsForConfig(configForStorage, chromeApi);
}

export async function writeLivePreviewConfig(config) {
  const chromeApi = getChromeApi();
  const normalized = normalizeStoredConfig(config);

  if (!chromeApi?.storage?.session) {
    return writeLocalStoragePreviewConfig(normalized);
  }

  await ensurePreviewStorageAccess(chromeApi);
  await chromeApi.storage.session.set({ [LIVE_PREVIEW_CONFIG_STORAGE_KEY]: normalized });
  return normalized;
}

export async function clearLivePreviewConfig() {
  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.session) {
    clearLocalStoragePreviewConfig();
    return;
  }

  await ensurePreviewStorageAccess(chromeApi);
  await chromeApi.storage.session.remove([LIVE_PREVIEW_CONFIG_STORAGE_KEY]);
}

export function subscribeExtensionConfig(onChange) {
  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.onChanged) {
    if (!canUseLocalStorage()) return () => {};
    function handleStorage(event) {
      if (event.key !== CONFIG_STORAGE_KEY && event.key !== LEGACY_ENABLED_STORAGE_KEY) return;
      onChange(readLocalStorageConfig() || normalizeStoredConfig(getDefaultConfig()));
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }

  async function handleChanges(changes, areaName) {
    if (areaName !== "local") return;

    const changedKeys = Object.keys(changes);
    if (changedKeys.some((key) => key === CONFIG_STORAGE_KEY || key.startsWith(CURSOR_ASSET_STORAGE_KEY_PREFIX))) {
      onChange(await readExtensionConfig());
      return;
    }

    if (changes[LEGACY_ENABLED_STORAGE_KEY]) {
      onChange((currentConfig) =>
        normalizeStoredConfig({
          ...currentConfig,
          enabled: changes[LEGACY_ENABLED_STORAGE_KEY].newValue !== false,
        })
      );
    }
  }

  chromeApi.storage.onChanged.addListener(handleChanges);
  return () => chromeApi.storage.onChanged.removeListener(handleChanges);
}

export function subscribeLivePreviewConfig(onChange) {
  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.onChanged) {
    if (!canUseLocalStorage()) return () => {};

    function handleStorage(event) {
      if (event.key !== LIVE_PREVIEW_CONFIG_STORAGE_KEY) return;
      onChange(readLocalStoragePreviewConfig());
    }

    window.addEventListener("storage", handleStorage);

    let channel = null;
    const handleBroadcast = (event) => {
      const message = event.data || {};
      if (message.type === "preview-config-updated") {
        onChange(normalizeStoredConfig(message.config));
      }
      if (message.type === "preview-config-cleared") {
        onChange(null);
      }
    };

    if (typeof window !== "undefined" && typeof window.BroadcastChannel === "function") {
      channel = new window.BroadcastChannel(LOCAL_PREVIEW_CHANNEL_NAME);
      channel.addEventListener("message", handleBroadcast);
    }

    return () => {
      window.removeEventListener("storage", handleStorage);
      channel?.removeEventListener("message", handleBroadcast);
      channel?.close();
    };
  }

  async function handleChanges(changes, areaName) {
    if (areaName !== "session" || !changes[LIVE_PREVIEW_CONFIG_STORAGE_KEY]) return;
    const nextValue = changes[LIVE_PREVIEW_CONFIG_STORAGE_KEY].newValue;
    onChange(nextValue ? normalizeStoredConfig(nextValue) : null);
  }

  chromeApi.storage.onChanged.addListener(handleChanges);
  return () => chromeApi.storage.onChanged.removeListener(handleChanges);
}

export async function readRecentCursorAssets() {
  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.local) return [];

  const result = await chromeApi.storage.local.get([RECENT_CURSOR_ASSETS_STORAGE_KEY]);
  return Array.isArray(result[RECENT_CURSOR_ASSETS_STORAGE_KEY]) ? result[RECENT_CURSOR_ASSETS_STORAGE_KEY] : [];
}

export async function writeRecentCursorAsset(assetRecord) {
  const chromeApi = getChromeApi();
  if (!chromeApi?.storage?.local || !assetRecord?.imageDataUrl) return [];

  const current = await readRecentCursorAssets();
  const nextRecord = {
    id: assetRecord.id || `recent-${Date.now()}`,
    imageDataUrl: assetRecord.imageDataUrl,
    name: assetRecord.name || "未命名素材",
    mimeType: assetRecord.mimeType || "image/png",
    hotspotX: assetRecord.hotspotX ?? 16,
    hotspotY: assetRecord.hotspotY ?? 32,
    size: assetRecord.size ?? 48,
    updatedAt: assetRecord.updatedAt || Date.now(),
  };

  const deduped = [nextRecord, ...current.filter((item) => item.imageDataUrl !== nextRecord.imageDataUrl)]
    .slice(0, MAX_RECENT_CURSOR_ASSETS);

  await chromeApi.storage.local.set({ [RECENT_CURSOR_ASSETS_STORAGE_KEY]: deduped });
  return deduped;
}

export async function readActiveSiteContext() {
  const chromeApi = getChromeApi();
  if (!chromeApi?.tabs?.query) {
    const isPreviewPage = typeof window !== "undefined"
      && /^(http|https):$/.test(window.location.protocol)
      && window.location.hostname.length > 0;
    return {
      host: isPreviewPage ? window.location.hostname.toLowerCase() : "example.com",
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
      host: isSupportedPage ? url.hostname.toLowerCase() : "example.com",
      isSupportedPage,
      isPreviewMode: false,
      tabId: activeTab?.id ?? null,
    };
  } catch {
    return {
      host: "example.com",
      isSupportedPage: false,
      isPreviewMode: false,
      tabId: null,
    };
  }
}

export async function previewThemePack(themeId, themePack, actionId = "leftClick") {
  const chromeApi = getChromeApi();
  const site = await readActiveSiteContext();
  if (!chromeApi?.tabs?.sendMessage) {
    if (!site.isSupportedPage) return false;
    postLocalPreviewMessage({
      type: "preview-theme",
      themeId,
      themePack,
      actionId,
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("CURSORDANCE_POPUP_PREVIEW", {
          detail: { themeId, themePack, actionId },
        })
      );
    }
    return true;
  }
  if (site.tabId == null || !site.isSupportedPage) return false;

  try {
    await chromeApi.tabs.sendMessage(site.tabId, {
      type: PREVIEW_MESSAGE_TYPE,
      schemeId: themeId,
      scheme: themePack,
      actionId,
    });
    return true;
  } catch {
    return false;
  }
}

function toWorkbenchCursorMode(stateId, mode) {
  if (stateId === "default") {
    return mode === "override" ? "覆盖" : "源";
  }
  return mode === "override" ? "覆盖" : "继承";
}

function toExtensionCursorState(mode, actionId) {
  return {
    mode: mode === "覆盖" ? "override" : "inherit",
    actionId: typeof actionId === "string" ? actionId : "leftClick",
  };
}

function mapFontWeightToWorkbench(fontWeight) {
  if (fontWeight >= 700) return "加粗";
  if (fontWeight >= 600) return "中等";
  return "常规";
}

function mapFontWeightToStored(weight) {
  if (weight === "加粗") return 800;
  if (weight === "中等") return 600;
  return 500;
}

function getOrderedTextTags(actionConfig) {
  const currentTags = Array.isArray(actionConfig?.textTags) ? actionConfig.textTags.filter(Boolean) : [];
  const primaryText = typeof actionConfig?.textContent === "string" ? actionConfig.textContent.trim() : "";
  if (!primaryText) return currentTags;
  return [primaryText, ...currentTags.filter((item) => item !== primaryText)];
}

function inferTextKindFromEffect(textEffect, fallbackKind = "数字飘字") {
  if (textEffect?.kind === "text") return "文本飘字";
  if (textEffect?.kind === "number") return "数字飘字";

  const tags = Array.isArray(textEffect?.tags) ? textEffect.tags.filter(Boolean) : [];
  if (tags.length > 1) return "文本飘字";

  const content = typeof textEffect?.content === "string" ? textEffect.content.trim() : "";
  if (!content) return fallbackKind;
  if (content.includes("${number}")) return "数字飘字";

  const compactContent = content.replace(/\s+/g, "");
  if (/^[+\-]?\d+$/.test(compactContent)) return "数字飘字";
  if (/^[+\-]?[一二三四五六七八九十百千万]+$/.test(compactContent)) return "数字飘字";
  if (/^(one|two|three|four|five|six|seven|eight|nine|ten)$/i.test(compactContent)) return "数字飘字";

  return "文本飘字";
}

function resolveNumberStyleFromEffect(textEffect, fallbackStyle) {
  const numberStyle = String(textEffect?.numberStyle || "").toLowerCase();
  if (numberStyle.includes("zh") || numberStyle.includes("cn") || numberStyle.includes("中文")) {
    return "中文数字 (一, 二, 三)";
  }
  if (numberStyle.includes("en") || numberStyle.includes("英文")) {
    return "英文单词 (one, two, three)";
  }
  if (numberStyle.includes("arabic") || numberStyle.includes("digit") || numberStyle.includes("阿拉伯")) {
    return "阿拉伯数字 (1, 2, 3)";
  }
  return fallbackStyle;
}

function resolveTextModeFromEffect(textEffect, fallbackMode) {
  if (textEffect?.mode === "template") return "模板模式";
  if (textEffect?.mode === "default") return "默认模式 (+1)";
  if (typeof textEffect?.template === "string" && textEffect.template.includes("${number}")) return "模板模式";
  if (typeof textEffect?.content === "string" && textEffect.content.includes("${number}")) return "模板模式";
  return fallbackMode;
}

function resolveFallbackActionTextConfig(baseActionConfig, textEffect) {
  const textKind = inferTextKindFromEffect(textEffect, baseActionConfig.textKind);
  const textStyle = resolveNumberStyleFromEffect(textEffect, baseActionConfig.textStyle);
  const textMode = resolveTextModeFromEffect(textEffect, baseActionConfig.textMode);
  const textTags = Array.isArray(textEffect?.tags) ? textEffect.tags.filter(Boolean) : [];
  const primaryText = typeof textEffect?.content === "string" ? textEffect.content.trim() : "";

  if (textKind === "文本飘字") {
    const orderedTags = Array.from(new Set([primaryText, ...textTags, ...baseActionConfig.textTags].filter(Boolean)));
    return {
      textKind,
      textStyle,
      textMode,
      textTemplate: baseActionConfig.textTemplate,
      textContent: orderedTags[0] ?? "",
      textTags: orderedTags,
      textTagPlayMode: textEffect?.tagPlayMode || baseActionConfig.textTagPlayMode,
      comboEnabled: false,
    };
  }

  return {
    textKind,
    textStyle,
    textMode,
    textTemplate:
      typeof textEffect?.template === "string" && textEffect.template
        ? textEffect.template
        : (typeof textEffect?.content === "string" && textEffect.content.includes("${number}")
          ? textEffect.content
          : baseActionConfig.textTemplate),
    textContent: "",
    textTags: baseActionConfig.textTags,
    textTagPlayMode: baseActionConfig.textTagPlayMode,
    comboEnabled: textEffect?.comboEnabled ?? baseActionConfig.comboEnabled,
  };
}

function getKnownTheme(themeId) {
  return THEMES.find((theme) => theme.id === themeId);
}

function toThemeKindLabel(kind) {
  return kind === "builtin" ? "内置" : "自定义";
}

function pickThemeTone(themeId, fallbackIndex = 0) {
  return getKnownTheme(themeId)?.tone || THEME_TONES[fallbackIndex % THEME_TONES.length];
}

export function themePackToThemeLibraryItem(themePack, fallbackIndex = 0) {
  const knownTheme = getKnownTheme(themePack?.id);
  const description = themePack?.description || knownTheme?.summary || "未填写说明";
  return {
    id: themePack?.id || `theme-${fallbackIndex + 1}`,
    name: themePack?.name || knownTheme?.name || `主题 ${fallbackIndex + 1}`,
    kind: toThemeKindLabel(themePack?.kind || knownTheme?.kind || "custom"),
    summary: description,
    description,
    tone: pickThemeTone(themePack?.id, fallbackIndex),
  };
}

function buildDraftFromThemePack(themePack, siteMode) {
  const themeId = themePack?.id;
  const baseDraft = createThemeDraft(themeId);
  if (themePack?.workbenchDraft?.actionConfigs) {
    return {
      ...baseDraft,
      ...themePack.workbenchDraft,
      siteMode,
      actionConfigs: {
        ...baseDraft.actionConfigs,
        ...(themePack.workbenchDraft.actionConfigs || {}),
      },
      cursorModes: {
        ...baseDraft.cursorModes,
        ...(themePack.workbenchDraft.cursorModes || {}),
      },
      cursorStateActions: {
        ...baseDraft.cursorStateActions,
        ...(themePack.workbenchDraft.cursorStateActions || {}),
      },
      cursorStateAssets: {
        ...baseDraft.cursorStateAssets,
        ...(themePack.workbenchDraft.cursorStateAssets || {}),
        ...Object.fromEntries(
          CURSOR_STATES.map((state) => [
            state.id,
            {
              ...baseDraft.cursorStateAssets[state.id],
              ...(themePack.workbenchDraft.cursorStateAssets?.[state.id] || {}),
              imageDataUrl:
                themePack?.cursorStates?.[state.id]?.imageDataUrl
                || themePack.workbenchDraft.cursorStateAssets?.[state.id]?.imageDataUrl
                || baseDraft.cursorStateAssets[state.id].imageDataUrl,
              hotspotX:
                themePack?.cursorStates?.[state.id]?.hotspotX
                ?? themePack.workbenchDraft.cursorStateAssets?.[state.id]?.hotspotX
                ?? baseDraft.cursorStateAssets[state.id].hotspotX,
              hotspotY:
                themePack?.cursorStates?.[state.id]?.hotspotY
                ?? themePack.workbenchDraft.cursorStateAssets?.[state.id]?.hotspotY
                ?? baseDraft.cursorStateAssets[state.id].hotspotY,
              size:
                themePack?.cursorStates?.[state.id]?.size
                ?? themePack.workbenchDraft.cursorStateAssets?.[state.id]?.size
                ?? baseDraft.cursorStateAssets[state.id].size,
            },
          ])
        ),
      },
    };
  }
  const clickConfig = themePack?.behavior?.click ?? {};
  const effects = clickConfig.effects ?? {};
  const textEffect = effects.text ?? {};
  const rippleEffect = effects.ripple ?? {};
  const particleEffect = effects.particle ?? {};
  const fallbackTextConfig = resolveFallbackActionTextConfig(baseDraft.actionConfigs.leftClick, textEffect);
  const nextCursorModes = Object.fromEntries(
    CURSOR_STATES.map((state) => [
      state.id,
      toWorkbenchCursorMode(state.id, themePack?.cursorStates?.[state.id]?.mode),
    ])
  );
  const nextCursorStateActions = Object.fromEntries(
    CURSOR_STATES.map((state) => [
      state.id,
      themePack?.cursorStates?.[state.id]?.actionId || baseDraft.cursorStateActions[state.id],
    ])
  );
  const nextCursorStateAssets = Object.fromEntries(
    CURSOR_STATES.map((state) => [
      state.id,
      {
        ...baseDraft.cursorStateAssets[state.id],
        imageDataUrl: themePack?.cursorStates?.[state.id]?.imageDataUrl || baseDraft.cursorStateAssets[state.id].imageDataUrl,
        hotspotX: themePack?.cursorStates?.[state.id]?.hotspotX ?? baseDraft.cursorStateAssets[state.id].hotspotX,
        hotspotY: themePack?.cursorStates?.[state.id]?.hotspotY ?? baseDraft.cursorStateAssets[state.id].hotspotY,
        size: themePack?.cursorStates?.[state.id]?.size ?? baseDraft.cursorStateAssets[state.id].size,
      },
    ])
  );

  return {
    ...baseDraft,
    siteMode,
    cursorModes: nextCursorModes,
    cursorStateActions: nextCursorStateActions,
    cursorStateAssets: nextCursorStateAssets,
    actionConfigs: {
      ...baseDraft.actionConfigs,
      leftClick: {
        ...baseDraft.actionConfigs.leftClick,
        ...fallbackTextConfig,
        textEnabled: textEffect.enabled !== false,
        textColor: textEffect.color ?? baseDraft.actionConfigs.leftClick.textColor,
        fontSize: textEffect.fontSize ?? baseDraft.actionConfigs.leftClick.fontSize,
        textWeight: mapFontWeightToWorkbench(textEffect.fontWeight ?? 800),
        textOffsetX: textEffect.offsetX ?? baseDraft.actionConfigs.leftClick.textOffsetX,
        textOffsetY: textEffect.offsetY ?? baseDraft.actionConfigs.leftClick.textOffsetY,
        textDuration: textEffect.durationMs ?? baseDraft.actionConfigs.leftClick.textDuration,
        ripple: rippleEffect.enabled !== false,
        rippleSize: rippleEffect.size ?? baseDraft.actionConfigs.leftClick.rippleSize,
        rippleDuration: rippleEffect.durationMs ?? baseDraft.actionConfigs.leftClick.rippleDuration,
        particle: particleEffect.enabled !== false,
        particleCount: particleEffect.count ?? baseDraft.actionConfigs.leftClick.particleCount,
        particleSize: particleEffect.size ?? baseDraft.actionConfigs.leftClick.particleSize,
        particleSpread: particleEffect.baseDistance ?? baseDraft.actionConfigs.leftClick.particleSpread,
        particleDuration: particleEffect.durationMs ?? baseDraft.actionConfigs.leftClick.particleDuration,
        holdMs: clickConfig.trigger?.cooldownMs ?? baseDraft.actionConfigs.leftClick.holdMs,
      },
    },
  };
}

export function draftFromThemePack(themePack, siteMode = "跟随全局") {
  return buildDraftFromThemePack(themePack, siteMode);
}

export function buildThemeLibrary(config) {
  const themePacks = Array.isArray(config?.themePacks) ? config.themePacks : [];
  return themePacks.map((themePack, index) => themePackToThemeLibraryItem(themePack, index));
}

export function hydrateWorkbenchState(config, site) {
  const storedThemePacks = Array.isArray(config?.themePacks) ? config.themePacks : [];
  const siteMode = getRuntimeConfig().getSiteMode?.(config, site.host) ?? "inherit";
  const themeLibrary = buildThemeLibrary(config);
  const draftsByTheme = buildThemeDrafts(themeLibrary);

  storedThemePacks.forEach((themePack) => {
    draftsByTheme[themePack.id] = buildDraftFromThemePack(themePack, toWorkbenchSiteMode(siteMode));
  });

  Object.keys(draftsByTheme).forEach((themeId) => {
    draftsByTheme[themeId] = {
      ...draftsByTheme[themeId],
      siteMode: toWorkbenchSiteMode(siteMode),
    };
  });

  const selectedThemeId = draftsByTheme[config.activeThemePackId] ? config.activeThemePackId : (themeLibrary[0]?.id || THEMES[0].id);
  const workspaceAliasMap = {
    workspace: "workbench",
    diagnostics: "states",
    assets: "sites",
  };
  const workspaceId = workspaceAliasMap[config.editor?.lastWorkspace] || config.editor?.lastWorkspace || "workbench";
  const selectedActionId = ACTIONS.some((item) => item.id === config.editor?.lastActionId) ? config.editor.lastActionId : "leftClick";
  const selectedCursorStateId = CURSOR_STATES.some((item) => item.id === config.editor?.lastCursorState) ? config.editor.lastCursorState : "default";

  return {
    workspaceId,
    selection: {
      themeId: selectedThemeId,
      actionId: selectedActionId,
      cursorStateId: selectedCursorStateId,
    },
    themeLibrary,
    siteRulesByHost: {
      ...(config.siteRules?.byHost || {}),
    },
    ui: {
      enabled: config.enabled !== false,
      unsaved: false,
      siteFilter: "",
    },
    site,
    draftsByTheme,
  };
}

function toWorkbenchSiteMode(mode) {
  if (mode === "enabled") return "当前启用";
  if (mode === "disabled") return "当前禁用";
  return "跟随全局";
}

function toStoredSiteMode(mode) {
  if (mode === "当前启用") return "enabled";
  if (mode === "当前禁用") return "disabled";
  return "inherit";
}

function getStoredThemePack(config, themeId) {
  return config.themePacks.find((item) => item.id === themeId) ?? getDefaultConfig().themePacks?.find((item) => item.id === themeId) ?? null;
}

function buildStoredThemePack(themeId, draft, previousConfig, themeRecord) {
  const knownTheme = getKnownTheme(themeId);
  const previousThemePack = getStoredThemePack(previousConfig, themeId) ?? {};
  const previousEffects = previousThemePack.behavior?.click?.effects ?? {};
  const actionConfig = draft.actionConfigs.leftClick;
  const orderedTextTags = getOrderedTextTags(actionConfig);
  const textContent =
    actionConfig.textKind === "数字飘字"
      ? actionConfig.textMode === "模板模式"
        ? actionConfig.textTemplate.replace("${number}", "1")
        : ""
      : orderedTextTags[0] || actionConfig.textContent || "";

  return {
    ...previousThemePack,
    id: themeId,
    name: themeRecord?.name ?? knownTheme?.name ?? previousThemePack.name ?? themeId,
    description: themeRecord?.description ?? themeRecord?.summary ?? knownTheme?.summary ?? previousThemePack.description ?? "",
    kind: themeRecord?.kind === "内置" || knownTheme?.kind === "内置" ? "builtin" : previousThemePack.kind || "custom",
    workbenchDraft: {
      actionConfigs: draft.actionConfigs,
      cursorModes: draft.cursorModes,
      cursorStateActions: draft.cursorStateActions,
    },
    cursorStates: Object.fromEntries(
      CURSOR_STATES.map((state) => [
        state.id,
        {
          ...toExtensionCursorState(draft.cursorModes[state.id], draft.cursorStateActions?.[state.id]),
          imageDataUrl: draft.cursorStateAssets?.[state.id]?.imageDataUrl || "",
          hotspotX: draft.cursorStateAssets?.[state.id]?.hotspotX ?? 16,
          hotspotY: draft.cursorStateAssets?.[state.id]?.hotspotY ?? 32,
          size: draft.cursorStateAssets?.[state.id]?.size ?? 48,
        },
      ])
    ),
    behavior: {
      ...previousThemePack.behavior,
      click: {
        ...previousThemePack.behavior?.click,
        enabled: actionConfig.textEnabled || actionConfig.particle || actionConfig.ripple,
        trigger: {
          ...previousThemePack.behavior?.click?.trigger,
          button: "left",
          cooldownMs: actionConfig.holdMs,
        },
        effects: {
          ...previousEffects,
          text: {
            ...previousEffects.text,
            enabled: actionConfig.textEnabled,
            kind: actionConfig.textKind === "文本飘字" ? "text" : "number",
            numberStyle: actionConfig.textStyle,
            mode: actionConfig.textMode === "模板模式" ? "template" : "default",
            template: actionConfig.textTemplate,
            tags: orderedTextTags,
            tagPlayMode: actionConfig.textTagPlayMode,
            comboEnabled: actionConfig.comboEnabled,
            content: textContent,
            color: actionConfig.textColor,
            fontSize: actionConfig.fontSize,
            fontWeight: mapFontWeightToStored(actionConfig.textWeight),
            offsetX: actionConfig.textOffsetX,
            offsetY: actionConfig.textOffsetY,
            durationMs: actionConfig.textDuration,
          },
          ripple: {
            ...previousEffects.ripple,
            enabled: actionConfig.ripple,
            size: actionConfig.rippleSize,
            durationMs: actionConfig.rippleDuration,
          },
          particle: {
            ...previousEffects.particle,
            enabled: actionConfig.particle,
            count: actionConfig.particleCount,
            size: actionConfig.particleSize,
            baseDistance: actionConfig.particleSpread,
            durationMs: actionConfig.particleDuration,
          },
        },
      },
    },
  };
}

export function buildPreviewThemePackFromWorkbench(previousConfig, state) {
  return buildStoredThemePack(
    state.selection.themeId,
    state.draftsByTheme[state.selection.themeId],
    previousConfig,
    state.themeLibrary.find((item) => item.id === state.selection.themeId)
  );
}

export function buildStoredConfigFromWorkbench(previousConfig, state) {
  const nextThemePacks = (state.themeLibrary || []).map((theme) =>
    buildStoredThemePack(theme.id, state.draftsByTheme[theme.id], previousConfig, theme)
  );

  const workspaceId = state.workspaceId === "workbench" ? "workspace" : state.workspaceId;
  const siteMode = toStoredSiteMode(state.draftsByTheme[state.selection.themeId].siteMode);
  const runtime = getRuntimeConfig();
  const nextConfig = {
    ...previousConfig,
    enabled: state.ui.enabled,
    activeThemePackId: state.selection.themeId,
    activeSchemeId: state.selection.themeId,
    themePacks: nextThemePacks,
    schemes: nextThemePacks,
    siteRules: {
      ...(previousConfig.siteRules || {}),
      byHost: {
        ...(state.siteRulesByHost || {}),
      },
    },
    editor: {
      ...(previousConfig.editor || {}),
      lastWorkspace: workspaceId,
      lastActionId: state.selection.actionId,
      lastCursorState: state.selection.cursorStateId,
    },
  };

  if (state.site.host && typeof runtime.setSiteRuleMode === "function") {
    return normalizeStoredConfig(runtime.setSiteRuleMode(nextConfig, state.site.host, siteMode));
  }

  return normalizeStoredConfig(nextConfig);
}
