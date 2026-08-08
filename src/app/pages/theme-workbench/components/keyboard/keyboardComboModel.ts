import type { KeyFeedbackConfig } from "@/shared/config/key-feedback";

export function formatKeyboardComboStatus(
  config: Pick<KeyFeedbackConfig, "typingCombo" | "comboGain" | "comboScale" | "comboOpacity" | "comboGlow">,
  level: number,
): string {
  if (!config.typingCombo) return "已关闭";
  const normalizedLevel = Math.max(0, Math.min(5, Math.trunc(level)));
  if (normalizedLevel === 0) return "未在连打";

  const hasTarget = config.comboScale || config.comboOpacity || config.comboGlow;
  if (!hasTarget) return `${normalizedLevel} 级 · 没有作用目标`;
  if (config.comboGain === 0) return `${normalizedLevel} 级 · 强度为 0`;

  const gain = config.comboGain / 100;
  const effects: string[] = [];
  if (config.comboScale) effects.push(`字号 +${(normalizedLevel * 3.5 * gain).toFixed(1)}%`);
  if (config.comboOpacity) effects.push(`不透明度 +${Math.round(normalizedLevel * 2 * gain)}`);
  if (config.comboGlow && normalizedLevel >= 3) effects.push("发光");
  if (effects.length === 0) return `${normalizedLevel} 级 · 发光将在 3 级点亮`;
  return `${normalizedLevel} 级 · ${effects.join(" · ")}`;
}
