export const TRIGGER_OPTIONS = {
  leftClick: {
    timing: ["按下时", "抬起时"],
    zones: ["当前页面可点击区域", "仅按钮和链接", "全部可交互元素"],
  },
  rightClick: {
    timing: ["按下时", "菜单弹出前"],
    zones: ["右键菜单前", "可交互元素", "空白区域"],
  },
  doubleClick: {
    timing: ["第二次按下时", "第二次抬起后"],
    zones: ["双击命中区域", "主操作按钮", "内容卡片"],
  },
  longPress: {
    timing: ["按住达到阈值", "松开后触发"],
    zones: ["按住后释放", "长按可交互元素", "全局长按区"],
  },
  wheel: {
    timing: ["滚动开始时", "连续滚动中"],
    zones: ["向上 / 向下滚轮", "仅向上滚动", "仅向下滚动"],
  },
  hover: {
    timing: ["进入时", "停留后"],
    zones: ["进入可交互元素", "仅按钮和链接", "全页面 hover"],
  },
};

export const SOUND_FILE_OPTIONS = ["woodfish-soft.wav", "woodfish-deep.wav", "tick-light.wav"];

export const CURSOR_OVERRIDE_OPTIONS = [
  "跟随当前状态",
  "木鱼（继承默认）",
  "木鱼（增强态）",
  "木鱼（按压态）",
  "切换到 pointer",
];

export const TEXT_KIND_OPTIONS = ["数字飘字", "文本飘字"];
export const NUMBER_STYLE_OPTIONS = ["阿拉伯数字 (1, 2, 3)", "中文数字 (一, 二, 三)", "英文单词 (one, two, three)"];
export const TEXT_MODE_OPTIONS = ["默认模式 (+1)", "模板模式"];
export const TEXT_TAG_PLAY_OPTIONS = ["按顺序显示", "随机显示"];
export const TEXT_EASING_OPTIONS = ["线性", "缓入", "缓出", "缓入缓出", "弹跳", "弹性"];
export const TEXT_WEIGHT_OPTIONS = ["常规", "中等", "加粗"];
export const TEXT_SHADOW_OPTIONS = ["无", "柔和", "清晰"];
export const TEXT_FONT_PRESETS = ["系统默认", "苹方 / 微软雅黑", "宋体", "黑体", "楷体", "等宽字体", "自定义"];
export const PARTICLE_STYLE_OPTIONS = ["点状粒子", "碎屑粒子", "火花"];
export const PARTICLE_DIRECTION_OPTIONS = ["四周扩散", "向上喷发", "沿点击方向"];
export const PARTICLE_COLOR_MODE_OPTIONS = ["跟随主题", "跟随飘字色", "随机轻变化"];
export const RIPPLE_STYLE_OPTIONS = ["单环", "双环", "柔和面波"];
export const RIPPLE_EASING_OPTIONS = ["线性", "缓出", "缓入缓出", "弹性"];
export const AUDIO_TRIGGER_OPTIONS = ["每次触发", "连击叠加", "节流播放"];
export const AUDIO_BLEND_OPTIONS = ["保持原音量", "压低页面音频", "仅插件音效"];
export const CURSOR_SIZE_OPTIONS = ["32 × 32", "40 × 40", "48 × 48", "56 × 56", "64 × 64"];
export const CURSOR_HOTSPOT_OPTIONS = ["0, 0", "8, 8", "12, 12", "16, 16", "16, 32", "24, 24"];
export const ANIMATION_STYLE_OPTIONS = ["聚焦脉冲", "斜切闪片", "弹跳徽记"];
export const ANIMATION_EASING_OPTIONS = ["线性", "缓出", "缓入缓出", "弹性"];

export const ACTION_TRIGGER_FIELDS = ["triggerTiming", "triggerZone", "holdMs"];
export const ACTION_TEXT_FIELDS = [
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
];
export const ACTION_PARTICLE_FIELDS = [
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
export const ACTION_RIPPLE_FIELDS = [
  "ripple",
  "rippleSize",
  "rippleDuration",
  "rippleStyle",
  "rippleEasing",
  "rippleLineWidth",
  "rippleOpacity",
];
export const ACTION_AUDIO_FIELDS = [
  "sound",
  "volume",
  "playbackRate",
  "soundDelay",
  "soundFadeOut",
  "soundTriggerMode",
  "soundBlendMode",
  "soundFile",
];
export const ACTION_ANIMATION_FIELDS = [
  "animationEnabled",
  "animationStyle",
  "animationDuration",
  "animationEasing",
  "animationScale",
  "animationOpacity",
  "animationOffsetX",
  "animationOffsetY",
];
export const ACTION_IMAGE_FIELDS = [
  "imageEnabled",
  "imageDataUrl",
  "imageDuration",
  "imageSize",
  "imageOpacity",
  "imageOffsetX",
  "imageOffsetY",
];
export const ACTION_CURSOR_FEEDBACK_FIELDS = ["shake", "cursorOverride", "cursorSize"];
export const ACTION_RUNTIME_FIELDS = Array.from(
  new Set([
    ...ACTION_TRIGGER_FIELDS,
    ...ACTION_TEXT_FIELDS,
    ...ACTION_PARTICLE_FIELDS,
    ...ACTION_RIPPLE_FIELDS,
    ...ACTION_AUDIO_FIELDS,
    ...ACTION_ANIMATION_FIELDS,
    ...ACTION_IMAGE_FIELDS,
    ...ACTION_CURSOR_FEEDBACK_FIELDS,
  ])
);

export const LEFT_CLICK_BEHAVIOR_CANONICAL_FIELDS = [
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
  "textFontFamily",
  "textWeight",
  "comboEnabled",
  "textOffsetX",
  "textOffsetY",
  "fontSize",
  "particle",
  "particleCount",
  "particleSpread",
  "particleDuration",
  "particleSize",
  "ripple",
  "rippleSize",
  "rippleDuration",
  "holdMs",
];

export const ACTION_WORKBENCH_CANONICAL_FIELDS = ACTION_RUNTIME_FIELDS.filter(
  (fieldName) => !LEFT_CLICK_BEHAVIOR_CANONICAL_FIELDS.includes(fieldName)
);

export const ACTION_PREVIEW_DERIVED_FIELDS = [
  "previewText",
  "previewLoopDelay",
  "previewParticleSpecs",
  "previewRippleSpecs",
  "previewTriggerSummary",
];

export const ACTION_CONFIG_MODEL_BOUNDARIES = {
  runtimeSemantic: {
    leftClickBehaviorCanonical: LEFT_CLICK_BEHAVIOR_CANONICAL_FIELDS,
    workbenchCanonical: ACTION_WORKBENCH_CANONICAL_FIELDS,
  },
  editorOnly: [],
  previewOnlyDerived: ACTION_PREVIEW_DERIVED_FIELDS,
};

function pickActionConfigFields(config, fieldNames) {
  return Object.fromEntries(fieldNames.map((fieldName) => [fieldName, config?.[fieldName]]));
}

export function getActionTriggerConfig(config) {
  return pickActionConfigFields(config, ACTION_TRIGGER_FIELDS);
}

export function getActionTextConfig(config) {
  return pickActionConfigFields(config, ACTION_TEXT_FIELDS);
}

export function getActionParticleConfig(config) {
  return pickActionConfigFields(config, ACTION_PARTICLE_FIELDS);
}

export function getActionRippleConfig(config) {
  return pickActionConfigFields(config, ACTION_RIPPLE_FIELDS);
}

export function getActionAudioConfig(config) {
  return pickActionConfigFields(config, ACTION_AUDIO_FIELDS);
}

export function getActionAnimationConfig(config) {
  return pickActionConfigFields(config, ACTION_ANIMATION_FIELDS);
}

export function getActionImageConfig(config) {
  return pickActionConfigFields(config, ACTION_IMAGE_FIELDS);
}

export function getActionCursorFeedbackConfig(config) {
  return pickActionConfigFields(config, ACTION_CURSOR_FEEDBACK_FIELDS);
}

export function pickStoredWorkbenchActionConfig(actionId, config) {
  if (!config || typeof config !== "object") return {};
  return pickActionConfigFields(config, ACTION_RUNTIME_FIELDS);
}

export function pickStoredWorkbenchActionConfigs(actionConfigs = {}) {
  return Object.fromEntries(
    Object.entries(actionConfigs).map(([actionId, config]) => [
      actionId,
      pickStoredWorkbenchActionConfig(actionId, config),
    ])
  );
}
