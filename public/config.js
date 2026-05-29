(function cursorDanceDefaultConfig() {
  const configHelpers = window.CursorDanceConfigHelpers || {};
  const {
    inferTextKindFromEffect,
    resolveNumberStyleFromEffect,
    resolveTextModeFromEffect,
    resolveActionTextConfigFromEffect,
    buildStoredTextEffectPayload,
    ACTION_TRIGGER_FIELDS,
    ACTION_TEXT_FIELDS,
    ACTION_PARTICLE_FIELDS,
    ACTION_RIPPLE_FIELDS,
    ACTION_AUDIO_FIELDS,
    ACTION_ANIMATION_FIELDS,
    ACTION_IMAGE_FIELDS,
    ACTION_CURSOR_FEEDBACK_FIELDS,
    pickActionConfigFields,
    getActionTriggerConfig,
    getActionTextConfig,
    getActionParticleConfig,
    getActionRippleConfig,
    getActionAudioConfig,
    getActionAnimationConfig,
    getActionImageConfig,
    getActionCursorFeedbackConfig,
  } = configHelpers;

  function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  const DEFAULT_CURSOR_STATE_IDS = [
    "default",
    "pointer",
    "text",
    "help",
    "wait",
    "notAllowed",
  ];

  function createDefaultCursorStates() {
    return DEFAULT_CURSOR_STATE_IDS.reduce((states, stateId) => {
      states[stateId] = {
        mode: "inherit",
        actionId: "leftClick",
        imageDataUrl: "",
        hotspotX: 16,
        hotspotY: 32,
        size: 48,
      };
      return states;
    }, {});
  }

  function normalizeCursorStateConfig(stateConfig, fallbackStateConfig) {
    return {
      ...(fallbackStateConfig || {}),
      ...(stateConfig && typeof stateConfig === "object" && !Array.isArray(stateConfig) ? stateConfig : {}),
      mode: stateConfig?.mode === "override" ? "override" : (fallbackStateConfig?.mode || "inherit"),
      actionId: typeof stateConfig?.actionId === "string" ? stateConfig.actionId : (fallbackStateConfig?.actionId || "leftClick"),
      imageDataUrl: typeof stateConfig?.imageDataUrl === "string" ? stateConfig.imageDataUrl : (fallbackStateConfig?.imageDataUrl || ""),
      hotspotX: Number.isFinite(stateConfig?.hotspotX) ? stateConfig.hotspotX : (fallbackStateConfig?.hotspotX ?? 16),
      hotspotY: Number.isFinite(stateConfig?.hotspotY) ? stateConfig.hotspotY : (fallbackStateConfig?.hotspotY ?? 32),
      size: Number.isFinite(stateConfig?.size) ? stateConfig.size : (fallbackStateConfig?.size ?? 48),
    };
  }

  function mergeCursorStates(fallbackCursorStates, cursorStates) {
    const fallback = fallbackCursorStates || createDefaultCursorStates();
    const nextStates = {
      ...fallback,
    };

    DEFAULT_CURSOR_STATE_IDS.forEach((stateId) => {
      nextStates[stateId] = normalizeCursorStateConfig(cursorStates?.[stateId], fallback[stateId]);
    });

    Object.entries(cursorStates || {}).forEach(([stateId, stateConfig]) => {
      if (Object.prototype.hasOwnProperty.call(nextStates, stateId)) return;
      nextStates[stateId] = normalizeCursorStateConfig(stateConfig, { mode: "inherit" });
    });

    return nextStates;
  }

  const THEME_ID_ALIASES = {
    "cute-pink": "woodfish",
  };

  function normalizeThemePackId(themePackId) {
    if (typeof themePackId !== "string") return themePackId;
    return THEME_ID_ALIASES[themePackId] || themePackId;
  }

  const defaultThemePackDefinitions = [
    {
      id: "woodfish",
      name: "木鱼方案",
      description: "功德 +1、声音反馈和轻波纹，适合默认工作流。",
      kind: "custom",
      cursorStates: createDefaultCursorStates(),
      workbenchDraft: {
        actionConfigs: {
          leftClick: {
            textEnabled: true,
            textContent: "+1",
            textTags: ["功德 +1", "继续点击", "已触发"],
            textColor: "#B45309",
            fontSize: 24,
            textWeight: "加粗",
            textEasing: "弹跳",
            textShadow: "柔和",
            textOffsetY: -28,
            textDuration: 1000,
            comboEnabled: true,
            ripple: true,
            rippleSize: 72,
            rippleDuration: 860,
            rippleStyle: "回声环",
            rippleColor: "#F59E0B",
            particle: true,
            particleCount: 22,
            particleSize: 14,
            particleSpread: 62,
            particleStyle: "火花",
            particleDuration: 780,
            particleGravity: 8,
            particleBounce: 14,
            particlePalette: ["#FBBF24", "#F59E0B", "#FDE68A", "#FCD34D", "#FEF3C7"],
            cursorTrailEnabled: true,
            cursorTrailCount: 4,
            cursorTrailOpacity: 36,
            cursorGlowColor: "#F59E0B",
            sound: true,
            volume: 72,
            shake: 48,
            cursorOverride: "木鱼（继承默认）",
            holdMs: 0,
            soundFile: "woodfish-soft.wav",
          },
        },
      },
    },
    {
      id: "demo-highlight",
      name: "Demo Highlight",
      description: "蓝紫渐变、星光粒子和光晕拖尾，适合演示和录屏。",
      kind: "builtin",
      cursorStates: createDefaultCursorStates(),
      workbenchDraft: {
        actionConfigs: {
          leftClick: {
            textEnabled: true,
            textContent: "+1",
            textTags: ["功德 +1", "继续点击", "已触发"],
            textColor: "#38BDF8",
            fontSize: 28,
            textWeight: "加粗",
            textEasing: "弹性",
            textShadow: "清晰",
            textGradient: true,
            textGradientStart: "#818CF8",
            textGradientEnd: "#06B6D4",
            textOffsetY: -30,
            textDuration: 1060,
            comboEnabled: true,
            ripple: true,
            rippleSize: 92,
            rippleDuration: 900,
            rippleStyle: "能量脉冲",
            rippleColor: "#818CF8",
            rippleOpacity: 82,
            particle: true,
            particleCount: 36,
            particleSize: 16,
            particleSpread: 86,
            particleStyle: "星光",
            particleDuration: 900,
            particleGravity: -10,
            particleOpacity: 94,
            particlePalette: ["#06B6D4","#22D3EE","#818CF8","#A78BFA","#38BDF8"],
            particleColorMode: "随机轻变化",
            animationEnabled: true,
            animationStyle: "螺旋上升",
            animationDuration: 780,
            animationGlow: true,
            animationColor: "#818CF8",
            cursorTrailEnabled: true,
            cursorTrailCount: 8,
            cursorTrailOpacity: 58,
            cursorGlowColor: "#818CF8",
            sound: true,
            volume: 82,
            shake: 64,
            cursorOverride: "木鱼（增强态）",
            holdMs: 0,
            soundFile: "woodfish-soft.wav",
          },
        },
      },
    },
    {
      id: "petal",
      name: "花瓣流光",
      description: "珊瑚暖调、钻石粒子和轻快音效，温暖活泼的互动主题。",
      kind: "custom",
      cursorStates: createDefaultCursorStates(),
      workbenchDraft: {
        actionConfigs: {
          leftClick: {
            textEnabled: true,
            textContent: "+1",
            textTags: ["功德 +1", "继续点击", "已触发"],
            textStyle: "中文数字 (一, 二, 三)",
            textColor: "#E11D48",
            fontSize: 22,
            textWeight: "加粗",
            textEasing: "弹跳",
            textShadow: "柔和",
            textGradient: true,
            textGradientStart: "#F43F5E",
            textGradientEnd: "#FB923C",
            textOffsetY: -26,
            textDuration: 940,
            comboEnabled: true,
            ripple: true,
            rippleSize: 62,
            rippleDuration: 780,
            rippleStyle: "回声环",
            rippleColor: "#FB923C",
            rippleOpacity: 48,
            particle: true,
            particleCount: 24,
            particleSize: 13,
            particleSpread: 68,
            particleStyle: "钻石",
            particleDuration: 720,
            particleGravity: 6,
            particleBounce: 12,
            particleOpacity: 86,
            particlePalette: ["#F97316","#FB923C","#FBBF24","#F59E0B","#FCD34D"],
            sound: true,
            volume: 62,
            shake: 36,
            cursorOverride: "木鱼（继承默认）",
            holdMs: 0,
            soundFile: "woodfish-soft.wav",
          },
        },
      },
    },
    {
      id: "mono-geo",
      name: "极简几何",
      description: "黑白灰配色、方块粒子和几何波纹，极简克制的反馈风格。",
      kind: "builtin",
      cursorStates: createDefaultCursorStates(),
      workbenchDraft: {
        actionConfigs: {
          leftClick: {
            textEnabled: true,
            textKind: "数字飘字",
            textContent: "+1",
            textTags: ["+1", "+2", "+3"],
            textColor: "#1E293B",
            fontSize: 20,
            textWeight: "中等",
            textEasing: "线性",
            textShadow: "无",
            textFontFamily: "等宽字体",
            textOffsetY: -24,
            textDuration: 860,
            comboEnabled: true,
            ripple: true,
            rippleSize: 48,
            rippleDuration: 540,
            rippleStyle: "单环",
            rippleColor: "#334155",
            rippleOpacity: 42,
            particle: true,
            particleCount: 18,
            particleSize: 12,
            particleSpread: 56,
            particleStyle: "方块",
            particleDuration: 640,
            particleGravity: 4,
            particleBounce: 8,
            particleOpacity: 82,
            particlePalette: ["#1E293B","#334155","#475569","#64748B","#94A3B8"],
            particleColorMode: "随机轻变化",
            sound: false,
            shake: 14,
            cursorOverride: "跟随当前状态",
            holdMs: 0,
            soundFile: "woodfish-soft.wav",
          },
        },
      },
    },
  ];

  function createDefaultThemePacks() {
    return defaultThemePackDefinitions.map((pack) => cloneValue(pack));
  }

  function mergeThemePackWithFallback(fallbackPack, pack) {
    const normalizedId = normalizeThemePackId(pack?.id || fallbackPack?.id);
    const mergedWorkbenchDraft = {
      ...(fallbackPack.workbenchDraft || {}),
      ...(pack?.workbenchDraft || {}),
      actionConfigs: {
        ...(fallbackPack.workbenchDraft?.actionConfigs || {}),
        ...(pack?.workbenchDraft?.actionConfigs || {}),
      },
    };
    Object.keys(mergedWorkbenchDraft.actionConfigs).forEach((actionId) => {
      mergedWorkbenchDraft.actionConfigs[actionId] = {
        ...(fallbackPack.workbenchDraft?.actionConfigs?.[actionId] || {}),
        ...(pack?.workbenchDraft?.actionConfigs?.[actionId] || {}),
      };
    });
    return {
      ...fallbackPack,
      ...pack,
      id: normalizedId,
      kind: pack?.kind || fallbackPack.kind || "custom",
      cursorStates: mergeCursorStates(fallbackPack.cursorStates, pack?.cursorStates),
      workbenchDraft: mergedWorkbenchDraft,
    };
  }

  function normalizeSiteRules(siteRules, fallbackSiteRules) {
    if (Array.isArray(siteRules)) {
      return siteRules.filter(function (rule) {
        return rule && typeof rule === "object" && rule.pattern && rule.action;
      }).map(function (rule, index) {
        return {
          id: rule.id || ("r" + (index + 1)),
          pattern: {
            type: (rule.pattern && rule.pattern.type) || "exact",
            value: (rule.pattern && typeof rule.pattern.value === "string") ? rule.pattern.value : "",
          },
          action: rule.action,
          enabled: rule.enabled !== false,
        };
      });
    }

    if (Array.isArray(fallbackSiteRules)) return fallbackSiteRules;
    return [];
  }

  function normalizeEditorPrefs(editorPrefs, fallbackEditorPrefs) {
    return {
      mode: editorPrefs?.mode === "advanced" ? "advanced" : (fallbackEditorPrefs?.mode || "simple"),
      lastWorkspace: editorPrefs?.lastWorkspace || fallbackEditorPrefs?.lastWorkspace || "workspace",
      lastActionId: editorPrefs?.lastActionId || fallbackEditorPrefs?.lastActionId || "leftClick",
      lastCursorState: editorPrefs?.lastCursorState || fallbackEditorPrefs?.lastCursorState || "default",
    };
  }

  function normalizeThemePacks(themePacks, fallbackConfig) {
    const fallbackThemePacks = Array.isArray(fallbackConfig.themePacks) ? fallbackConfig.themePacks : [];
    const storedThemePacks = Array.isArray(themePacks)
      ? themePacks.map((pack) => ({
          ...pack,
          id: normalizeThemePackId(pack?.id),
        }))
      : [];
    const storedById = new Map(storedThemePacks.filter((pack) => pack?.id).map((pack) => [pack.id, pack]));
    const knownIds = new Set(fallbackThemePacks.map((pack) => pack.id));
    const merged = fallbackThemePacks.map((pack) => mergeThemePackWithFallback(pack, storedById.get(pack.id)));
    return merged.concat(storedThemePacks.filter((pack) => pack?.id && !knownIds.has(pack.id)).map((pack) => ({
      ...pack,
      kind: pack.kind || "custom",
    })));
  }

  function normalizeConfig(value, fallbackConfig) {
    const fallback = fallbackConfig || window.CursorDanceDefaultConfig || {};
    const rawThemePacks = Array.isArray(value?.themePacks) ? value.themePacks : value?.schemes;
    const themePacks = normalizeThemePacks(rawThemePacks, fallback);
    const fallbackThemePackId = fallback.activeThemePackId || fallback.activeSchemeId || themePacks[0]?.id;
    const rawActiveThemePackId = normalizeThemePackId(value?.activeThemePackId || value?.activeSchemeId);
    const activeThemePackId = themePacks.some((pack) => pack.id === rawActiveThemePackId) ? rawActiveThemePackId : fallbackThemePackId;
    const siteRules = normalizeSiteRules(value?.siteRules, fallback.siteRules);

    return {
      ...fallback,
      ...value,
      schemaVersion: 3,
      enabled: value?.enabled !== false,
      activeThemePackId,
      activeSchemeId: activeThemePackId,
      themePacks,
      schemes: themePacks,
      siteRules,
      performance: {
        ...(fallback.performance || {}),
        ...(value?.performance || {}),
      },
      editor: normalizeEditorPrefs(value?.editor, fallback.editor),
    };
  }

  function needsMigration(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return true;
    if (value.schemaVersion !== 3) return true;
    if (!Array.isArray(value.themePacks)) return true;
    if (!value.activeThemePackId) return true;
    if (value.siteRules && !Array.isArray(value.siteRules)) return true;
    return false;
  }

  const defaultThemePacks = createDefaultThemePacks();
  const defaultConfig = {
    schemaVersion: 3,
    enabled: true,
    activeThemePackId: "woodfish",
    activeSchemeId: "woodfish",
    themePacks: defaultThemePacks,
    schemes: defaultThemePacks,
    performance: {
      maxActiveEffects: 48,
    },
    siteRules: [],
    editor: {
      mode: "simple",
      lastWorkspace: "workspace",
      lastActionId: "leftClick",
      lastCursorState: "default",
    },
  };

  window.CursorDanceDefaultConfig = defaultConfig;
  window.CursorDanceConfigRuntime = {
    cloneValue,
    createDefaultThemePacks,
    createDefaultCursorStates,
    inferTextKindFromEffect,
    resolveNumberStyleFromEffect,
    resolveTextModeFromEffect,
    resolveActionTextConfigFromEffect,
    buildStoredTextEffectPayload,
    getActionTriggerConfig,
    getActionTextConfig,
    getActionParticleConfig,
    getActionRippleConfig,
    getActionAudioConfig,
    getActionAnimationConfig,
    getActionImageConfig,
    getActionCursorFeedbackConfig,
    mergeThemePackWithFallback,
    mergeCursorStates,
    normalizeSiteRules,
    normalizeConfig,
    needsMigration,
  };
})();
