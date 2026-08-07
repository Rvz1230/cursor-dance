/** @platform shared — 主题身份的展示层常量（色调 class 与图标集）。 */

import {
  Cloud,
  Coffee,
  Cookie,
  Crown,
  Feather,
  Flame,
  Gamepad2,
  Gem,
  Globe,
  Heart,
  Moon,
  MousePointer2,
  Music,
  Palette,
  Rainbow,
  Sparkles,
  Star,
  Sun,
  Wand2,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface ThemeIconOption {
  readonly name: string;
  readonly Icon: LucideIcon;
}

export const ICON_OPTIONS: ReadonlyArray<ThemeIconOption> = [
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

/** 主题图标名 → 组件；未命名或未知图标回落到 Wand2。 */
export function resolveThemeIcon(iconName: string | undefined | null): LucideIcon {
  if (!iconName) return Wand2;
  return ICON_OPTIONS.find((option) => option.name === iconName)?.Icon ?? Wand2;
}

export const EFFECT_TYPE_TONES = {
  trigger: { name: "触发", tone: "slate" },
  text: { name: "飘字", tone: "amber" },
  particle: { name: "粒子", tone: "sky" },
  ripple: { name: "波纹", tone: "teal" },
  audio: { name: "音效", tone: "rose" },
  animation: { name: "动画", tone: "indigo" },
  image: { name: "贴纸", tone: "orange" },
  cursor: { name: "光标反馈", tone: "slate" },
} as const;

const EFFECT_TONE_CHIPS = {
  slate: "bg-slate-100 text-slate-600",
  amber: "bg-amber-50 text-amber-700",
  sky: "bg-sky-50 text-sky-700",
  teal: "bg-teal-50 text-teal-700",
  rose: "bg-rose-50 text-rose-700",
  indigo: "bg-indigo-50 text-indigo-700",
  orange: "bg-orange-50 text-orange-700",
} as const;

export function effectToneByName(name: string) {
  const tone = Object.values(EFFECT_TYPE_TONES).find((item) => item.name === name)?.tone ?? "slate";
  return EFFECT_TONE_CHIPS[tone];
}
