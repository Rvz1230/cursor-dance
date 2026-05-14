(function registerContentConfigStore(globalThis) {
  const modules = globalThis.CursorDanceContentModules || (globalThis.CursorDanceContentModules = {});

  modules.createConfigStore = function createConfigStore(runtime) {
    const {
      window,
      chrome,
      defaultConfig,
      runtimeConfig,
      constants,
      state,
      diagnostics,
    } = runtime;

    function normalizeConfig(value) {
      return (runtimeConfig.normalizeConfig || ((nextValue) => nextValue))(value, defaultConfig);
    }

    function setConfig(nextConfig) {
      state.config = normalizeConfig(nextConfig);
      return state.config;
    }

    function getConfig() {
      return state.config;
    }

    function isLocalPreviewHost() {
      const hostname = window.location.hostname;
      return hostname === "localhost" || hostname === "127.0.0.1";
    }

    function canUseWindowLocalStorage() {
      try {
        const probeKey = "__cursordance_content_probe__";
        window.localStorage.setItem(probeKey, "1");
        window.localStorage.removeItem(probeKey);
        return true;
      } catch {
        return false;
      }
    }

    function readLocalPreviewConfig() {
      if (!isLocalPreviewHost() || !canUseWindowLocalStorage()) return null;

      try {
        const raw = window.localStorage.getItem(constants.CONFIG_STORAGE_KEY);
        const legacyEnabledRaw = window.localStorage.getItem(constants.LEGACY_ENABLED_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return normalizeConfig(
          parsed || {
            ...defaultConfig,
            enabled: legacyEnabledRaw !== "false",
          }
        );
      } catch {
        return null;
      }
    }

    function buildCursorAssetStorageKey(themeId, stateId) {
      return `${constants.CURSOR_ASSET_STORAGE_KEY_PREFIX}${themeId}.${stateId}`;
    }

    function mergeCursorStates(fallbackCursorStates, cursorStates) {
      return (runtimeConfig.mergeCursorStates || ((fallbackStates, nextStates) => ({
        ...(fallbackStates || {}),
        ...(nextStates || {}),
      })))(fallbackCursorStates, cursorStates);
    }

    function getActionTriggerConfig(actionConfig) {
      return (runtimeConfig.getActionTriggerConfig || ((nextConfig) => nextConfig || {}))(actionConfig || {});
    }

    function getActionTextConfig(actionConfig) {
      return (runtimeConfig.getActionTextConfig || ((nextConfig) => nextConfig || {}))(actionConfig || {});
    }

    function getActionParticleConfig(actionConfig) {
      return (runtimeConfig.getActionParticleConfig || ((nextConfig) => nextConfig || {}))(actionConfig || {});
    }

    function getActionRippleConfig(actionConfig) {
      return (runtimeConfig.getActionRippleConfig || ((nextConfig) => nextConfig || {}))(actionConfig || {});
    }

    function getActionAudioConfig(actionConfig) {
      return (runtimeConfig.getActionAudioConfig || ((nextConfig) => nextConfig || {}))(actionConfig || {});
    }

    function getActionAnimationConfig(actionConfig) {
      return (runtimeConfig.getActionAnimationConfig || ((nextConfig) => nextConfig || {}))(actionConfig || {});
    }

    function getActionImageConfig(actionConfig) {
      return (runtimeConfig.getActionImageConfig || ((nextConfig) => nextConfig || {}))(actionConfig || {});
    }

    function getActionCursorFeedbackConfig(actionConfig) {
      return (runtimeConfig.getActionCursorFeedbackConfig || ((nextConfig) => nextConfig || {}))(actionConfig || {});
    }

    function normalizeHost(host) {
      return typeof host === "string" ? host.trim().toLowerCase() : "";
    }

    function getSchemeById(schemeId) {
      return getConfig().schemes.find((scheme) => scheme.id === schemeId) || getConfig().schemes[0] || {};
    }

    function withResolvedCursorAssets(nextConfig, assetEntries) {
      const assetMap = assetEntries || {};
      const nextThemePacks = (nextConfig.themePacks || []).map((themePack) => ({
        ...themePack,
        cursorStates: Object.fromEntries(
          Object.entries(themePack.cursorStates || {}).map(([stateId, stateConfig]) => [
            stateId,
            {
              ...stateConfig,
              imageDataUrl: assetMap[buildCursorAssetStorageKey(themePack.id, stateId)]?.imageDataUrl || stateConfig.imageDataUrl || "",
            },
          ])
        ),
      }));

      return {
        ...nextConfig,
        themePacks: nextThemePacks,
        schemes: nextThemePacks,
      };
    }

    function getActiveScheme() {
      return getSchemeById(getConfig().activeSchemeId);
    }

    function getCurrentSiteMode() {
      const host = normalizeHost(window.location.hostname);
      return (runtimeConfig.getSiteMode || (() => "inherit"))(getConfig(), host);
    }

    function isCurrentSiteEnabled() {
      const siteMode = getCurrentSiteMode();
      if (siteMode === "enabled") return true;
      if (siteMode === "disabled") return false;
      return getConfig().enabled;
    }

    function getMaxActiveEffects() {
      return getConfig().performance?.maxActiveEffects || 48;
    }

    function getFallbackDraft(scheme) {
      const clickConfig = scheme?.behavior?.click || {};
      const effects = clickConfig.effects || {};
      const textEffect = effects.text || {};
      const rippleEffect = effects.ripple || {};
      const particleEffect = effects.particle || {};
      const mergedCursorStates = mergeCursorStates(defaultConfig.schemes?.[0]?.cursorStates, scheme?.cursorStates);
      const fallbackLeftClick = {
        textKind: "数字飘字",
        textStyle: "阿拉伯数字 (1, 2, 3)",
        textMode: "默认模式 (+1)",
        textTemplate: "${number}",
        textEnabled: textEffect.enabled !== false,
        textContent: "",
        textTags: [],
        textTagPlayMode: "按顺序显示",
        comboEnabled: true,
      };
      const inferredTextConfig = (runtimeConfig.resolveActionTextConfigFromEffect || ((baseActionConfig) => baseActionConfig))(
        fallbackLeftClick,
        textEffect
      );

      return {
        cursorModes: Object.fromEntries(
          Object.entries(mergedCursorStates || {}).map(([stateId, stateConfig]) => [
            stateId,
            stateId === "default" ? (stateConfig.mode === "override" ? "覆盖" : "源") : (stateConfig.mode === "override" ? "覆盖" : "继承"),
          ])
        ),
        cursorStateActions: Object.fromEntries(
          Object.entries(mergedCursorStates || {}).map(([stateId, stateConfig]) => [stateId, stateConfig?.actionId || "leftClick"])
        ),
        actionConfigs: {
          leftClick: {
            ...inferredTextConfig,
            textEnabled: textEffect.enabled !== false,
            textColor: textEffect.color || "#ec4899",
            textDuration: textEffect.durationMs || 950,
            textOpacity: 100,
            textWeight: (textEffect.fontWeight || 800) >= 700 ? "加粗" : (textEffect.fontWeight || 800) >= 600 ? "中等" : "常规",
            textOutlineWidth: 0,
            textShadow: "无",
            comboEnabled: inferredTextConfig.comboEnabled,
            textOffsetX: textEffect.offsetX || 0,
            textOffsetY: textEffect.offsetY || -58,
            particle: particleEffect.enabled !== false,
            particleCount: particleEffect.count || 14,
            particleSpread: particleEffect.baseDistance || 52,
            particleStyle: "点状粒子",
            particleDirection: "四周扩散",
            particleColorMode: "跟随飘字色",
            particleDuration: particleEffect.durationMs || 760,
            particleSize: particleEffect.size || 8,
            particleOpacity: 92,
            ripple: rippleEffect.enabled !== false,
            rippleSize: rippleEffect.size || 118,
            rippleDuration: rippleEffect.durationMs || 820,
            rippleStyle: "单环",
            rippleEasing: "缓出",
            rippleLineWidth: 2,
            rippleOpacity: 72,
            sound: false,
            fontSize: textEffect.fontSize || 28,
            volume: 0,
            playbackRate: 100,
            soundDelay: 0,
            soundFadeOut: 0,
            soundTriggerMode: "每次触发",
            soundBlendMode: "保持原音量",
            animationEnabled: false,
            animationStyle: "聚焦脉冲",
            animationDuration: 720,
            animationScale: 100,
            animationOpacity: 100,
            animationOffsetX: 0,
            animationOffsetY: -10,
            imageEnabled: false,
            imageDataUrl: "",
            imageDuration: 780,
            imageSize: 56,
            imageOpacity: 100,
            imageOffsetX: 0,
            imageOffsetY: -18,
            shake: 0,
            cursorOverride: "跟随当前状态",
            cursorSize: 48,
            triggerTiming: "抬起时",
            triggerZone: "当前页面可点击区域",
            holdMs: clickConfig.trigger?.cooldownMs || 80,
            soundFile: "",
          },
        },
      };
    }

    function mergeActionConfig(baseConfig, ...overlays) {
      return overlays.reduce(
        (mergedConfig, overlay) => ({
          ...mergedConfig,
          ...(overlay || {}),
          textTags: Array.isArray(overlay?.textTags)
            ? [...overlay.textTags]
            : mergedConfig.textTags,
        }),
        {
          ...baseConfig,
          textTags: Array.isArray(baseConfig?.textTags) ? [...baseConfig.textTags] : [],
        }
      );
    }

    function getWorkbenchDraft(scheme) {
      const fallbackDraft = getFallbackDraft(scheme);
      if (!scheme?.workbenchDraft?.actionConfigs) return fallbackDraft;
      return {
        ...scheme.workbenchDraft,
        actionConfigs: {
          ...(scheme.workbenchDraft.actionConfigs || {}),
          leftClick: scheme?.behavior?.click
            ? mergeActionConfig(
                fallbackDraft.actionConfigs.leftClick,
                scheme.workbenchDraft.actionConfigs.leftClick || {}
              )
            : mergeActionConfig(scheme.workbenchDraft.actionConfigs.leftClick || {}),
        },
      };
    }

    function getActionConfig(scheme, actionId) {
      const draft = getWorkbenchDraft(scheme);
      return draft.actionConfigs?.[actionId] || draft.actionConfigs?.leftClick || null;
    }

    function getMergedCursorStates(scheme) {
      return mergeCursorStates(defaultConfig.schemes?.[0]?.cursorStates, scheme?.cursorStates);
    }

    function getCursorStateBinding(scheme, stateId, sourceActionId) {
      if (sourceActionId !== "leftClick") {
        return {
          cursorStateId: stateId,
          actionId: sourceActionId,
          inheritedFromDefault: false,
        };
      }

      const mergedCursorStates = getMergedCursorStates(scheme);
      const defaultActionId = mergedCursorStates?.default?.actionId || "leftClick";
      const stateConfig = mergedCursorStates?.[stateId] || {};
      const inheritedFromDefault = stateId !== "default" && stateConfig.mode !== "override";
      const actionId = inheritedFromDefault ? defaultActionId : (stateConfig.actionId || defaultActionId || sourceActionId);

      return {
        cursorStateId: stateId,
        actionId,
        inheritedFromDefault,
      };
    }

    function getEffectiveCursorStateConfig(scheme, stateId) {
      const mergedCursorStates = getMergedCursorStates(scheme);
      const defaultState = mergedCursorStates?.default || null;
      const stateConfig = mergedCursorStates?.[stateId] || null;
      if (!stateConfig) return defaultState;
      if (stateId === "default" || stateConfig.mode === "override") return stateConfig;
      return defaultState;
    }

    function resolveCursorStateId(target) {
      if (!(target instanceof Element)) return "default";
      const cursorValue = window.getComputedStyle(target).cursor || "";
      if (cursorValue === "pointer") return "pointer";
      if (cursorValue === "text" || cursorValue === "vertical-text") return "text";
      if (cursorValue === "help") return "help";
      if (cursorValue === "wait" || cursorValue === "progress") return "wait";
      if (cursorValue === "not-allowed" || cursorValue === "no-drop") return "notAllowed";
      if (target.closest(constants.TEXT_EDITABLE_SELECTOR)) return "text";
      if (target.closest(":disabled,[aria-disabled='true']")) return "notAllowed";
      if (target.closest(constants.INTERACTIVE_SELECTOR)) return "pointer";
      return "default";
    }

    function isInteractiveTarget(target) {
      return target instanceof Element ? Boolean(target.closest(constants.INTERACTIVE_SELECTOR)) : false;
    }

    function isButtonOrLinkTarget(target) {
      return target instanceof Element ? Boolean(target.closest("a,button,[role='button']")) : false;
    }

    function matchesTriggerZone(target, triggerZone, event, meta = {}) {
      let matched = true;
      if (!triggerZone) {
        matched = true;
      } else if (triggerZone.includes("按钮和链接")) {
        matched = isButtonOrLinkTarget(target);
      } else if (triggerZone.includes("可交互元素")) {
        matched = isInteractiveTarget(target);
      } else if (triggerZone.includes("空白区域")) {
        matched = !isInteractiveTarget(target);
      } else if (triggerZone.includes("内容卡片")) {
        matched = target instanceof Element ? Boolean(target.closest("article,section,li,div")) : false;
      } else if (triggerZone.includes("仅向上滚动")) {
        matched = event?.deltaY < 0;
      } else if (triggerZone.includes("仅向下滚动")) {
        matched = event?.deltaY > 0;
      }

      diagnostics?.log("trigger-zone.check", {
        actionId: meta.actionId || null,
        triggerSource: meta.triggerSource || null,
        triggerZone: triggerZone || "任意区域",
        matched,
        pointerType: event?.pointerType || null,
        deltaY: Number.isFinite(event?.deltaY) ? event.deltaY : null,
        target: diagnostics?.describeTarget(target),
      });

      return matched;
    }

    async function syncConfigFromStorage({ clearStateCursorOverlay }) {
      try {
        const localPreviewConfig = readLocalPreviewConfig();
        if (localPreviewConfig) {
          setConfig(localPreviewConfig);
          clearStateCursorOverlay();
          return;
        }

        try {
          const livePreviewResult = await chrome?.storage?.session?.get([constants.LIVE_PREVIEW_CONFIG_STORAGE_KEY]);
          const livePreviewConfig = livePreviewResult?.[constants.LIVE_PREVIEW_CONFIG_STORAGE_KEY];
          if (livePreviewConfig) {
            setConfig(livePreviewConfig);
            clearStateCursorOverlay();
            return;
          }
        } catch {
          // Ignore live preview session read failures and fall back to persisted config.
        }

        if (chrome?.storage?.local) {
          const result = await chrome.storage.local.get([constants.CONFIG_STORAGE_KEY, constants.LEGACY_ENABLED_STORAGE_KEY]);
          const storedConfig = result[constants.CONFIG_STORAGE_KEY];
          const nextConfig = normalizeConfig(
            storedConfig || {
              ...defaultConfig,
              enabled: result[constants.LEGACY_ENABLED_STORAGE_KEY] !== false,
            }
          );
          const assetKeys = (nextConfig.themePacks || []).flatMap((themePack) =>
            Object.keys(themePack.cursorStates || {}).map((stateId) => buildCursorAssetStorageKey(themePack.id, stateId))
          );
          const assetEntries = assetKeys.length ? await chrome.storage.local.get(assetKeys) : {};
          state.config = withResolvedCursorAssets(nextConfig, assetEntries);
          if (!storedConfig || (runtimeConfig.needsMigration && runtimeConfig.needsMigration(storedConfig))) {
            await chrome.storage.local.set({ [constants.CONFIG_STORAGE_KEY]: state.config });
          }
          clearStateCursorOverlay();
          return;
        }

        setConfig(getConfig() || defaultConfig);
        clearStateCursorOverlay();
      } catch {
        setConfig(getConfig() || defaultConfig);
        clearStateCursorOverlay();
      }
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
    };
  };
})(window);
