(function registerCursorDanceActionConfigHelpers(globalThis) {
  const helpers = globalThis.CursorDanceConfigHelpers || (globalThis.CursorDanceConfigHelpers = {});

  const ACTION_TRIGGER_FIELDS = ["triggerTiming", "triggerZone", "holdMs"];
  const ACTION_TEXT_FIELDS = [
    "textKind",
    "textStyle",
    "textMode",
    "textTemplate",
    "textEnabled",
    "textContent",
    "textTags",
    "textTagPlayMode",
    "textColor",
    "textDuration",
    "textEasing",
    "textOpacity",
    "textFontFamily",
    "textWeight",
    "textOutlineWidth",
    "textShadow",
    "comboEnabled",
    "textOffsetX",
    "textOffsetY",
    "fontSize",
    "textGradient",
    "textGradientStart",
    "textGradientEnd",
    "comboWindowMs",
    "textDelay",
  ];
  const ACTION_PARTICLE_FIELDS = [
    "particle",
    "particleCount",
    "particleSpread",
    "particleStyle",
    "particleDirection",
    "particleColorMode",
    "particleDuration",
    "particleSize",
    "particleOpacity",
    "particlePalette",
    "particleGravity",
    "particleWind",
    "particleBounce",
    "particleTrail",
    "particleDelay",
    "particleStagger",
    "particleMotionMode",
    "orbitalCount",
    "orbitalRadius",
    "orbitalSpeed",
  ];
  const ACTION_RIPPLE_FIELDS = [
    "ripple",
    "rippleSize",
    "rippleDuration",
    "rippleStyle",
    "rippleEasing",
    "rippleLineWidth",
    "rippleOpacity",
    "rippleColor",
    "rippleDelay",
  ];
  const ACTION_AUDIO_FIELDS = [
    "sound",
    "volume",
    "playbackRate",
    "soundDelay",
    "soundFadeOut",
    "soundTriggerMode",
    "soundBlendMode",
    "soundFile",
  ];
  const ACTION_ANIMATION_FIELDS = [
    "animationEnabled",
    "animationStyle",
    "animationDuration",
    "animationEasing",
    "animationScale",
    "animationOpacity",
    "animationOffsetX",
    "animationOffsetY",
    "animationColor",
    "animationGlow",
    "animationDelay",
  ];
  const ACTION_IMAGE_FIELDS = [
    "imageEnabled",
    "imageDataUrl",
    "imageDuration",
    "imageSize",
    "imageOpacity",
    "imageOffsetX",
    "imageOffsetY",
    "imageDelay",
  ];
  const ACTION_CURSOR_FEEDBACK_FIELDS = ["shake", "cursorOverride", "cursorSize", "cursorTrailEnabled", "cursorTrailCount", "cursorTrailOpacity", "cursorGlowColor"];

  function pickActionConfigFields(config, fieldNames) {
    return Object.fromEntries(fieldNames.map((fieldName) => [fieldName, config?.[fieldName]]));
  }

  function getActionTriggerConfig(config) {
    return pickActionConfigFields(config, ACTION_TRIGGER_FIELDS);
  }

  function getActionTextConfig(config) {
    return pickActionConfigFields(config, ACTION_TEXT_FIELDS);
  }

  function getActionParticleConfig(config) {
    return pickActionConfigFields(config, ACTION_PARTICLE_FIELDS);
  }

  function getActionRippleConfig(config) {
    return pickActionConfigFields(config, ACTION_RIPPLE_FIELDS);
  }

  function getActionAudioConfig(config) {
    return pickActionConfigFields(config, ACTION_AUDIO_FIELDS);
  }

  function getActionAnimationConfig(config) {
    return pickActionConfigFields(config, ACTION_ANIMATION_FIELDS);
  }

  function getActionImageConfig(config) {
    return pickActionConfigFields(config, ACTION_IMAGE_FIELDS);
  }

  function getActionCursorFeedbackConfig(config) {
    return pickActionConfigFields(config, ACTION_CURSOR_FEEDBACK_FIELDS);
  }

  function hexToRgba(hex, alpha) {
    const normalized = (hex || "#f59e0b").replace("#", "");
    const value = normalized.length === 3
      ? normalized
          .split("")
          .map((item) => item + item)
          .join("")
      : normalized;
    const int = Number.parseInt(value, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function getAnimationEasing(label) {
    if (label === "线性") return "linear";
    if (label === "缓入") return "cubic-bezier(0.4, 0, 1, 1)";
    if (label === "缓入缓出") return "cubic-bezier(0.4, 0, 0.2, 1)";
    if (label === "弹跳") return "cubic-bezier(0.34, 1.56, 0.64, 1)";
    if (label === "弹性") return "cubic-bezier(0.22, 1, 0.36, 1.18)";
    return "cubic-bezier(0, 0, 0.2, 1)";
  }

  function getTextWeightValue(weightLabel) {
    if (weightLabel === "加粗") return 700;
    if (weightLabel === "中等") return 600;
    return 500;
  }

  var TEXT_FONT_FAMILY_VALUES = {
    "系统默认": '"SF Pro Text","PingFang SC","Microsoft YaHei",system-ui,sans-serif',
    "苹方 / 微软雅黑": '"PingFang SC","Microsoft YaHei","Helvetica Neue",Arial,sans-serif',
    "宋体": 'SimSun,"Songti SC",serif',
    "黑体": 'SimHei,"Heiti SC",sans-serif',
    "楷体": 'KaiTi,"Kaiti SC",serif',
    "等宽字体": '"SFMono-Regular",Consolas,"Liberation Mono",monospace',
  };

  function getTextFontFamily(value) {
    var textFontFamily = typeof value === "string" ? value.trim() : "";
    if (!textFontFamily || textFontFamily === "自定义") return TEXT_FONT_FAMILY_VALUES["系统默认"];
    if (TEXT_FONT_FAMILY_VALUES[textFontFamily]) return TEXT_FONT_FAMILY_VALUES[textFontFamily];
    return textFontFamily.replace(/[;\n\r]/g, "").slice(0, 120) || TEXT_FONT_FAMILY_VALUES["系统默认"];
  }

  function formatNumber(style, number) {
    if (style?.includes("中文")) {
      var values = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
      return values[(number - 1) % values.length];
    }
    if (style?.includes("英文")) {
      var values = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
      return values[(number - 1) % values.length];
    }
    return String(number);
  }

  function getOrderedTextTags(actionConfig) {
    var currentTags = Array.isArray(actionConfig?.textTags) ? actionConfig.textTags.filter(Boolean) : [];
    var primaryText = typeof actionConfig?.textContent === "string" ? actionConfig.textContent.trim() : "";
    if (!primaryText) return currentTags;
    return [primaryText].concat(currentTags.filter(function (item) { return item !== primaryText; }));
  }

  function getParticleColor(particleConfig, textConfig, index) {
    var palette = Array.isArray(particleConfig.particlePalette) && particleConfig.particlePalette.length
      ? particleConfig.particlePalette
      : ["#FDBA74", "#FDE68A", "#86EFAC", "#93C5FD", "#F9A8D4"];
    var opacity = (particleConfig.particleOpacity || 88) / 100;
    if (particleConfig.particleColorMode === "跟随飘字色") {
      return hexToRgba(textConfig.textColor, opacity);
    }
    if (particleConfig.particleColorMode === "随机轻变化") {
      return hexToRgba(palette[index % palette.length], opacity);
    }
    return hexToRgba(palette[0] || "#FBBF24", opacity);
  }

  Object.assign(helpers, {
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
    hexToRgba,
    getAnimationEasing,
    getTextWeightValue,
    TEXT_FONT_FAMILY_VALUES,
    getTextFontFamily,
    formatNumber,
    getOrderedTextTags,
    getParticleColor,
  });
})(window);
