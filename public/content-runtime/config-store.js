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
      reportRuntimeError,
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

    function getCurrentHost() {
      return normalizeHost(window.location.hostname);
    }

    function getCurrentSiteRule() {
      const host = getCurrentHost();
      return (runtimeConfig.getSiteRule || (() => ({ mode: "inherit" })))(getConfig(), host);
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
      const currentSiteRule = getCurrentSiteRule();
      const siteThemePackId = currentSiteRule?.mode === "enabled" ? currentSiteRule.themePackId : "";
      return getSchemeById(siteThemePackId || getConfig().activeSchemeId);
    }

    function getCurrentSiteMode() {
      return getCurrentSiteRule()?.mode || "inherit";
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

    function getBaseActionConfigs() {
      return {
        leftClick: {
          textKind: "数字飘字",
          textStyle: "阿拉伯数字 (1, 2, 3)",
          textMode: "默认模式 (+1)",
          textTemplate: "${number}",
          textEnabled: true,
          textContent: "+1",
          textTags: ["功德 +1", "继续点击", "已触发"],
          textTagPlayMode: "按顺序显示",
          textColor: "#B45309",
          textDuration: 1000,
          textEasing: "缓出",
          textOpacity: 100,
          textFontFamily: "系统默认",
          textWeight: "加粗",
          textOutlineWidth: 0,
          textShadow: "无",
          comboEnabled: true,
          textOffsetX: 0,
          textOffsetY: -26,
          fontSize: 22,
          particle: true,
          particleCount: 18,
          particleSpread: 56,
          particleStyle: "点状粒子",
          particleDirection: "四周扩散",
          particleColorMode: "跟随主题",
          particlePalette: ["#FDBA74", "#FDE68A", "#86EFAC", "#93C5FD", "#F9A8D4"],
          particleDuration: 760,
          particleSize: 14,
          particleOpacity: 88,
          particleGravity: 0,
          particleWind: 0,
          particleBounce: 0,
          particleTrail: false,
          ripple: true,
          rippleSize: 68,
          rippleDuration: 820,
          rippleStyle: "单环",
          rippleEasing: "缓出",
          rippleLineWidth: 2,
          rippleOpacity: 72,
          rippleColor: "#34D399",
          sound: true,
          volume: 78,
          playbackRate: 100,
          soundDelay: 0,
          soundFadeOut: 80,
          soundTriggerMode: "每次触发",
          soundBlendMode: "保持原音量",
          soundFile: "woodfish-soft.wav",
          animationEnabled: false,
          animationStyle: "聚焦脉冲",
          animationDuration: 720,
          animationEasing: "缓出",
          animationScale: 100,
          animationOpacity: 100,
          animationOffsetX: 0,
          animationOffsetY: -10,
          animationColor: "#34D399",
          animationGlow: false,
          imageEnabled: false,
          imageDataUrl: "",
          imageDuration: 780,
          imageSize: 56,
          imageOpacity: 100,
          imageOffsetX: 0,
          imageOffsetY: -18,
          textGradient: false,
          textGradientStart: "#FBBF24",
          textGradientEnd: "#EC4899",
          cursorTrailEnabled: false,
          cursorTrailCount: 5,
          cursorTrailOpacity: 50,
          cursorGlowColor: "",
          comboWindowMs: 900,
          shake: 42,
          cursorOverride: "木鱼（继承默认）",
          cursorSize: 48,
          triggerTiming: "抬起时",
          triggerZone: "当前页面可点击区域",
          holdMs: 0,
        },
        rightClick: {
          textKind: "文本飘字",
          textEnabled: false,
          textContent: "menu",
          textTags: ["展开菜单", "右键操作", "更多选项"],
          textColor: "#475569",
          textDuration: 820,
          textEasing: "缓出",
          textWeight: "中等",
          textShadow: "无",
          textOffsetY: -18,
          particle: false,
          particleCount: 10,
          particleSpread: 30,
          particleDirection: "沿点击方向",
          particleDuration: 520,
          particleSize: 10,
          particleOpacity: 70,
          particleGravity: 0,
          particleWind: 0,
          particleBounce: 0,
          particleTrail: false,
          ripple: false,
          rippleSize: 42,
          rippleDuration: 520,
          rippleEasing: "缓出",
          rippleOpacity: 56,
          rippleColor: "#34D399",
          sound: false,
          fontSize: 18,
          volume: 60,
          soundFadeOut: 40,
          soundTriggerMode: "节流播放",
          shake: 18,
          cursorOverride: "跟随当前状态",
          cursorSize: 44,
          triggerTiming: "菜单弹出前",
          triggerZone: "右键菜单前",
          holdMs: 0,
          soundFile: "tick-light.wav",
          textStyle: "阿拉伯数字 (1, 2, 3)",
          textMode: "默认模式 (+1)",
          textTemplate: "${number}",
          textOpacity: 100,
          textFontFamily: "系统默认",
          textOutlineWidth: 0,
          textTagPlayMode: "按顺序显示",
          comboEnabled: false,
          textOffsetX: 0,
          particleStyle: "点状粒子",
          particleColorMode: "跟随主题",
          particlePalette: ["#FDBA74", "#FDE68A", "#86EFAC", "#93C5FD", "#F9A8D4"],
          rippleStyle: "单环",
          rippleLineWidth: 2,
          soundBlendMode: "保持原音量",
          playbackRate: 100,
          soundDelay: 0,
          animationEnabled: false,
          animationStyle: "聚焦脉冲",
          animationDuration: 720,
          animationEasing: "缓出",
          animationScale: 100,
          animationOpacity: 100,
          animationOffsetX: 0,
          animationOffsetY: -10,
          animationColor: "#34D399",
          animationGlow: false,
          imageEnabled: false,
          imageDataUrl: "",
          imageDuration: 780,
          imageSize: 56,
          imageOpacity: 100,
          imageOffsetX: 0,
          imageOffsetY: -18,
          textGradient: false,
          textGradientStart: "#FBBF24",
          textGradientEnd: "#EC4899",
          cursorTrailEnabled: false,
          cursorTrailCount: 5,
          cursorTrailOpacity: 50,
          cursorGlowColor: "",
          comboWindowMs: 900,
        },
        doubleClick: {
          textKind: "数字飘字",
          textStyle: "英文单词 (one, two, three)",
          textMode: "模板模式",
          textTemplate: "combo ${number}",
          textEnabled: true,
          textContent: "combo",
          textTags: ["双击完成", "连击命中", "combo"],
          textTagPlayMode: "随机显示",
          textColor: "#0F766E",
          textDuration: 1100,
          textEasing: "弹性",
          textWeight: "加粗",
          textOutlineWidth: 1,
          textShadow: "柔和",
          comboEnabled: true,
          textOffsetY: -30,
          particle: true,
          particleCount: 24,
          particleSpread: 72,
          particleStyle: "火花",
          particleDirection: "四周扩散",
          particleColorMode: "随机轻变化",
          particlePalette: ["#FDBA74", "#FDE68A", "#86EFAC", "#93C5FD", "#F9A8D4"],
          particleDuration: 980,
          particleSize: 16,
          particleOpacity: 96,
          particleGravity: 0,
          particleWind: 0,
          particleBounce: 0,
          particleTrail: false,
          ripple: true,
          rippleSize: 82,
          rippleDuration: 920,
          rippleStyle: "双环",
          rippleEasing: "弹性",
          rippleLineWidth: 3,
          rippleOpacity: 84,
          rippleColor: "#34D399",
          sound: true,
          fontSize: 24,
          volume: 80,
          playbackRate: 104,
          soundFadeOut: 90,
          soundTriggerMode: "连击叠加",
          soundBlendMode: "压低页面音频",
          shake: 50,
          cursorOverride: "木鱼（增强态）",
          cursorSize: 52,
          triggerTiming: "第二次抬起后",
          triggerZone: "双击命中区域",
          holdMs: 320,
          soundFile: "woodfish-deep.wav",
          textOpacity: 100,
          textFontFamily: "系统默认",
          textOffsetX: 0,
          animationEnabled: false,
          animationStyle: "聚焦脉冲",
          animationDuration: 720,
          animationEasing: "缓出",
          animationScale: 100,
          animationOpacity: 100,
          animationOffsetX: 0,
          animationOffsetY: -10,
          animationColor: "#34D399",
          animationGlow: false,
          imageEnabled: false,
          imageDataUrl: "",
          imageDuration: 780,
          imageSize: 56,
          imageOpacity: 100,
          imageOffsetX: 0,
          imageOffsetY: -18,
          textGradient: false,
          textGradientStart: "#FBBF24",
          textGradientEnd: "#EC4899",
          cursorTrailEnabled: false,
          cursorTrailCount: 5,
          cursorTrailOpacity: 50,
          cursorGlowColor: "",
          comboWindowMs: 900,
          soundDelay: 0,
        },
        longPress: {
          textKind: "文本飘字",
          textStyle: "中文数字 (一, 二, 三)",
          textEnabled: false,
          textContent: "蓄",
          textTags: ["按住中", "蓄力完成", "松开触发"],
          textColor: "#7C3AED",
          textDuration: 900,
          textEasing: "缓入缓出",
          textOpacity: 94,
          textWeight: "中等",
          textShadow: "柔和",
          textOffsetY: -22,
          particle: false,
          particleCount: 14,
          particleSpread: 44,
          particleStyle: "碎屑粒子",
          particleDirection: "向上喷发",
          particleDuration: 720,
          particleSize: 12,
          particleOpacity: 78,
          particleGravity: 0,
          particleWind: 0,
          particleBounce: 0,
          particleTrail: false,
          ripple: false,
          rippleSize: 58,
          rippleDuration: 760,
          rippleStyle: "柔和面波",
          rippleEasing: "缓入缓出",
          rippleOpacity: 60,
          rippleColor: "#34D399",
          sound: true,
          fontSize: 20,
          volume: 72,
          playbackRate: 92,
          soundDelay: 60,
          soundFadeOut: 120,
          soundTriggerMode: "每次触发",
          soundBlendMode: "压低页面音频",
          shake: 58,
          cursorOverride: "木鱼（按压态）",
          cursorSize: 50,
          triggerTiming: "松开后触发",
          triggerZone: "按住后释放",
          holdMs: 560,
          soundFile: "woodfish-deep.wav",
          textMode: "默认模式 (+1)",
          textTemplate: "${number}",
          textFontFamily: "系统默认",
          textOutlineWidth: 0,
          textTagPlayMode: "按顺序显示",
          comboEnabled: false,
          textOffsetX: 0,
          particleColorMode: "跟随主题",
          particlePalette: ["#FDBA74", "#FDE68A", "#86EFAC", "#93C5FD", "#F9A8D4"],
          animationEnabled: false,
          animationStyle: "聚焦脉冲",
          animationDuration: 720,
          animationEasing: "缓出",
          animationScale: 100,
          animationOpacity: 100,
          animationOffsetX: 0,
          animationOffsetY: -10,
          animationColor: "#34D399",
          animationGlow: false,
          imageEnabled: false,
          imageDataUrl: "",
          imageDuration: 780,
          imageSize: 56,
          imageOpacity: 100,
          imageOffsetX: 0,
          imageOffsetY: -18,
          textGradient: false,
          textGradientStart: "#FBBF24",
          textGradientEnd: "#EC4899",
          cursorTrailEnabled: false,
          cursorTrailCount: 5,
          cursorTrailOpacity: 50,
          cursorGlowColor: "",
          comboWindowMs: 900,
          rippleLineWidth: 2,
        },
        wheel: {
          textKind: "文本飘字",
          textEnabled: false,
          textContent: "roll",
          textTags: ["向上滚动", "向下滚动", "继续滚动"],
          textTagPlayMode: "随机显示",
          textColor: "#0284C7",
          textDuration: 700,
          textEasing: "线性",
          textOpacity: 90,
          textWeight: "常规",
          textShadow: "无",
          textOffsetY: -14,
          particle: true,
          particleCount: 10,
          particleSpread: 36,
          particleDirection: "沿点击方向",
          particleColorMode: "跟随飘字色",
          particlePalette: ["#FDBA74", "#FDE68A", "#86EFAC", "#93C5FD", "#F9A8D4"],
          particleDuration: 460,
          particleSize: 10,
          particleOpacity: 72,
          particleGravity: 0,
          particleWind: 0,
          particleBounce: 0,
          particleTrail: false,
          ripple: false,
          rippleSize: 36,
          rippleDuration: 480,
          rippleEasing: "线性",
          rippleLineWidth: 1,
          rippleOpacity: 44,
          rippleColor: "#34D399",
          sound: false,
          fontSize: 16,
          volume: 40,
          playbackRate: 110,
          soundFadeOut: 30,
          soundTriggerMode: "节流播放",
          shake: 16,
          cursorOverride: "跟随当前状态",
          cursorSize: 44,
          triggerTiming: "连续滚动中",
          triggerZone: "向上 / 向下滚轮",
          holdMs: 180,
          soundFile: "tick-light.wav",
          textStyle: "阿拉伯数字 (1, 2, 3)",
          textMode: "默认模式 (+1)",
          textTemplate: "${number}",
          textFontFamily: "系统默认",
          textOutlineWidth: 0,
          comboEnabled: false,
          textOffsetX: 0,
          particleStyle: "点状粒子",
          soundBlendMode: "保持原音量",
          soundDelay: 0,
          animationEnabled: false,
          animationStyle: "聚焦脉冲",
          animationDuration: 720,
          animationEasing: "缓出",
          animationScale: 100,
          animationOpacity: 100,
          animationOffsetX: 0,
          animationOffsetY: -10,
          animationColor: "#34D399",
          animationGlow: false,
          imageEnabled: false,
          imageDataUrl: "",
          imageDuration: 780,
          imageSize: 56,
          imageOpacity: 100,
          imageOffsetX: 0,
          imageOffsetY: -18,
          textGradient: false,
          textGradientStart: "#FBBF24",
          textGradientEnd: "#EC4899",
          cursorTrailEnabled: false,
          cursorTrailCount: 5,
          cursorTrailOpacity: 50,
          cursorGlowColor: "",
          comboWindowMs: 900,
          rippleStyle: "单环",
        },
        hover: {
          textKind: "文本飘字",
          textEnabled: false,
          textContent: "hover",
          textTags: ["已聚焦", "经过目标", "可点击"],
          textTagPlayMode: "随机显示",
          textColor: "#475569",
          textDuration: 680,
          textEasing: "缓入缓出",
          textOpacity: 88,
          textWeight: "常规",
          textShadow: "无",
          textOffsetY: -12,
          particle: false,
          particleCount: 8,
          particleSpread: 24,
          particleDirection: "向上喷发",
          particleDuration: 420,
          particleSize: 8,
          particleOpacity: 60,
          particleGravity: 0,
          particleWind: 0,
          particleBounce: 0,
          particleTrail: false,
          ripple: false,
          rippleSize: 32,
          rippleDuration: 420,
          rippleStyle: "柔和面波",
          rippleEasing: "缓入缓出",
          rippleLineWidth: 1,
          rippleOpacity: 38,
          rippleColor: "#34D399",
          sound: false,
          fontSize: 16,
          volume: 0,
          soundFadeOut: 0,
          soundTriggerMode: "节流播放",
          shake: 0,
          cursorOverride: "切换到 pointer",
          cursorSize: 44,
          triggerTiming: "停留后",
          triggerZone: "进入可交互元素",
          holdMs: 220,
          soundFile: "tick-light.wav",
          textStyle: "阿拉伯数字 (1, 2, 3)",
          textMode: "默认模式 (+1)",
          textTemplate: "${number}",
          textFontFamily: "系统默认",
          textOutlineWidth: 0,
          comboEnabled: false,
          textOffsetX: 0,
          particleStyle: "点状粒子",
          particleColorMode: "跟随主题",
          particlePalette: ["#FDBA74", "#FDE68A", "#86EFAC", "#93C5FD", "#F9A8D4"],
          soundBlendMode: "保持原音量",
          playbackRate: 100,
          soundDelay: 0,
          animationEnabled: false,
          animationStyle: "聚焦脉冲",
          animationDuration: 720,
          animationEasing: "缓出",
          animationScale: 100,
          animationOpacity: 100,
          animationOffsetX: 0,
          animationOffsetY: -10,
          animationColor: "#34D399",
          animationGlow: false,
          imageEnabled: false,
          imageDataUrl: "",
          imageDuration: 780,
          imageSize: 56,
          imageOpacity: 100,
          imageOffsetX: 0,
          imageOffsetY: -18,
          textGradient: false,
          textGradientStart: "#FBBF24",
          textGradientEnd: "#EC4899",
          cursorTrailEnabled: false,
          cursorTrailCount: 5,
          cursorTrailOpacity: 50,
          cursorGlowColor: "",
          comboWindowMs: 900,
        },
      };
    }

    function mergeActionConfig(baseConfig, ...overlays) {
      return overlays.reduce(
        (mergedConfig, overlay) => {
          const safeOverlay = overlay
            ? Object.fromEntries(Object.entries(overlay).filter(([, v]) => v !== undefined))
            : {};
          return {
            ...mergedConfig,
            ...safeOverlay,
            textTags: Array.isArray(overlay?.textTags)
              ? [...overlay.textTags]
              : mergedConfig.textTags,
          };
        },
        {
          ...baseConfig,
          textTags: Array.isArray(baseConfig?.textTags) ? [...baseConfig.textTags] : [],
        }
      );
    }

    function getWorkbenchDraft(scheme) {
      const mergedCursorStates = mergeCursorStates(defaultConfig.schemes?.[0]?.cursorStates, scheme?.cursorStates);
      const baseCursorModes = Object.fromEntries(
        Object.entries(mergedCursorStates || {}).map(([stateId, stateConfig]) => [
          stateId,
          stateId === "default" ? (stateConfig.mode === "override" ? "覆盖" : "源") : (stateConfig.mode === "override" ? "覆盖" : "继承"),
        ])
      );
      const baseCursorStateActions = Object.fromEntries(
        Object.entries(mergedCursorStates || {}).map(([stateId, stateConfig]) => [stateId, stateConfig?.actionId || "leftClick"])
      );
      const baseActionConfigs = getBaseActionConfigs();
      const storedDraft = scheme?.workbenchDraft || {};
      const storedActionConfigs = storedDraft.actionConfigs || {};

      return {
        cursorModes: { ...baseCursorModes, ...(storedDraft.cursorModes || {}) },
        cursorStateActions: { ...baseCursorStateActions, ...(storedDraft.cursorStateActions || {}) },
        cursorStateAssets: storedDraft.cursorStateAssets || {},
        actionConfigs: Object.fromEntries(
          Object.keys(baseActionConfigs).map((actionId) => [
            actionId,
            mergeActionConfig(baseActionConfigs[actionId], storedActionConfigs[actionId] || {}),
          ])
        ),
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
          reportRuntimeError?.("config-session-read", "Failed to read live preview from session storage.");
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
        reportRuntimeError?.("config-sync", "Failed to sync config from storage; using defaults.");
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
