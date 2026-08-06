import { useEffect, useMemo, useState } from "react";
import {
  createWorkbenchThemeState,
  clearLivePreviewConfig,
  clearRuntimeErrors,
  hydrateWorkbenchState,
  normalizeStoredConfig,
  previewThemePack,
  readActiveSiteContext,
  readEditorState,
  readExtensionConfig,
  readLivePreviewConfig,
  readRuntimeErrors,
  subscribeExtensionConfig,
  subscribeLivePreviewConfig,
  writeExtensionConfig,
} from "../theme-workbench/lib/workbenchConfig";
import {
  buildInitialNotice,
  getActionConfig,
  getEffectiveActiveThemeId,
  getErrorMessage,
  getPreviewActionId,
  getSiteAction,
  resolveNextConfigForThemeChange,
  type PopupNotice,
  type PopupSiteContext,
} from "./popupConfigModel";
import { ACTIONS } from "../theme-workbench/model/workbenchSchema";
import type {
  RuntimeDiagnosticEntry,
  WorkbenchEditorState,
} from "../theme-workbench/lib/storage/repository/types";
import type { CursorDanceConfig } from "@/shared/domain/cursor-dance";

const EMPTY_SITE: PopupSiteContext = {
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

export function usePopupState() {
  const [config, setConfig] = useState<CursorDanceConfig | null>(null);
  const [livePreviewConfig, setLivePreviewConfig] = useState<CursorDanceConfig | null>(null);
  const [editorState, setEditorState] = useState<WorkbenchEditorState | null>(null);
  const [site, setSite] = useState(EMPTY_SITE);
  const [busyKey, setBusyKey] = useState("");
  const [notice, setNotice] = useState<PopupNotice>({ tone: "slate", message: "正在连接主题切换器…" });
  const [runtimeErrors, setRuntimeErrors] = useState<RuntimeDiagnosticEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const [nextConfig, nextLivePreviewConfig, nextEditorState, nextSite, errors] = await Promise.all([
        readExtensionConfig(),
        readLivePreviewConfig(),
        readEditorState(),
        readActiveSiteContext(),
        readRuntimeErrors(),
      ]);
      if (cancelled) return;
      setConfig(nextConfig);
      setLivePreviewConfig(nextLivePreviewConfig);
      setEditorState(nextEditorState);
      setSite(nextSite);
      setRuntimeErrors(errors);
      if (errors.length > 0) {
        void clearRuntimeErrors();
        setNotice({
          tone: "amber",
          message: `检测到 ${errors.length} 个运行时问题：${errors.map((e) => e.type).join("、")}`,
        });
      } else {
        setNotice(buildInitialNotice(nextSite));
      }
    }

    void hydrate();

    const unsubscribe = subscribeExtensionConfig(async (nextConfig) => {
      const nextSite = await readActiveSiteContext();
      if (cancelled) return;
      setSite(nextSite);
      setConfig(nextConfig);
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
  const siteAction = getSiteAction(effectiveConfig, site.host, "/");
  const effectiveActiveThemeId = getEffectiveActiveThemeId(siteAction, activeThemeId);
  const previewActionId = getPreviewActionId(editorState);
  const activeAction = ACTIONS.find((item) => item.id === previewActionId) ?? ACTIONS[0];

  const themeChoices = useMemo(
    () =>
      hydrated.themeLibrary.map((theme) => {
        const themePack = effectiveConfig?.themes?.find((item) => item.id === theme.id) ?? null;
        return {
          theme,
          themePack,
          actionConfig: getActionConfig(hydrated.draftsByTheme, theme.id, previewActionId),
        };
      }),
    [effectiveConfig?.themes, hydrated.draftsByTheme, hydrated.themeLibrary, previewActionId]
  );

  const activeThemeChoice = themeChoices.find((item) => item.theme.id === effectiveActiveThemeId) ?? themeChoices[0] ?? null;
  const enabled = effectiveConfig?.enabled !== false;

  async function commitConfig(
    key: string,
    updater: (
      currentConfig: CursorDanceConfig,
    ) => CursorDanceConfig | Promise<CursorDanceConfig>,
    nextNotice: PopupNotice | null,
  ): Promise<CursorDanceConfig | null> {
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

  async function setEnabled(nextEnabled: boolean): Promise<void> {
    await commitConfig(
      "enabled",
      (currentConfig) => ({
        ...currentConfig,
        enabled: nextEnabled,
      }),
      {
        tone: nextEnabled ? "slate" : "amber",
        message: nextEnabled ? "全局特效已开启。" : "全局特效已暂停。",
      }
    );
  }

  async function setThemeId(themeId: string): Promise<void> {
    const savedConfig = await commitConfig(
      "theme",
      (currentConfig) => resolveNextConfigForThemeChange(currentConfig, site, themeId),
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
