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

type ThemeTone = "amber" | "teal" | "sky" | "rose" | "slate";

export interface ThemeToneClasses {
  readonly chip: string;
  readonly icon: string;
  readonly border: string;
}

const THEME_TONE_CLASSES: Readonly<Record<ThemeTone, ThemeToneClasses>> = {
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

const FALLBACK_TONE: ThemeTone = "teal";

function isThemeTone(value: string): value is ThemeTone {
  return value in THEME_TONE_CLASSES;
}

export function toneClasses(tone: string | undefined | null): ThemeToneClasses {
  return THEME_TONE_CLASSES[tone && isThemeTone(tone) ? tone : FALLBACK_TONE];
}

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
