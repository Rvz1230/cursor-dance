export {
  ACTION_ANIMATION_FIELDS,
  ACTION_AUDIO_FIELDS,
  ACTION_CONFIG_MODEL_BOUNDARIES,
  ACTION_CURSOR_FEEDBACK_FIELDS,
  ACTION_IMAGE_FIELDS,
  ACTION_PARTICLE_FIELDS,
  ACTION_PREVIEW_DERIVED_FIELDS,
  ACTION_RIPPLE_FIELDS,
  ACTION_RUNTIME_FIELDS,
  ACTION_TEXT_FIELDS,
  ACTION_TRIGGER_FIELDS,
  ACTION_WORKBENCH_CANONICAL_FIELDS,
  ANIMATION_STYLE_OPTIONS,
  AUDIO_BLEND_OPTIONS,
  AUDIO_TRIGGER_OPTIONS,
  CURSOR_HOTSPOT_OPTIONS,
  CURSOR_OVERRIDE_OPTIONS,
  CURSOR_SIZE_OPTIONS,
  LEFT_CLICK_BEHAVIOR_CANONICAL_FIELDS,
  NUMBER_STYLE_OPTIONS,
  PARTICLE_COLOR_MODE_OPTIONS,
  PARTICLE_DIRECTION_OPTIONS,
  PARTICLE_STYLE_OPTIONS,
  RIPPLE_EASING_OPTIONS,
  RIPPLE_STYLE_OPTIONS,
  SOUND_FILE_OPTIONS,
  TEXT_EASING_OPTIONS,
  TEXT_FONT_PRESETS,
  TEXT_KIND_OPTIONS,
  TEXT_MODE_OPTIONS,
  TEXT_SHADOW_OPTIONS,
  TEXT_TAG_PLAY_OPTIONS,
  TEXT_WEIGHT_OPTIONS,
  TRIGGER_OPTIONS,
  getActionAnimationConfig,
  getActionAudioConfig,
  getActionCursorFeedbackConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
  getActionTriggerConfig,
  pickStoredWorkbenchActionConfig,
  pickStoredWorkbenchActionConfigs,
} from "./actionConfigOptions.js";

export {
  getConflictsForAction,
  getTimingFieldMeta,
} from "./actionConfigPresets.js";

import {
  ACTION_RUNTIME_FIELDS,
  ACTION_WORKBENCH_CANONICAL_FIELDS,
  getActionAnimationConfig,
  getActionAudioConfig,
  getActionCursorFeedbackConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
  getActionTriggerConfig,
  pickStoredWorkbenchActionConfig,
  pickStoredWorkbenchActionConfigs,
} from "./actionConfigOptions.js";

export function mergeActionConfig(baseConfig = {}, ...overlays) {
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

export function getOrderedActionTextTags(config) {
  const currentTags = Array.isArray(config?.textTags) ? config.textTags.filter(Boolean) : [];
  const primaryText = typeof config?.textContent === "string" ? config.textContent.trim() : "";
  if (!primaryText) return currentTags;
  return [primaryText, ...currentTags.filter((item) => item !== primaryText)];
}
