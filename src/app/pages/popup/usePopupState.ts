import { useEffect, useMemo, useState } from "react";
import {
  createWorkbenchThemeState,
  clearLivePreviewConfig,
  clearRuntimeErrors,
  hydrateWorkbenchState,
  normalizeStoredConfig,
  previewThemePack,
  readActiveSiteContext,
  readExtensionConfig,
  readLivePreviewConfig,
  readRuntimeErrors,
  subscribeExtensionConfig,
  subscribeLivePreviewConfig,
  writeExtensionConfig,
} from "../theme-workbench/lib/extensionConfig";
import { getRuntimeConfig } from "../theme-workbench/lib/runtimeConfig";
import { ACTIONS } from "../theme-workbench/model/workbenchSchema";

const EMPTY_SITE = {
  host: "",
  isSupportedPage: false,
  isPreviewMode: false,
  tabId: null,
};

const EMPTY_THEME_STATE = createWorkbenchThemeState([]);

const EMPTY_STATE = {
  selection: {
    themeId: EMPTY_THEME_STATE.selectedThemeId,
  },
  themeLibrary: EMPTY_THEME_STATE.themeLibrary,
  draftsByTheme: EMPTY_THEME_STATE.draftsByTheme,
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

function getSiteAction(config, host, path) {
  if (!config) return null;
  var runtime = getRuntimeConfig();
  if (typeof runtime.resolveSiteRule === "function") {
    return runtime.resolveSiteRule(config.siteRules, host, path);
  }
  return null;
}

export function getEffectiveActiveThemeId(siteAction, activeThemeId) {
  if (siteAction && siteAction.enable && siteAction.theme) {
    return siteAction.theme;
  }
  return activeThemeId;
}

export function resolveNextConfigForThemeChange(currentConfig, site, themeId, previewActionId) {
  var host = site.host || "";
  var pathname = "/";
  var runtime = getRuntimeConfig();
  var rules = Array.isArray(currentConfig.siteRules) ? currentConfig.siteRules : [];

  var matchedIndex = -1;
  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];
    if (rule && rule.enabled !== false && typeof runtime.matchPattern === "function" && runtime.matchPattern(host, pathname, rule.pattern)) {
      matchedIndex = i;
      break;
    }
  }

  if (matchedIndex >= 0 && host) {
    var matchedRule = rules[matchedIndex];
    var nextRules = rules.slice();
    if (matchedRule.action && typeof matchedRule.action === "object" && matchedRule.action.enable) {
      nextRules[matchedIndex] = { ...matchedRule, action: { ...matchedRule.action, theme: themeId } };
    } else if (matchedRule.action === "disable") {
      nextRules[matchedIndex] = { ...matchedRule, action: { enable: true, theme: themeId } };
    } else {
      nextRules[matchedIndex] = { ...matchedRule, action: { enable: true, theme: themeId } };
    }
    return { ...currentConfig, siteRules: nextRules };
  }

  return {
    ...currentConfig,
    activeThemePackId: themeId,
    activeSchemeId: themeId,
    editor: {
      ...(currentConfig.editor || {}),
      lastActionId: previewActionId,
    },
  };
}

export function usePopupState() {
  const [config, setConfig] = useState(null);
  const [livePreviewConfig, setLivePreviewConfig] = useState(null);
  const [site, setSite] = useState(EMPTY_SITE);
  const [busyKey, setBusyKey] = useState("");
  const [notice, setNotice] = useState({ tone: "slate", message: "正在连接主题切换器…" });
  const [runtimeErrors, setRuntimeErrors] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const [nextConfig, nextLivePreviewConfig, nextSite, errors] = await Promise.all([
        readExtensionConfig(),
        readLivePreviewConfig(),
        readActiveSiteContext(),
        readRuntimeErrors(),
      ]);
      if (cancelled) return;
      setConfig(nextConfig);
      setLivePreviewConfig(nextLivePreviewConfig);
      setSite(nextSite);
      setRuntimeErrors(errors);
      if (errors.length > 0) {
        clearRuntimeErrors();
        setNotice({
          tone: "amber",
          message: `检测到 ${errors.length} 个运行时问题：${errors.map((e) => e.type).join("、")}`,
        });
      } else {
        setNotice(buildInitialNotice(nextSite));
      }
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
  var siteAction = getSiteAction(effectiveConfig, site.host, "/");
  const effectiveActiveThemeId = getEffectiveActiveThemeId(siteAction, activeThemeId);
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

  const activeThemeChoice = themeChoices.find((item) => item.theme.id === effectiveActiveThemeId) ?? themeChoices[0] ?? null;
  const enabled = effectiveConfig?.enabled !== false;

  async function commitConfig(key, updater, nextNotice) {
    setBusyKey(key);
    try {
      const currentConfig = await readExtensionConfig();
      const currentLivePreviewConfig = await readLivePreviewConfig();
      const nextConfig = normalizeStoredConfig(await updater(currentConfig));
      const savedConfig = await writeExtensionConfig(nextConfig);
      setConfig(savedConfig);

      if (currentLivePreviewConfig) {
        await clearLivePreviewConfig();
        setLivePreviewConfig(null);
        setNotice({
          tone: "amber",
          message: "本地预览已结束，当前配置已保存。",
        });
        return savedConfig;
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
    const savedConfig = await commitConfig(
      "theme",
      async (currentConfig) => resolveNextConfigForThemeChange(currentConfig, site, themeId, previewActionId),
      {
        tone: "slate",
        message: "当前主题已切换。",
      }
    );
    if (savedConfig && savedConfig.enabled === false) {
      setNotice({ tone: "amber", message: "全局特效已暂停。切换的主题将在开启后生效。" });
    }
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
            message: site.isPreviewMode ? "已触发本地测试效果。" : "已向当前网页发送测试效果。",
          }
          : {
            tone: "amber",
            message: "当前页面无法发送效果，请刷新目标网页后重试。",
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
    siteAction,
    runtimeErrors,
    hydrated,
    effectiveConfig,
    setEnabled,
    setThemeId,
    previewCurrentTheme,
    openOptionsPage,
  };
}
