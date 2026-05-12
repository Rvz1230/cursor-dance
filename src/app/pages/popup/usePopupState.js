import { useEffect, useMemo, useState } from "react";
import {
  clearLivePreviewConfig,
  hydrateWorkbenchState,
  normalizeStoredConfig,
  previewThemePack,
  readActiveSiteContext,
  readExtensionConfig,
  readLivePreviewConfig,
  subscribeExtensionConfig,
  subscribeLivePreviewConfig,
  writeLivePreviewConfig,
  writeExtensionConfig,
} from "../theme-workbench/lib/extensionConfig.js";
import { ACTIONS } from "../theme-workbench/model/workbenchSchema.js";

const EMPTY_SITE = {
  host: "",
  isSupportedPage: false,
  isPreviewMode: false,
  tabId: null,
};

const EMPTY_STATE = {
  selection: {
    themeId: "",
  },
  themeLibrary: [],
  draftsByTheme: {},
};

function getPreviewActionId(config) {
  return ACTIONS.some((item) => item.id === config?.editor?.lastActionId)
    ? config.editor.lastActionId
    : "leftClick";
}

function getActionConfig(draftsByTheme, themeId, actionId) {
  return draftsByTheme[themeId]?.actionConfigs?.[actionId]
    ?? draftsByTheme[themeId]?.actionConfigs?.leftClick
    ?? null;
}

function buildInitialNotice(site) {
  if (site.isPreviewMode) {
    return { tone: "slate", message: "本地预览模式已就绪。" };
  }
  if (site.isSupportedPage) {
    return { tone: "slate", message: "已连接当前网页。" };
  }
  return { tone: "amber", message: "当前标签页不是普通网页，部分操作暂不可用。" };
}

function getErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

export function usePopupState() {
  const [config, setConfig] = useState(null);
  const [livePreviewConfig, setLivePreviewConfig] = useState(null);
  const [site, setSite] = useState(EMPTY_SITE);
  const [busyKey, setBusyKey] = useState("");
  const [notice, setNotice] = useState({ tone: "slate", message: "正在连接主题切换器…" });

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const [nextConfig, nextLivePreviewConfig, nextSite] = await Promise.all([
        readExtensionConfig(),
        readLivePreviewConfig(),
        readActiveSiteContext(),
      ]);
      if (cancelled) return;
      setConfig(nextConfig);
      setLivePreviewConfig(nextLivePreviewConfig);
      setSite(nextSite);
      setNotice(buildInitialNotice(nextSite));
    }

    hydrate();

    const unsubscribe = subscribeExtensionConfig(async (nextConfigOrUpdater) => {
      const nextSite = await readActiveSiteContext();
      if (cancelled) return;
      setSite(nextSite);
      setConfig((currentConfig) =>
        typeof nextConfigOrUpdater === "function"
          ? nextConfigOrUpdater(currentConfig ?? {})
          : nextConfigOrUpdater
      );
    });

    const unsubscribePreview = subscribeLivePreviewConfig(async (nextPreviewConfig) => {
      const nextSite = await readActiveSiteContext();
      if (cancelled) return;
      setSite(nextSite);
      setLivePreviewConfig(nextPreviewConfig);
    });

    return () => {
      cancelled = true;
      unsubscribe();
      unsubscribePreview();
    };
  }, []);

  const effectiveConfig = livePreviewConfig ?? config;

  const hydrated = useMemo(() => {
    if (!effectiveConfig) return EMPTY_STATE;
    return hydrateWorkbenchState(effectiveConfig, site);
  }, [effectiveConfig, site]);

  const activeThemeId = hydrated.selection.themeId;
  const previewActionId = getPreviewActionId(effectiveConfig);
  const activeAction = ACTIONS.find((item) => item.id === previewActionId) ?? ACTIONS[0];

  const themeChoices = useMemo(
    () =>
      hydrated.themeLibrary.map((theme) => {
        const themePack = effectiveConfig?.themePacks?.find((item) => item.id === theme.id) ?? null;
        return {
          theme,
          themePack,
          actionConfig: getActionConfig(hydrated.draftsByTheme, theme.id, previewActionId),
        };
      }),
    [effectiveConfig?.themePacks, hydrated.draftsByTheme, hydrated.themeLibrary, previewActionId]
  );

  const activeThemeChoice = themeChoices.find((item) => item.theme.id === activeThemeId) ?? themeChoices[0] ?? null;
  const enabled = effectiveConfig?.enabled !== false;

  async function commitConfig(key, updater, nextNotice) {
    setBusyKey(key);
    try {
      const currentConfig = await readExtensionConfig();
      const currentLivePreviewConfig = await readLivePreviewConfig();
      const nextConfig = normalizeStoredConfig(await updater(currentConfig));
      const savedConfig = await writeExtensionConfig(nextConfig);
      const nextLivePreviewConfig = currentLivePreviewConfig
        ? normalizeStoredConfig(await updater(currentLivePreviewConfig))
        : null;
      setConfig(savedConfig);
      if (nextLivePreviewConfig) {
        await writeLivePreviewConfig(nextLivePreviewConfig);
        setLivePreviewConfig(nextLivePreviewConfig);
      } else {
        await clearLivePreviewConfig();
        setLivePreviewConfig(null);
      }
      if (nextNotice) setNotice(nextNotice);
      return savedConfig;
    } catch (error) {
      setNotice({
        tone: "rose",
        message: getErrorMessage(error, "操作失败，请重试。"),
      });
      return null;
    } finally {
      setBusyKey("");
    }
  }

  async function setEnabled(nextEnabled) {
    await commitConfig(
      "enabled",
      async (currentConfig) => ({
        ...currentConfig,
        enabled: nextEnabled,
      }),
      {
        tone: nextEnabled ? "slate" : "amber",
        message: nextEnabled ? "全局特效已开启。" : "全局特效已暂停。",
      }
    );
  }

  async function setThemeId(themeId) {
    await commitConfig(
      "theme",
      async (currentConfig) => ({
        ...currentConfig,
        activeThemePackId: themeId,
        activeSchemeId: themeId,
        editor: {
          ...(currentConfig.editor || {}),
          lastActionId: previewActionId,
        },
      }),
      {
        tone: "slate",
        message: "当前主题已切换。",
      }
    );
  }

  async function previewCurrentTheme() {
    const targetThemePack = activeThemeChoice?.themePack;
    if (!activeThemeChoice?.theme?.id || !targetThemePack) return;

    setBusyKey("preview");
    try {
      const success = await previewThemePack(activeThemeChoice.theme.id, targetThemePack, previewActionId);
      setNotice(
        success
          ? {
            tone: "slate",
            message: site.isPreviewMode ? "已触发本地预览动画。" : "已向当前网页发送预览。",
          }
          : {
            tone: "amber",
            message: "当前页面无法预览，请刷新目标网页后重试。",
          }
      );
    } catch (error) {
      setNotice({
        tone: "rose",
        message: getErrorMessage(error, "发送预览失败，请稍后重试。"),
      });
    } finally {
      setBusyKey("");
    }
  }

  async function openOptionsPage() {
    setBusyKey("options");
    try {
      if (window.chrome?.runtime?.openOptionsPage) {
        await window.chrome.runtime.openOptionsPage();
      } else {
        window.open(new URL("/", window.location.href).toString(), "_blank", "noopener,noreferrer");
      }
      setNotice({
        tone: "slate",
        message: site.isPreviewMode ? "已打开本地主题工作台。" : "已打开主题工作台。",
      });
    } catch (error) {
      setNotice({
        tone: "rose",
        message: getErrorMessage(error, "打开主题工作台失败。"),
      });
    } finally {
      setBusyKey("");
    }
  }

  return {
    ready: Boolean(config),
    site,
    enabled,
    busyKey,
    notice,
    activeAction,
    activeThemeChoice,
    themeChoices,
    setEnabled,
    setThemeId,
    previewCurrentTheme,
    openOptionsPage,
  };
}
