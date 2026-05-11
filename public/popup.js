(function cursorDancePopup() {
  const CONFIG_STORAGE_KEY = "cursordance.config";
  const LEGACY_ENABLED_STORAGE_KEY = "cursordance.enabled";
  const DEFAULT_CONFIG = window.CursorDanceDefaultConfig || {};
  const CONFIG_RUNTIME = window.CursorDanceConfigRuntime || {};
  const toggleButton = document.getElementById("toggleButton");
  const previewButton = document.getElementById("previewButton");
  const optionsButton = document.getElementById("optionsButton");
  const previewMessage = document.getElementById("previewMessage");
  const saveMessage = document.getElementById("saveMessage");
  const saveTextButton = document.getElementById("saveTextButton");
  const schemeList = document.getElementById("schemeList");
  const siteHost = document.getElementById("siteHost");
  const siteDesc = document.getElementById("siteDesc");
  const siteModeButtons = Array.from(document.querySelectorAll("[data-site-mode]"));
  const schemeName = document.getElementById("schemeName");
  const schemeSummary = document.getElementById("schemeSummary");
  const schemeThumb = document.getElementById("schemeThumb");
  const statusTitle = document.getElementById("statusTitle");
  const statusDesc = document.getElementById("statusDesc");
  const statusIcon = document.getElementById("statusIcon");
  const textCount = document.getElementById("textCount");
  const textInput = document.getElementById("textInput");
  const ACTION_LABELS = {
    leftClick: "左键单击",
    rightClick: "右键单击",
    doubleClick: "双击",
    longPress: "长按",
    wheel: "滚轮",
    hover: "悬停",
  };
  let config = normalizeConfig(DEFAULT_CONFIG);
  let currentSite = {
    host: "",
    isSupportedPage: false,
    tabId: null,
  };

  function mergeSchemeWithFallback(fallbackScheme, scheme) {
    return {
      ...fallbackScheme,
      ...scheme,
      behavior: {
        ...(fallbackScheme.behavior || {}),
        ...(scheme?.behavior || {}),
        click: {
          ...(fallbackScheme.behavior?.click || {}),
          ...(scheme?.behavior?.click || {}),
          trigger: {
            ...(fallbackScheme.behavior?.click?.trigger || {}),
            ...(scheme?.behavior?.click?.trigger || {}),
          },
          effects: {
            ...(fallbackScheme.behavior?.click?.effects || {}),
            ...(scheme?.behavior?.click?.effects || {}),
            text: {
              ...(fallbackScheme.behavior?.click?.effects?.text || {}),
              ...(scheme?.behavior?.click?.effects?.text || {}),
            },
            ripple: {
              ...(fallbackScheme.behavior?.click?.effects?.ripple || {}),
              ...(scheme?.behavior?.click?.effects?.ripple || {}),
            },
            particle: {
              ...(fallbackScheme.behavior?.click?.effects?.particle || {}),
              ...(scheme?.behavior?.click?.effects?.particle || {}),
            },
          },
        },
      },
    };
  }

  function mergeSchemes(schemes) {
    const fallbackSchemes = Array.isArray(DEFAULT_CONFIG.schemes) ? DEFAULT_CONFIG.schemes : [];
    const storedSchemes = Array.isArray(schemes) ? schemes : [];
    const storedById = new Map(storedSchemes.map((scheme) => [scheme.id, scheme]));
    const knownIds = new Set(fallbackSchemes.map((scheme) => scheme.id));
    const merged = fallbackSchemes.map((scheme) => mergeSchemeWithFallback(scheme, storedById.get(scheme.id)));
    return merged.concat(storedSchemes.filter((scheme) => scheme?.id && !knownIds.has(scheme.id)));
  }

  function normalizeConfig(value) {
    return (CONFIG_RUNTIME.normalizeConfig || ((nextValue) => nextValue))(value, DEFAULT_CONFIG);
  }

  function getActiveScheme() {
    return config.schemes.find((scheme) => scheme.id === config.activeSchemeId) || config.schemes[0] || {};
  }

  function setActiveThemeFields(nextConfig, schemeId) {
    return normalizeConfig({
      ...nextConfig,
      activeThemePackId: schemeId,
      activeSchemeId: schemeId,
    });
  }

  function getCurrentActionId() {
    return config.editor?.lastActionId || "leftClick";
  }

  function getFallbackWorkbenchDraft(scheme) {
    const effects = scheme?.behavior?.click?.effects || {};
    return {
      actionConfigs: {
        leftClick: {
          textEnabled: effects.text?.enabled !== false,
          textContent: effects.text?.content || "超棒！",
          textTags: [effects.text?.content || "超棒！"],
          ripple: effects.ripple?.enabled !== false,
          particle: effects.particle?.enabled !== false,
          sound: false,
        },
      },
    };
  }

  function getWorkbenchDraft(scheme) {
    return scheme?.workbenchDraft?.actionConfigs ? scheme.workbenchDraft : getFallbackWorkbenchDraft(scheme);
  }

  function getActionConfig(scheme, actionId = "leftClick") {
    const draft = getWorkbenchDraft(scheme);
    return draft.actionConfigs?.[actionId] || draft.actionConfigs?.leftClick || {};
  }

  function buildOrderedTextTags(actionConfig, nextContent = "") {
    const currentTags = Array.isArray(actionConfig?.textTags) ? actionConfig.textTags.filter(Boolean) : [];
    const primaryText = typeof nextContent === "string" ? nextContent.trim() : "";
    if (!primaryText) return currentTags;
    return [primaryText, ...currentTags.filter((item) => item !== primaryText)];
  }

  function normalizeHost(host) {
    return typeof host === "string" ? host.trim().toLowerCase() : "";
  }

  function getCurrentSiteMode() {
    if (!currentSite.host) return "inherit";
    return (CONFIG_RUNTIME.getSiteMode || (() => "inherit"))(config, currentSite.host);
  }

  function isCurrentSiteEffectEnabled() {
    const mode = getCurrentSiteMode();
    if (mode === "enabled") return true;
    if (mode === "disabled") return false;
    return config.enabled;
  }

  function getCurrentSiteDescription() {
    if (!currentSite.isSupportedPage) {
      return "当前页面不是普通网页，不能单独设置站点规则。";
    }
    const mode = getCurrentSiteMode();
    if (mode === "enabled") {
      return "当前网站已单独启用，即使全局暂停也会继续显示特效。";
    }
    if (mode === "disabled") {
      return "当前网站已单独禁用，网页点击和预览都不会播放特效。";
    }
    return config.enabled
      ? "当前网站跟随全局，现阶段会正常显示特效。"
      : "当前网站跟随全局，现阶段会跟着全局一起暂停。";
  }

  function getSchemeSummary(scheme) {
    const draft = getWorkbenchDraft(scheme);
    const summary = Object.entries(draft.actionConfigs || {})
      .map(([actionId, actionConfig]) => {
        const parts = [
          actionConfig.textEnabled ? "飘字" : "",
          actionConfig.ripple ? "波纹" : "",
          actionConfig.particle ? "粒子" : "",
          actionConfig.sound ? "音频" : "",
          actionConfig.cursorOverride && actionConfig.cursorOverride !== "跟随当前状态" ? "动作光标" : "",
        ].filter(Boolean);
        if (!parts.length) return "";
        const actionLabelMap = {
          leftClick: "左键",
          rightClick: "右键",
          doubleClick: "双击",
          longPress: "长按",
          wheel: "滚轮",
          hover: "悬停",
        };
        return `${actionLabelMap[actionId] || actionId}: ${parts.join(" + ")}`;
      })
      .filter(Boolean)
      .slice(0, 2)
      .join(" · ");

    return summary || scheme?.description || "当前主题还没有启用任何动作反馈。";
  }

  function setActiveTextContent(content) {
    const activeScheme = getActiveScheme();
    const currentActionId = getCurrentActionId();
    const nextSchemes = config.schemes.map((scheme) => {
      if (scheme.id !== activeScheme.id) return scheme;
      const currentDraft = getWorkbenchDraft(scheme);
      const currentActionConfig = getActionConfig(scheme, currentActionId);
      const nextTextTags = buildOrderedTextTags(currentActionConfig, content);
      return {
        ...scheme,
        workbenchDraft: {
          ...currentDraft,
          actionConfigs: {
            ...(currentDraft.actionConfigs || {}),
            [currentActionId]: {
              ...currentActionConfig,
              textEnabled: true,
              textContent: content,
              textTags: nextTextTags.length ? nextTextTags : [content],
            },
          },
        },
        behavior: {
          ...scheme.behavior,
          click: {
            ...scheme.behavior?.click,
            effects: {
              ...scheme.behavior?.click?.effects,
              text: {
                ...scheme.behavior?.click?.effects?.text,
                content: currentActionId === "leftClick"
                  ? content
                  : (scheme.behavior?.click?.effects?.text?.content || content),
              },
            },
          },
        },
      };
    });
    config = normalizeConfig({ ...config, schemes: nextSchemes });
  }

  function renderEditor() {
    const actionId = getCurrentActionId();
    const actionConfig = getActionConfig(getActiveScheme(), actionId);
    const content = actionConfig.textContent || actionConfig.textTags?.[0] || "";
    textInput.value = content;
    textCount.textContent = `${content.length}/12`;
    saveMessage.textContent = `编辑 ${ACTION_LABELS[actionId] || actionId} 的文本配置。`;
  }

  function renderSiteRule() {
    siteHost.textContent = currentSite.isSupportedPage ? currentSite.host : "当前页面不可设置";
    siteDesc.textContent = getCurrentSiteDescription();
    const activeMode = getCurrentSiteMode();
    siteModeButtons.forEach((button) => {
      const isActive = button.dataset.siteMode === activeMode;
      button.classList.toggle("is-active", isActive);
      button.disabled = !currentSite.isSupportedPage;
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function renderSchemeList() {
    const activeScheme = getActiveScheme();
    schemeList.innerHTML = "";
    config.schemes.forEach((scheme) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `scheme-option${scheme.id === activeScheme.id ? " is-active" : ""}`;
      button.dataset.schemeId = scheme.id;
      button.innerHTML = `
        <div>
          <strong>${scheme.name || "未命名方案"}</strong>
          <span>${getSchemeSummary(scheme)}</span>
        </div>
        <div class="scheme-option-mark">✓</div>
      `;
      schemeList.append(button);
    });
  }

  function renderScheme() {
    const scheme = getActiveScheme();
    const actionId = getCurrentActionId();
    const actionConfig = getActionConfig(scheme, actionId);
    schemeName.textContent = scheme.name || "Cute Pink";
    schemeThumb.textContent = actionConfig.textContent || actionConfig.textTags?.[0] || ACTION_LABELS[actionId] || "超棒!";
    schemeSummary.textContent = getSchemeSummary(scheme);
    const accentColor = actionConfig.textColor || "#ec4899";
    schemeThumb.style.background = `${accentColor}22`;
    schemeThumb.style.color = accentColor;
    schemeThumb.style.boxShadow = `inset 0 0 0 1px ${accentColor}33`;
  }

  function render(enabled) {
    document.body.classList.toggle("is-disabled", !enabled);
    toggleButton.setAttribute("aria-checked", String(enabled));
    statusTitle.textContent = enabled ? "已开启" : "已暂停";
    statusDesc.textContent = enabled ? "普通网页点击会显示特效" : "特效已暂停，网页点击不会显示";
    statusIcon.textContent = enabled ? "✓" : "!";
    previewButton.disabled = !currentSite.isSupportedPage || !isCurrentSiteEffectEnabled();
  }

  async function readConfig() {
    const result = await chrome.storage.local.get([CONFIG_STORAGE_KEY, LEGACY_ENABLED_STORAGE_KEY]);
    const storedConfig = result[CONFIG_STORAGE_KEY];
    config = normalizeConfig(storedConfig || {
      ...DEFAULT_CONFIG,
      enabled: result[LEGACY_ENABLED_STORAGE_KEY] !== false,
    });
    if (!storedConfig || (CONFIG_RUNTIME.needsMigration && CONFIG_RUNTIME.needsMigration(storedConfig))) {
      await chrome.storage.local.set({ [CONFIG_STORAGE_KEY]: config });
    }
    return config;
  }

  async function readCurrentSite() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      const url = activeTab?.url || "";
      const parsedUrl = url ? new URL(url) : null;
      const isSupportedPage = parsedUrl?.protocol === "http:" || parsedUrl?.protocol === "https:";
      currentSite = {
        host: isSupportedPage ? normalizeHost(parsedUrl.hostname) : "",
        isSupportedPage,
        tabId: activeTab?.id ?? null,
      };
    } catch {
      currentSite = {
        host: "",
        isSupportedPage: false,
        tabId: null,
      };
    }
    return currentSite;
  }

  async function setActiveScheme(schemeId) {
    config = setActiveThemeFields(config, schemeId);
    await chrome.storage.local.set({ [CONFIG_STORAGE_KEY]: config });
    renderSchemeList();
    renderScheme();
    renderEditor();
    saveMessage.textContent = `已切换到「${getActiveScheme().name}」。`;
    previewMessage.textContent = "预览会按当前方案播放。";
  }

  async function setCurrentSiteMode(mode) {
    if (!currentSite.host) return;
    config = normalizeConfig((CONFIG_RUNTIME.setSiteRuleMode || ((currentConfig) => currentConfig))(config, currentSite.host, mode));
    await chrome.storage.local.set({ [CONFIG_STORAGE_KEY]: config });
    renderSiteRule();
    render(config.enabled);
    previewMessage.textContent = mode === "disabled"
      ? "当前网站已禁用，不能在此页预览。"
      : "站点规则已更新。";
  }

  async function setEnabled(enabled) {
    config = normalizeConfig({ ...config, enabled });
    await chrome.storage.local.set({ [CONFIG_STORAGE_KEY]: config });
    renderSiteRule();
    render(enabled);
  }

  async function saveTextContent() {
    const content = textInput.value.trim() || "超棒！";
    await readConfig();
    setActiveTextContent(content.slice(0, 12));
    await chrome.storage.local.set({ [CONFIG_STORAGE_KEY]: config });
    renderScheme();
    renderEditor();
    saveMessage.textContent = "已保存，网页会立即使用新文案。";
  }

  toggleButton.addEventListener("click", async () => {
    const currentConfig = await readConfig();
    await setEnabled(!currentConfig.enabled);
  });

  previewButton.addEventListener("click", async () => {
    previewMessage.textContent = "正在发送预览...";
    try {
      const tabId = currentSite.tabId;
      if (!tabId) {
        previewMessage.textContent = "没有找到当前标签页。";
        return;
      }
      await chrome.tabs.sendMessage(tabId, {
        type: "CURSORDANCE_PREVIEW_SCHEME",
        schemeId: config.activeSchemeId,
        scheme: getActiveScheme(),
        actionId: config.editor?.lastActionId || "leftClick",
      });
      previewMessage.textContent = "已在当前网页播放预览。";
    } catch {
      previewMessage.textContent = "当前页面无法预览，请切换到普通 http/https 网页并刷新。";
    }
  });

  optionsButton.addEventListener("click", async () => {
    try {
      await chrome.runtime.openOptionsPage();
    } catch {
      previewMessage.textContent = "打开详细设置失败。";
    }
  });

  textInput.addEventListener("input", () => {
    textCount.textContent = `${textInput.value.length}/12`;
    saveMessage.textContent = "有未保存文案。";
  });

  saveTextButton.addEventListener("click", saveTextContent);
  schemeList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-scheme-id]");
    if (!button) return;
    await setActiveScheme(button.dataset.schemeId);
  });
  siteModeButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      await setCurrentSiteMode(button.dataset.siteMode);
    });
  });

  Promise.all([readConfig(), readCurrentSite()]).then(([nextConfig]) => {
    config = nextConfig;
    renderSchemeList();
    renderScheme();
    renderSiteRule();
    renderEditor();
    render(config.enabled);
  });
})();
