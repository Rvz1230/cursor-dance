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
    "text",
    "pointer",
    "grab",
    "grabbing",
    "busy",
    "notAllowed",
    "crosshair",
    "move",
    "resizeHorizontal",
    "resizeVertical",
    "resizeDiagonalNWSE",
    "resizeDiagonalNESW",
  ];

  function createDefaultCursorBindings() {
    return Object.fromEntries(DEFAULT_CURSOR_STATE_IDS.map((stateId) => [
      stateId,
      {
        mode: stateId === "default" ? "override" : "inherit",
        actionId: "leftClick",
      },
    ]));
  }

  function createDefaultCursorSkin() {
    return {
      version: 1,
      enabled: true,
      transitionMs: 80,
      states: {},
    };
  }

  const defaultKeyFeedbackConfig = {
    enabled: true,
    animationStyle: "bounce",
    originEdge: "bottom",
    originMapping: "keyboardLayout",
    globalOffsetX: 0.5,
    globalOffsetY: 0.08,
    fontSize: 48,
    fontWeight: "加粗",
    fontFamily: "系统默认",
    color: "#F59E0B",
    opacity: 90,
    uppercase: false,
    showModifierKeys: true,
    keyDisplayMode: "typed",
    semanticStyles: true,
    typingCombo: true,
    duration: 900,
    easing: "弹跳",
    scale: 1,
    bounceHeight: 140,
    gravity: 0.3,
    wind: 0,
    glow: false,
    glowColor: "#FBBF24",
    glowRadius: 8,
    trail: false,
    trailLength: 3,
    splash: false,
    cooldownMs: 35,
    maxSimultaneous: 30,
    delay: 0,
  };

  const defaultThemePackDefinitions = [
    {
      id: "mono-geo",
      name: "几何",
      description: "黑白灰配色、方块粒子和几何波纹，极简克制的反馈风格。",
      kind: "builtin",
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
    {
      id: "drift",
      name: "流光",
      description: "轨道粒子环绕光标、涟漪扩散，沉静青绿调，适合专注工作场景。",
      kind: "builtin",
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
    {
      id: "molten",
      name: "熔金",
      description: "火花向上喷发如熔岩飞溅、能量脉冲涟漪，温暖有力的橙金调。",
      kind: "builtin",
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
    {
      id: "sunset",
      name: "夕霞",
      description: "钻石粒子缓缓飘落、回声涟漪荡漾，落日粉橙暖调，温柔优雅。",
      kind: "builtin",
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
  ];

  function createDefaultThemes() {
    return defaultThemePackDefinitions.map((definition) => ({
      id: definition.id,
      name: definition.name,
      description: definition.description,
      kind: definition.kind,
      actionConfigs: cloneValue(definition.actionConfigs),
      cursorBindings: createDefaultCursorBindings(),
      cursorSkin: createDefaultCursorSkin(),
      keyFeedbackConfig: cloneValue(defaultKeyFeedbackConfig),
    }));
  }

  const ROOT_KEYS = new Set(["schemaVersion", "enabled", "activeThemeId", "themes", "contextRules", "performance"]);
  const THEME_KEYS = new Set(["id", "name", "description", "kind", "actionConfigs", "cursorBindings", "cursorSkin", "keyFeedbackConfig", "atmosphere"]);

  function hasOnlyKeys(value, allowed) {
    return value && typeof value === "object" && !Array.isArray(value)
      && Object.keys(value).every((key) => allowed.has(key));
  }

  function isCompleteV4(value) {
    if (!hasOnlyKeys(value, ROOT_KEYS) || value.schemaVersion !== 4 || typeof value.enabled !== "boolean") return false;
    if (!Array.isArray(value.themes) || value.themes.length === 0 || !Array.isArray(value.contextRules)) return false;
    const ids = new Set();
    for (const theme of value.themes) {
      if (!hasOnlyKeys(theme, THEME_KEYS) || typeof theme.id !== "string" || !theme.id || ids.has(theme.id)) return false;
      if (typeof theme.name !== "string" || !theme.name || !["builtin", "custom"].includes(theme.kind)) return false;
      if (!theme.actionConfigs || !theme.cursorBindings || !theme.cursorSkin || !theme.keyFeedbackConfig) return false;
      if (theme.cursorSkin.version !== 1 || !theme.cursorSkin.states || typeof theme.cursorSkin.states !== "object") return false;
      ids.add(theme.id);
    }
    if (typeof value.activeThemeId !== "string" || !ids.has(value.activeThemeId)) return false;
    if (!value.performance || !Number.isInteger(value.performance.maxActiveEffects) || value.performance.maxActiveEffects < 1) return false;
    return value.contextRules.every((rule) => {
      if (!rule || typeof rule.id !== "string" || typeof rule.enabled !== "boolean") return false;
      if (rule.context !== "web" && rule.context !== "desktop") return false;
      if (!rule.match || !rule.action || !["enable", "disable"].includes(rule.action.type)) return false;
      return !rule.action.themeId || ids.has(rule.action.themeId);
    });
  }

  function normalizeConfig(value, fallbackConfig) {
    const fallback = fallbackConfig || window.CursorDanceDefaultConfig;
    return isCompleteV4(value) ? value : fallback;
  }

  const defaultThemes = createDefaultThemes();
  const defaultConfig = {
    schemaVersion: 4,
    enabled: true,
    activeThemeId: "mono-geo",
    themes: defaultThemes,
    contextRules: [],
    performance: {
      maxActiveEffects: 48,
    },
  };

  window.CursorDanceDefaultConfig = defaultConfig;
  window.CursorDanceConfigRuntime = {
    cloneValue,
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
    normalizeConfig,
  };
})();
