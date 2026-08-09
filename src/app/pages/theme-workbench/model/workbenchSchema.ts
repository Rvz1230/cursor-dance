import {
  ActivitySquare,
  Ban,
  CircleDashed,
  Clock3,
  Hand,
  HelpCircle,
  ImagePlus,
  Keyboard,
  Link2,
  MousePointer2,
  Settings2,
  Sparkles,
  TextCursorInput,
  Type,
  Volume2,
  Wand2,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { defaultKeyFeedbackConfig } from "@/shared/config/key-feedback";
import { createDefaultAtmosphereConfig } from "@/shared/config/cursor-trail";
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
  mergeActionConfig,
  pickStoredWorkbenchActionConfigs,
} from "./actionConfigSchema";
import { ANIMATION_EASING_OPTIONS } from "./actionConfigOptions";
import { getDefaultActionConfigs } from "@/shared/effect-core/default-action-configs";
import { isDesktop } from "@/shared/runtime";
import { getCursorStatesForPlatform, type CursorStateId } from "@/shared/cursor-states";
import {
  createCursorBindings,
  createCursorSkin,
  type CursorDanceTheme,
} from "@/shared/domain/cursor-dance";
import type {
  WorkbenchThemeDraft,
  WorkbenchThemeMeta,
} from "../hooks/workbenchStateTypes";

export type WorkbenchWorkspaceGroup = "personalization" | "automation" | "system";

export const WORKSPACES = [
  { id: "workbench", label: "主题与效果", icon: Wand2, group: "personalization" },
  { id: "states", label: "光标皮肤", icon: MousePointer2, group: "personalization" },
  { id: "keyboard", label: "键盘动效", icon: Keyboard, group: "personalization" },
  { id: "sites", label: "站点规则", icon: Link2, group: "automation" },
  { id: "diagnostics", label: "诊断面板", icon: ActivitySquare, group: "system" },
] satisfies Array<{
  id: string;
  label: string;
  icon: LucideIcon;
  group: WorkbenchWorkspaceGroup;
}>;

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

const THEME_TONE_BY_ID: Record<string, string> = {
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

const CURSOR_STATE_ICONS: Record<CursorStateId, LucideIcon> = {
  default: MousePointer2,
  text: TextCursorInput,
  pointer: Hand,
  notAllowed: Ban,
  busy: Clock3,
  help: HelpCircle,
  grabbing: Hand,
};

/**
 * 只包含当前平台运行时真正能产出的光标状态。
 * 状态清单与可达性的唯一真值源是 `src/shared/cursor-states.ts`；这里只补 UI 图标。
 */
export const CURSOR_STATES = getCursorStatesForPlatform(isDesktop() ? "desktop" : "extension")
  .map((descriptor) => ({
    id: descriptor.id,
    label: descriptor.label,
    detail: descriptor.detail,
    defaultHotspot: descriptor.defaultHotspot,
    icon: CURSOR_STATE_ICONS[descriptor.id],
  }));

function getDefaultThemePacks(): readonly CursorDanceTheme[] {
  return defaultConfig.themes;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function getThemeSummaryActionConfig(themePack: unknown): Record<string, unknown> | null {
  const source = asRecord(themePack);
  const id = typeof source?.id === "string" ? source.id : "";
  const actionConfigs = asRecord(source?.actionConfigs);
  const storedActionConfig = asRecord(actionConfigs?.leftClick);
  if (storedActionConfig) {
    const baseActionConfig = createThemeDraft(id).actionConfigs.leftClick;
    return mergeActionConfig(baseActionConfig, storedActionConfig);
  }
  if (id && THEME_TONE_BY_ID[id]) {
    return createThemeDraft(id).actionConfigs.leftClick;
  }
  return null;
}

function buildThemeSummary(themePack: unknown): string {
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

function toThemeKindLabel(kind: unknown): string {
  return kind === "builtin" || kind === "内置" ? "内置" : "自定义";
}

function getThemeTone(themeId: string | undefined, fallbackIndex = 0): string {
  return (themeId ? THEME_TONE_BY_ID[themeId] : undefined)
    || THEME_TONES[fallbackIndex % THEME_TONES.length];
}

export function buildWorkbenchThemeMeta(
  themePack: unknown,
  fallbackIndex = 0,
): WorkbenchThemeMeta {
  const source = asRecord(themePack);
  const id = typeof source?.id === "string" ? source.id : `theme-${fallbackIndex + 1}`;
  const name = typeof source?.name === "string" ? source.name : `主题 ${fallbackIndex + 1}`;
  const description = typeof source?.description === "string" ? source.description : "未填写说明";
  const icon = typeof source?.icon === "string" ? source.icon : "Wand2";
  return {
    id,
    name,
    kind: toThemeKindLabel(source?.kind),
    summary: buildThemeSummary(themePack),
    description,
    tone: getThemeTone(id, fallbackIndex),
    icon,
  };
}

function buildThemeLibrarySeed(
  themes: readonly unknown[] = getDefaultThemePacks(),
): WorkbenchThemeMeta[] {
  if (!themes.length) return FALLBACK_THEMES;
  return themes.map((theme, index) => buildWorkbenchThemeMeta(theme, index));
}

export const THEMES = buildThemeLibrarySeed();

/**
 * 只留图标，不再带色调。
 *
 * 原先每种效果分一个色（emerald/amber/sky/teal/rose/cyan/fuchsia/slate/violet），
 * 八张卡排一列就是八种颜色——颜色不承载信息，还把「启用/关闭」这个真正要看的状态盖住了。
 * 现在色调由 `Panel` 的 `enabled` 决定：深底=启用、浅灰=关闭（DESIGN.md 色彩）。
 */
export const PANEL_META = {
  trigger: { icon: MousePointer2 },
  text: { icon: Type },
  particles: { icon: Waves },
  ripple: { icon: CircleDashed },
  audio: { icon: Volume2 },
  animation: { icon: Sparkles },
  image: { icon: ImagePlus },
  cursor: { icon: Settings2 },
  keyboard: { icon: Keyboard },
};

export function formatActionLabel(actionId: string): string {
  return ACTIONS.find((item) => item.id === actionId)?.label ?? "左键单击";
}

export function createThemeDraft(themeId: string | null | undefined): WorkbenchThemeDraft {
  const actionConfigs = getDefaultActionConfigs(themeId);
  return {
    actionConfigs,
    resetActionConfigs: getDefaultActionConfigs(themeId),
    cursorBindings: createCursorBindings(CURSOR_STATES.map((item) => item.id)),
    cursorSkin: createCursorSkin(),
    keyFeedbackConfig: { ...defaultKeyFeedbackConfig },
    resetKeyFeedbackConfig: { ...defaultKeyFeedbackConfig },
    atmosphere: createDefaultAtmosphereConfig(),
  };
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
  mergeActionConfig,
  pickStoredWorkbenchActionConfigs,
};
