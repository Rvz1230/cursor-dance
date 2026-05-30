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

  const defaultThemePackDefinitions = [
    {
      id: "mono-geo",
      name: "几何",
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
          },
        },
      },
    },
    {
      id: "drift",
      name: "流光",
      description: "轨道粒子环绕光标、涟漪扩散，沉静青绿调，适合专注工作场景。",
      kind: "builtin",
      cursorStates: createDefaultCursorStates(),
      workbenchDraft: {
        actionConfigs: {
          leftClick: {
            textEnabled: false,
            ripple: true,
            rippleSize: 44,
            rippleDuration: 680,
            rippleStyle: "柔和面波",
            rippleColor: "#14B8A6",
            rippleOpacity: 28,
            particle: true,
            particleCount: 16,
            particleSize: 10,
            particleSpread: 60,
            particleStyle: "点状粒子",
            particleMotionMode: "orbital",
            orbitalCount: 8,
            orbitalRadius: 28,
            orbitalSpeed: 2,
            particleDuration: 900,
            particleOpacity: 80,
            particleColorMode: "随机轻变化",
            particlePalette: ["#0D9488","#14B8A6","#5EEAD4","#99F6E4"],
            cursorTrailEnabled: true,
            cursorTrailCount: 3,
            cursorTrailOpacity: 28,
            cursorGlowColor: "#14B8A6",
            sound: false,
            shake: 0,
            cursorOverride: "跟随当前状态",
            holdMs: 0,
          },
        },
      },
    },
    {
      id: "molten",
      name: "熔金",
      description: "火花向上喷发如熔岩飞溅、能量脉冲涟漪，温暖有力的橙金调。",
      kind: "builtin",
      cursorStates: createDefaultCursorStates(),
      workbenchDraft: {
        actionConfigs: {
          leftClick: {
            textEnabled: true,
            textContent: "+1",
            textTags: ["+1", "+2", "+3"],
            textColor: "#EA580C",
            fontSize: 22,
            textWeight: "加粗",
            textEasing: "弹性",
            textShadow: "清晰",
            textGradient: true,
            textGradientStart: "#F97316",
            textGradientEnd: "#FBBF24",
            textOffsetY: -28,
            textDuration: 920,
            comboEnabled: true,
            ripple: true,
            rippleSize: 60,
            rippleDuration: 760,
            rippleStyle: "能量脉冲",
            rippleColor: "#F97316",
            rippleOpacity: 60,
            particle: true,
            particleCount: 28,
            particleSize: 14,
            particleSpread: 60,
            particleStyle: "火花",
            particleDirection: "向上喷发",
            particleDuration: 820,
            particleGravity: 12,
            particleBounce: 6,
            particleOpacity: 90,
            particleColorMode: "随机轻变化",
            particlePalette: ["#F97316","#FB923C","#FBBF24","#FEF08A","#FDE68A"],
            cursorTrailEnabled: true,
            cursorTrailCount: 4,
            cursorTrailOpacity: 40,
            cursorGlowColor: "#F97316",
            sound: true,
            volume: 56,
            shake: 32,
            cursorOverride: "跟随当前状态",
            holdMs: 0,
          },
        },
      },
    },
    {
      id: "sunset",
      name: "夕霞",
      description: "钻石粒子缓缓飘落、回声涟漪荡漾，落日粉橙暖调，温柔优雅。",
      kind: "builtin",
      cursorStates: createDefaultCursorStates(),
      workbenchDraft: {
        actionConfigs: {
          leftClick: {
            textEnabled: true,
            textContent: "+1",
            textTags: ["+1", "+2", "+3"],
            textColor: "#BE185D",
            fontSize: 20,
            textWeight: "加粗",
            textEasing: "弹跳",
            textShadow: "柔和",
            textGradient: true,
            textGradientStart: "#F43F5E",
            textGradientEnd: "#FB923C",
            textOffsetY: -26,
            textDuration: 900,
            comboEnabled: true,
            ripple: true,
            rippleSize: 52,
            rippleDuration: 720,
            rippleStyle: "回声环",
            rippleColor: "#FB7185",
            rippleOpacity: 44,
            particle: true,
            particleCount: 20,
            particleSize: 12,
            particleSpread: 64,
            particleStyle: "钻石",
            particleDuration: 780,
            particleGravity: 4,
            particleWind: 2,
            particleBounce: 8,
            particleOpacity: 82,
            particleColorMode: "随机轻变化",
            particlePalette: ["#F43F5E","#FB7185","#FDA4AF","#FBCFE8","#FFF1F2"],
            cursorTrailEnabled: true,
            cursorTrailCount: 3,
            cursorTrailOpacity: 32,
            cursorGlowColor: "#FB7185",
            sound: false,
            shake: 0,
            cursorOverride: "跟随当前状态",
            holdMs: 0,
          },
        },
      },
    },
  ];

  function createDefaultThemePacks() {
    return defaultThemePackDefinitions.map((pack) => cloneValue(pack));
  }

  function mergeThemePackWithFallback(fallbackPack, pack) {
    const normalizedId = pack?.id || fallbackPack?.id;
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
          id: pack?.id,
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
    const rawActiveThemePackId = value?.activeThemePackId || value?.activeSchemeId;
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
    activeThemePackId: "mono-geo",
    activeSchemeId: "mono-geo",
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
