import {
  ActivitySquare,
  Ban,
  Clock3,
  Cloud,
  Coffee,
  Cookie,
  Crown,
  Feather,
  Flame,
  Gamepad2,
  Gem,
  Globe,
  Hand,
  Heart,
  HelpCircle,
  Link2,
  Moon,
  MousePointer2,
  Music,
  Palette,
  Rainbow,
  Settings2,
  Sparkles,
  Star,
  Sun,
  TextCursorInput,
  Type,
  Volume2,
  Wand2,
  Waves,
  Zap,
} from "lucide-react";
import {
  AUDIO_BLEND_OPTIONS,
  AUDIO_TRIGGER_OPTIONS,
  ANIMATION_STYLE_OPTIONS,
  ACTION_ANIMATION_FIELDS,
  CURSOR_HOTSPOT_OPTIONS,
  CURSOR_OVERRIDE_OPTIONS,
  CURSOR_SIZE_OPTIONS,
  NUMBER_STYLE_OPTIONS,
  LEFT_CLICK_BEHAVIOR_CANONICAL_FIELDS,
  ACTION_AUDIO_FIELDS,
  ACTION_CURSOR_FEEDBACK_FIELDS,
  ACTION_IMAGE_FIELDS,
  ACTION_PARTICLE_FIELDS,
  ACTION_CONFIG_MODEL_BOUNDARIES,
  ACTION_PREVIEW_DERIVED_FIELDS,
  ACTION_RIPPLE_FIELDS,
  ACTION_RUNTIME_FIELDS,
  ACTION_TEXT_FIELDS,
  ACTION_TRIGGER_FIELDS,
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
  getConflictsForAction,
  getActionAudioConfig,
  getActionAnimationConfig,
  getActionCursorFeedbackConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getOrderedActionTextTags,
  getActionTextConfig,
  getActionTriggerConfig,
  getTimingFieldMeta,
  mergeActionConfig,
  pickStoredWorkbenchActionConfig,
  pickStoredWorkbenchActionConfigs,
} from "./actionConfigSchema.js";
import { getDefaultActionConfigs } from "./actionConfigPresets.js";

export const WORKSPACES = [
  { id: "workbench", label: "主题工作台", icon: Wand2 },
  { id: "states", label: "光标状态", icon: MousePointer2 },
  { id: "sites", label: "站点规则", icon: Link2 },
  { id: "diagnostics", label: "诊断面板", icon: ActivitySquare },
];

const FALLBACK_THEMES = [
  {
    id: "woodfish",
    name: "木鱼方案",
    kind: "自定义",
    summary: "数字飘字 · 声音反馈 · 轻波纹",
    tone: "amber",
  },
  {
    id: "lite-default",
    name: "轻量默认风",
    kind: "内置",
    summary: "低打扰 · 日常浏览",
    tone: "teal",
  },
  {
    id: "demo-highlight",
    name: "Demo Highlight",
    kind: "内置",
    summary: "高亮展示 · 录屏友好",
    tone: "sky",
  },
  {
    id: "petal",
    name: "花瓣流光",
    kind: "自定义",
    summary: "柔和粒子 · 粉色短文案",
    tone: "rose",
  },
];

export const THEME_TONES = ["amber", "teal", "sky", "rose"];

const THEME_TONE_BY_ID = {
  woodfish: "amber",
  "lite-default": "teal",
  "demo-highlight": "sky",
  petal: "rose",
};

export const ACTIONS = [
  { id: "leftClick", label: "左键单击", hint: "最常用的触发入口" },
  { id: "rightClick", label: "右键单击", hint: "适合菜单或次要动作" },
  { id: "doubleClick", label: "双击", hint: "更强的强调反馈" },
  { id: "longPress", label: "长按", hint: "按住蓄力后触发" },
  { id: "wheel", label: "滚轮", hint: "轻反馈和页面尾迹" },
  { id: "hover", label: "悬停", hint: "切状态或轻提示" },
];

export const CURSOR_STATES = [
  { id: "default", label: "默认", detail: "Normal · 48 × 48", icon: MousePointer2, defaultMode: "源" },
  { id: "pointer", label: "手型", detail: "Pointer · 48 × 48", icon: Hand, defaultMode: "继承" },
  { id: "text", label: "文本", detail: "Text · 48 × 48", icon: TextCursorInput, defaultMode: "继承" },
  { id: "help", label: "帮助", detail: "Help · 48 × 48", icon: HelpCircle, defaultMode: "继承" },
  { id: "wait", label: "等待", detail: "Wait · 48 × 48", icon: Clock3, defaultMode: "覆盖" },
  { id: "notAllowed", label: "禁用", detail: "Not allowed · 48 × 48", icon: Ban, defaultMode: "继承" },
];

const toneMap = {
  amber: {
    chip: "bg-amber-100 text-amber-700 ring-amber-200",
    icon: "bg-amber-100 text-amber-700",
    border: "border-amber-200",
  },
  teal: {
    chip: "bg-teal-100 text-teal-700 ring-teal-200",
    icon: "bg-teal-100 text-teal-700",
    border: "border-teal-200",
  },
  sky: {
    chip: "bg-sky-100 text-sky-700 ring-sky-200",
    icon: "bg-sky-100 text-sky-700",
    border: "border-sky-200",
  },
  rose: {
    chip: "bg-rose-100 text-rose-700 ring-rose-200",
    icon: "bg-rose-100 text-rose-700",
    border: "border-rose-200",
  },
};

function getDefaultThemePacks() {
  if (typeof window === "undefined") return [];
  return Array.isArray(window.CursorDanceDefaultConfig?.themePacks) ? window.CursorDanceDefaultConfig.themePacks : [];
}

function getThemeSummaryActionConfig(themePack) {
  if (themePack?.workbenchDraft?.actionConfigs?.leftClick) {
    const baseActionConfig = createThemeDraft(themePack?.id).actionConfigs.leftClick;
    const storedActionConfig = themePack.workbenchDraft.actionConfigs.leftClick;
    return mergeActionConfig(baseActionConfig, storedActionConfig);
  }
  if (themePack?.id && THEME_TONE_BY_ID[themePack.id]) {
    return createThemeDraft(themePack.id).actionConfigs.leftClick;
  }
  return null;
}

function buildThemeSummary(themePack) {
  const actionConfig = getThemeSummaryActionConfig(themePack);
  const parts = [];

  if (actionConfig?.textEnabled) {
    parts.push(actionConfig?.textKind === "文本飘字" ? "文本飘字" : "数字飘字");
  }
  if (actionConfig?.sound) {
    parts.push("声音反馈");
  }
  if (actionConfig?.animationEnabled) {
    parts.push("动画反馈");
  }
  if (actionConfig?.imageEnabled) {
    parts.push("图片贴纸");
  }
  if (actionConfig?.ripple) {
    parts.push("轻波纹");
  }
  if (actionConfig?.particle) {
    parts.push("粒子反馈");
  }

  return parts.slice(0, 3).join(" · ") || "默认反馈主题";
}

export function toThemeKindLabel(kind) {
  return kind === "builtin" || kind === "内置" ? "内置" : "自定义";
}

export function getThemeTone(themeId, fallbackIndex = 0) {
  return THEME_TONE_BY_ID[themeId] || THEME_TONES[fallbackIndex % THEME_TONES.length];
}

export function buildThemeLibraryItem(themePack, fallbackIndex = 0) {
  const description = themePack?.description || "未填写说明";
  return {
    id: themePack?.id || `theme-${fallbackIndex + 1}`,
    name: themePack?.name || `主题 ${fallbackIndex + 1}`,
    kind: toThemeKindLabel(themePack?.kind),
    summary: buildThemeSummary(themePack),
    description,
    tone: getThemeTone(themePack?.id, fallbackIndex),
    icon: themePack?.icon || "Wand2",
  };
}

export function buildThemeLibrarySeed(themePacks = getDefaultThemePacks()) {
  if (!themePacks.length) return FALLBACK_THEMES;
  return themePacks.map((themePack, index) => buildThemeLibraryItem(themePack, index));
}

export const THEMES = buildThemeLibrarySeed();

export const PANEL_META = {
  trigger: { icon: MousePointer2, tone: "bg-emerald-100 text-emerald-700" },
  text: { icon: Type, tone: "bg-amber-100 text-amber-700" },
  particles: { icon: Waves, tone: "bg-sky-100 text-sky-700" },
  audio: { icon: Volume2, tone: "bg-rose-100 text-rose-700" },
  cursor: { icon: Settings2, tone: "bg-slate-200 text-slate-700" },
};

export const ICON_OPTIONS = [
  { name: "Wand2", Icon: Wand2 },
  { name: "Sparkles", Icon: Sparkles },
  { name: "Zap", Icon: Zap },
  { name: "Star", Icon: Star },
  { name: "Heart", Icon: Heart },
  { name: "Flame", Icon: Flame },
  { name: "Gem", Icon: Gem },
  { name: "Crown", Icon: Crown },
  { name: "Sun", Icon: Sun },
  { name: "Moon", Icon: Moon },
  { name: "Cloud", Icon: Cloud },
  { name: "Rainbow", Icon: Rainbow },
  { name: "Feather", Icon: Feather },
  { name: "Cookie", Icon: Cookie },
  { name: "Music", Icon: Music },
  { name: "Palette", Icon: Palette },
  { name: "Globe", Icon: Globe },
  { name: "Gamepad2", Icon: Gamepad2 },
  { name: "Coffee", Icon: Coffee },
  { name: "MousePointer2", Icon: MousePointer2 },
];

export function toneClasses(tone) {
  return toneMap[tone] ?? toneMap.teal;
}

export function formatActionLabel(actionId) {
  return ACTIONS.find((item) => item.id === actionId)?.label ?? "左键单击";
}

export function buildDefaultCursorStateActions() {
  return Object.fromEntries(CURSOR_STATES.map((item) => [item.id, "leftClick"]));
}

export function buildDefaultCursorStateAssets() {
  return Object.fromEntries(
    CURSOR_STATES.map((item) => [
      item.id,
      {
        imageDataUrl: "",
        hotspotX: 16,
        hotspotY: 32,
        size: 48,
      },
    ])
  );
}

export function createThemeDraft(themeId) {
  return {
    actionConfigs: getDefaultActionConfigs(themeId),
    cursorModes: Object.fromEntries(CURSOR_STATES.map((item) => [item.id, item.defaultMode])),
    cursorStateActions: buildDefaultCursorStateActions(),
    cursorStateAssets: buildDefaultCursorStateAssets(),
  };
}

export function buildThemeDrafts(themes = THEMES) {
  return Object.fromEntries((themes || []).map((theme) => [theme.id, createThemeDraft(theme.id)]));
}

export {
  AUDIO_BLEND_OPTIONS,
  AUDIO_TRIGGER_OPTIONS,
  ANIMATION_STYLE_OPTIONS,
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
  getActionAudioConfig,
  getActionAnimationConfig,
  getActionCursorFeedbackConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getOrderedActionTextTags,
  getActionTextConfig,
  getActionTriggerConfig,
  getConflictsForAction,
  getTimingFieldMeta,
  mergeActionConfig,
  pickStoredWorkbenchActionConfig,
  pickStoredWorkbenchActionConfigs,
};
