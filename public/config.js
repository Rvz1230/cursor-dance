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
            textOffsetY: -52,
            textDuration: 1000,
            comboEnabled: true,
            ripple: true,
            rippleSize: 104,
            rippleDuration: 820,
            particle: true,
            particleCount: 18,
            particleSize: 9,
            particleSpread: 56,
            particleDuration: 760,
            sound: true,
            volume: 78,
            shake: 42,
            cursorOverride: "木鱼（继承默认）",
            holdMs: 80,
            soundFile: "woodfish-soft.wav",
          },
        },
      },
    },
    {
      id: "lite-default",
      name: "轻量默认风",
      description: "保留反馈但更克制，适合日常浏览。",
      kind: "builtin",
      cursorStates: createDefaultCursorStates(),
      workbenchDraft: {
        actionConfigs: {
          leftClick: {
            textEnabled: true,
            textContent: "+1",
            textTags: ["功德 +1", "继续点击", "已触发"],
            textColor: "#0F766E",
            fontSize: 18,
            textWeight: "中等",
            textOffsetX: 10,
            textOffsetY: -48,
            textDuration: 760,
            comboEnabled: true,
            ripple: true,
            rippleSize: 96,
            rippleDuration: 620,
            particle: false,
            particleCount: 8,
            particleSize: 5,
            particleSpread: 34,
            particleDuration: 540,
            sound: false,
            shake: 12,
            cursorOverride: "木鱼（继承默认）",
            holdMs: 110,
            soundFile: "woodfish-soft.wav",
          },
        },
      },
    },
    {
      id: "demo-highlight",
      name: "Demo Highlight",
      description: "更亮、更大，适合演示和录屏。",
      kind: "builtin",
      cursorStates: createDefaultCursorStates(),
      workbenchDraft: {
        actionConfigs: {
          leftClick: {
            textEnabled: true,
            textContent: "+1",
            textTags: ["功德 +1", "继续点击", "已触发"],
            textColor: "#7C3AED",
            fontSize: 26,
            textWeight: "加粗",
            textOffsetX: 14,
            textOffsetY: -62,
            textDuration: 1020,
            comboEnabled: true,
            ripple: true,
            rippleSize: 138,
            rippleDuration: 900,
            particle: true,
            particleCount: 26,
            particleSize: 9,
            particleSpread: 62,
            particleDuration: 860,
            sound: true,
            volume: 84,
            shake: 55,
            cursorOverride: "木鱼（增强态）",
            holdMs: 60,
            soundFile: "woodfish-soft.wav",
          },
        },
      },
    },
    {
      id: "petal",
      name: "花瓣流光",
      description: "柔和粒子和粉色飘字，适合轻互动主题。",
      kind: "custom",
      cursorStates: createDefaultCursorStates(),
      workbenchDraft: {
        actionConfigs: {
          leftClick: {
            textEnabled: true,
            textContent: "+1",
            textTags: ["功德 +1", "继续点击", "已触发"],
            textStyle: "中文数字 (一, 二, 三)",
            textColor: "#BE185D",
            fontSize: 24,
            textWeight: "加粗",
            textOffsetY: -52,
            textDuration: 920,
            comboEnabled: true,
            ripple: true,
            rippleSize: 108,
            rippleDuration: 760,
            particle: true,
            particleCount: 16,
            particleSize: 8,
            particleSpread: 50,
            particleDuration: 720,
            sound: true,
            volume: 68,
            shake: 26,
            cursorOverride: "木鱼（继承默认）",
            holdMs: 90,
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

  function normalizeSiteRule(rule) {
    if (typeof rule === "string") {
      return {
        mode: rule,
      };
    }
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
      return {
        mode: "inherit",
      };
    }
    return {
      mode: typeof rule.mode === "string" ? rule.mode : "inherit",
      themePackId: typeof rule.themePackId === "string" ? normalizeThemePackId(rule.themePackId) : undefined,
    };
  }

  function normalizeSiteRules(siteRules, fallbackSiteRules) {
    const mergedByHost = {
      ...((fallbackSiteRules && fallbackSiteRules.byHost) || {}),
    };
    Object.entries((siteRules && siteRules.byHost) || {}).forEach(([host, rule]) => {
      mergedByHost[host] = normalizeSiteRule(rule);
    });
    return {
      ...(fallbackSiteRules || {}),
      ...(siteRules || {}),
      byHost: mergedByHost,
    };
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
      schemaVersion: 2,
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
    if (value.schemaVersion !== 2) return true;
    if (!Array.isArray(value.themePacks)) return true;
    if (!value.activeThemePackId) return true;
    return Object.values(value.siteRules?.byHost || {}).some((rule) => typeof rule === "string");
  }

  function getSiteRule(config, host) {
    return normalizeSiteRule(config?.siteRules?.byHost?.[host]);
  }

  function getSiteMode(config, host) {
    return getSiteRule(config, host).mode;
  }

  function getSiteThemePackId(config, host) {
    return getSiteRule(config, host).themePackId;
  }

  function setSiteRuleMode(config, host, mode) {
    const nextByHost = {
      ...(config?.siteRules?.byHost || {}),
    };
    if (!host || mode === "inherit") {
      delete nextByHost[host];
    } else {
      const currentRule = normalizeSiteRule(nextByHost[host]);
      nextByHost[host] = {
        ...currentRule,
        mode,
      };
    }
    return {
      ...config,
      siteRules: {
        ...(config?.siteRules || {}),
        byHost: nextByHost,
      },
    };
  }

  function setSiteRuleThemePackId(config, host, themePackId) {
    const nextByHost = {
      ...(config?.siteRules?.byHost || {}),
    };
    if (!host) {
      return {
        ...config,
        siteRules: {
          ...(config?.siteRules || {}),
          byHost: nextByHost,
        },
      };
    }

    const currentRule = normalizeSiteRule(nextByHost[host]);
    nextByHost[host] = {
      ...currentRule,
      mode: currentRule.mode === "disabled" ? "enabled" : currentRule.mode,
      themePackId: normalizeThemePackId(themePackId),
    };

    return {
      ...config,
      siteRules: {
        ...(config?.siteRules || {}),
        byHost: nextByHost,
      },
    };
  }

  const defaultThemePacks = createDefaultThemePacks();
  const defaultConfig = {
    schemaVersion: 2,
    enabled: true,
    activeThemePackId: "woodfish",
    activeSchemeId: "woodfish",
    themePacks: defaultThemePacks,
    schemes: defaultThemePacks,
    performance: {
      maxActiveEffects: 48,
    },
    siteRules: {
      byHost: {},
    },
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
    normalizeSiteRule,
    normalizeSiteRules,
    normalizeConfig,
    needsMigration,
    getSiteRule,
    getSiteMode,
    getSiteThemePackId,
    setSiteRuleMode,
    setSiteRuleThemePackId,
  };
})();
