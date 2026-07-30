import {
  ActivitySquare,
  Ban,
  CircleDashed,
  Clock3,
  Cloud,
  Coffee,
  Cookie,
  Crosshair,
  Crown,
  Feather,
  Flame,
  Gamepad2,
  Gem,
  Globe,
  Hand,
  Heart,
  ImagePlus,
  Keyboard,
  Link2,
  Moon,
  MousePointer2,
  Move,
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
import { defaultKeyFeedbackConfig } from "@/shared/config/key-feedback";
import { defaultConfig } from "@/shared/config/default-config";
import {
  AUDIO_BLEND_OPTIONS,
  AUDIO_TRIGGER_OPTIONS,
  ANIMATION_STYLE_OPTIONS,
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
  getConflictsForAction,
  getActionAudioConfig,
  getActionAnimationConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
  getActionTriggerConfig,
  getTimingFieldMeta,
  mergeActionConfig,
  pickStoredWorkbenchActionConfigs,
} from "./actionConfigSchema";
import { ANIMATION_EASING_OPTIONS } from "./actionConfigOptions";
import { getDefaultActionConfigs } from "./actionConfigPresets";
import { isDesktop } from "@/shared/runtime";

export const WORKSPACES = [
  { id: "workbench", label: "主题工作台", icon: Wand2 },
  { id: "states", label: "光标皮肤", icon: MousePointer2 },
  { id: "sites", label: "站点规则", icon: Link2 },
  { id: "keyboard", label: "键盘动效", icon: Keyboard },
  { id: "diagnostics", label: "诊断面板", icon: ActivitySquare },
];

const FALLBACK_THEMES = [
  {
    id: "mono-geo",
    name: "几何",
    kind: "内置",
    summary: "黑白灰 · 方块粒子 · 几何波纹",
    tone: "slate",
  },
  {
    id: "drift",
    name: "流光",
    kind: "内置",
    summary: "轨道粒子 · 涟漪扩散 · 沉静青绿",
    tone: "teal",
  },
  {
    id: "molten",
    name: "熔金",
    kind: "内置",
    summary: "火花喷发 · 能量脉冲 · 熔岩橙金",
    tone: "amber",
  },
  {
    id: "sunset",
    name: "夕霞",
    kind: "内置",
    summary: "钻石飘落 · 回声涟漪 · 落日粉橙",
    tone: "rose",
  },
];

const THEME_TONES = ["amber", "teal", "sky", "rose", "slate"];

const THEME_TONE_BY_ID = {
  "mono-geo": "slate",
  drift: "teal",
  molten: "amber",
  sunset: "rose",
};

export const ACTIONS = [
  { id: "leftClick", label: "左键单击", hint: "最常用的触发入口" },
  { id: "rightClick", label: "右键单击", hint: "适合菜单或次要动作" },
  { id: "doubleClick", label: "双击", hint: "更强的强调反馈" },
  { id: "longPress", label: "长按", hint: "按住蓄力后触发" },
  { id: "wheel", label: "滚轮", hint: "轻反馈和页面尾迹" },
  { id: "hover", label: "悬停", hint: "切状态或轻提示" },
];

export const PLATFORM_ACTIONS = isDesktop()
  ? ACTIONS.filter((a) => a.id !== "hover")
  : ACTIONS;

export const CURSOR_STATES = [
  { id: "default", label: "普通", detail: "默认指针，无法识别状态时使用", icon: MousePointer2, group: "基础", support: "已支持", defaultHotspot: "topLeft" },
  { id: "text", label: "文本选择", detail: "输入框、编辑器、文本区域", icon: TextCursorInput, group: "基础", support: "部分应用支持", defaultHotspot: "center" },
  { id: "pointer", label: "可点击", detail: "按钮、链接、菜单项", icon: Hand, group: "基础", support: "部分应用支持", defaultHotspot: "topLeft" },
  { id: "grab", label: "可拖拽", detail: "可抓取的画布或对象", icon: Hand, group: "操作", support: "依赖规则", defaultHotspot: "center" },
  { id: "grabbing", label: "拖拽中", detail: "按住并移动对象或内容", icon: Hand, group: "操作", support: "已支持", defaultHotspot: "center" },
  { id: "busy", label: "忙碌", detail: "应用加载、等待响应", icon: Clock3, group: "系统", support: "依赖规则", defaultHotspot: "center" },
  { id: "notAllowed", label: "不可用", detail: "禁用按钮、无效拖放区域", icon: Ban, group: "操作", support: "部分应用支持", defaultHotspot: "center" },
  { id: "crosshair", label: "精确选择", detail: "截图、绘图、选区", icon: Crosshair, group: "操作", support: "部分应用支持", defaultHotspot: "center" },
  { id: "move", label: "移动", detail: "移动对象、分层或画布元素", icon: Move, group: "操作", support: "依赖规则", defaultHotspot: "center" },
  { id: "resizeHorizontal", label: "横向调整", detail: "左右调整窗口、分栏或对象", icon: Move, group: "调整大小", support: "部分应用支持", defaultHotspot: "center" },
  { id: "resizeVertical", label: "纵向调整", detail: "上下调整窗口、分栏或对象", icon: Move, group: "调整大小", support: "部分应用支持", defaultHotspot: "center" },
  { id: "resizeDiagonalNWSE", label: "对角调整 ↘", detail: "左上到右下方向调整大小", icon: Move, group: "调整大小", support: "部分应用支持", defaultHotspot: "center" },
  { id: "resizeDiagonalNESW", label: "对角调整 ↙", detail: "右上到左下方向调整大小", icon: Move, group: "调整大小", support: "部分应用支持", defaultHotspot: "center" },
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
  slate: {
    chip: "bg-slate-100 text-slate-700 ring-slate-200",
    icon: "bg-slate-200 text-slate-700",
    border: "border-slate-200",
  },
};

function getDefaultThemePacks() {
  return defaultConfig.themes;
}

function getThemeSummaryActionConfig(themePack) {
  if (themePack?.actionConfigs?.leftClick) {
    const baseActionConfig = createThemeDraft(themePack?.id).actionConfigs.leftClick;
    const storedActionConfig = themePack.actionConfigs.leftClick;
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

function toThemeKindLabel(kind) {
  return kind === "builtin" || kind === "内置" ? "内置" : "自定义";
}

function getThemeTone(themeId, fallbackIndex = 0) {
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

function buildThemeLibrarySeed(themes = getDefaultThemePacks()) {
  if (!themes.length) return FALLBACK_THEMES;
  return themes.map((theme, index) => buildThemeLibraryItem(theme, index));
}

export const THEMES = buildThemeLibrarySeed();

export const PANEL_META = {
  trigger: { icon: MousePointer2, tone: "bg-emerald-100 text-emerald-700" },
  text: { icon: Type, tone: "bg-amber-100 text-amber-700" },
  particles: { icon: Waves, tone: "bg-sky-100 text-sky-700" },
  ripple: { icon: CircleDashed, tone: "bg-teal-100 text-teal-700" },
  audio: { icon: Volume2, tone: "bg-rose-100 text-rose-700" },
  animation: { icon: Sparkles, tone: "bg-cyan-100 text-cyan-700" },
  image: { icon: ImagePlus, tone: "bg-fuchsia-100 text-fuchsia-700" },
  cursor: { icon: Settings2, tone: "bg-slate-200 text-slate-700" },
  keyboard: { icon: Keyboard, tone: "bg-violet-100 text-violet-700" },
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
        hotspotX: item.defaultHotspot === "center" ? 24 : 10,
        hotspotY: item.defaultHotspot === "center" ? 24 : 8,
        size: 48,
      },
    ])
  );
}

function buildDefaultCursorSkin() {
  return {
    version: 1,
    enabled: true,
    transitionMs: 80,
    states: {},
  };
}

export function createThemeDraft(themeId) {
  const actionConfigs = getDefaultActionConfigs(themeId);
  return {
    actionConfigs,
    resetActionConfigs: getDefaultActionConfigs(themeId),
    cursorModes: Object.fromEntries(CURSOR_STATES.map((item) => [item.id, item.id === "default" ? "源" : "继承"])),
    cursorStateActions: buildDefaultCursorStateActions(),
    cursorStateAssets: buildDefaultCursorStateAssets(),
    cursorSkin: buildDefaultCursorSkin(),
    keyFeedbackConfig: { ...defaultKeyFeedbackConfig },
    resetKeyFeedbackConfig: { ...defaultKeyFeedbackConfig },
    atmosphere: { mode: "none" },
  };
}

export function buildThemeDrafts(themes = THEMES) {
  return Object.fromEntries((themes || []).map((theme) => [theme.id, createThemeDraft(theme.id)]));
}

export {
  AUDIO_BLEND_OPTIONS,
  AUDIO_TRIGGER_OPTIONS,
  ANIMATION_STYLE_OPTIONS,
  ANIMATION_EASING_OPTIONS,
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
  getActionAudioConfig,
  getActionAnimationConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
  getActionTriggerConfig,
  getConflictsForAction,
  getTimingFieldMeta,
  mergeActionConfig,
  pickStoredWorkbenchActionConfigs,
};
