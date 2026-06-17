// CursorDance 键盘动效配置类型
//
// 字段与 Flutter 版 key_feedback_config.dart 对齐，保证跨平台配置文件兼容。
// trail / splash 字段 schema 保留但不实现不暴露 UI。

export interface KeyFeedbackConfig {
  // ── 总开关 ──
  enabled: boolean;
  // ── 动画形式 ──
  animationStyle: "bounce" | "raindrop";
  // ── 弹出位置 ──
  originEdge: "bottom" | "top" | "left" | "right";
  originMapping: "keyboardLayout" | "center";
  globalOffsetX: number;
  globalOffsetY: number;
  // ── 字符样式 ──
  fontSize: number;
  fontWeight: string;
  fontFamily: string;
  color: string;
  opacity: number;
  uppercase: boolean;
  showModifierKeys: boolean;
  keyDisplayMode: "typed" | "physical";
  // ── 动画参数 ──
  duration: number;
  easing: string;
  scale: number;
  bounceHeight: number;
  gravity: number;
  wind: number;
  // ── 特效增强 ──
  glow: boolean;
  glowColor: string;
  glowRadius: number;
  trail: boolean;
  trailLength: number;
  splash: boolean;
  // ── 高级 ──
  cooldownMs: number;
  maxSimultaneous: number;
  delay: number;
}

export const defaultKeyFeedbackConfig: KeyFeedbackConfig = {
  enabled: true,
  animationStyle: "bounce",
  originEdge: "bottom",
  originMapping: "keyboardLayout",
  globalOffsetX: 0.5,
  globalOffsetY: 0.08,
  fontSize: 48,
  fontWeight: "加粗",
  fontFamily: "系统默认",
  color: "#F59E0B",
  opacity: 90,
  uppercase: false,
  showModifierKeys: true,
  keyDisplayMode: "typed",
  duration: 900,
  easing: "弹跳",
  scale: 1.0,
  bounceHeight: 140,
  gravity: 0.3,
  wind: 0.0,
  glow: false,
  glowColor: "#FBBF24",
  glowRadius: 8.0,
  trail: false,
  trailLength: 3,
  splash: false,
  cooldownMs: 35,
  maxSimultaneous: 30,
  delay: 0,
};

/** 将部分字段覆盖到 defaultKeyFeedbackConfig 上，缺失字段用默认值填充。 */
export function normalizeKeyFeedbackConfig(
  partial: Partial<KeyFeedbackConfig> | undefined,
): KeyFeedbackConfig {
  if (!partial) return { ...defaultKeyFeedbackConfig };
  return { ...defaultKeyFeedbackConfig, ...partial };
}
