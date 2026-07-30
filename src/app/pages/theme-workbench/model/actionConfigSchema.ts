export {
  ANIMATION_STYLE_OPTIONS,
  AUDIO_BLEND_OPTIONS,
  AUDIO_TRIGGER_OPTIONS,
  CURSOR_OVERRIDE_OPTIONS,
  NUMBER_STYLE_OPTIONS,
  PARTICLE_COLOR_MODE_OPTIONS,
  PARTICLE_DIRECTION_OPTIONS,
  PARTICLE_MOTION_MODE_OPTIONS,
  PARTICLE_PALETTE_PRESETS,
  PARTICLE_PHYSICS_PRESET_OPTIONS,
  PARTICLE_PHYSICS_PRESET_VALUES,
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
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
  getActionTriggerConfig,
  pickStoredWorkbenchActionConfigs,
} from "./actionConfigOptions";

export {
  getConflictsForAction,
  getTimingFieldMeta,
} from "./actionConfigPresets";

export function mergeActionConfig(baseConfig: Record<string, any> = {}, ...overlays: Array<Record<string, any> | null | undefined>) {
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
