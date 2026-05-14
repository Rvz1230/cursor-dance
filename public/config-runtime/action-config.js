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
    "textWeight",
    "textOutlineWidth",
    "textShadow",
    "comboEnabled",
    "textOffsetX",
    "textOffsetY",
    "fontSize",
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
  ];
  const ACTION_RIPPLE_FIELDS = [
    "ripple",
    "rippleSize",
    "rippleDuration",
    "rippleStyle",
    "rippleEasing",
    "rippleLineWidth",
    "rippleOpacity",
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
    "animationScale",
    "animationOpacity",
    "animationOffsetX",
    "animationOffsetY",
  ];
  const ACTION_IMAGE_FIELDS = [
    "imageEnabled",
    "imageDataUrl",
    "imageDuration",
    "imageSize",
    "imageOpacity",
    "imageOffsetX",
    "imageOffsetY",
  ];
  const ACTION_CURSOR_FEEDBACK_FIELDS = ["shake", "cursorOverride", "cursorSize"];

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
  });
})(window);
