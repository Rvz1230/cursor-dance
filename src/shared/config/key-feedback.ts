import type { KeyFeedbackConfig as DomainKeyFeedbackConfig } from "../domain/cursor-dance";

// CursorDance 键盘动效配置类型
//
// 字段与 Flutter 版 key_feedback_config.dart 对齐，保证跨平台配置文件兼容。
// trail / splash 字段 schema 保留但不实现不暴露 UI。

export type KeyFeedbackConfig = DomainKeyFeedbackConfig;

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
  semanticStyles: true,
  typingCombo: true,
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
  const source = partial || {};
  const animationStyle = source.animationStyle === "raindrop" || source.animationStyle === "bounce" ? source.animationStyle : defaultKeyFeedbackConfig.animationStyle;
  const originEdge = source.originEdge === "bottom" || source.originEdge === "top" || source.originEdge === "left" || source.originEdge === "right" ? source.originEdge : defaultKeyFeedbackConfig.originEdge;
  const originMapping = source.originMapping === "keyboardLayout" || source.originMapping === "center" ? source.originMapping : defaultKeyFeedbackConfig.originMapping;
  const keyDisplayMode = source.keyDisplayMode === "typed" || source.keyDisplayMode === "physical" ? source.keyDisplayMode : defaultKeyFeedbackConfig.keyDisplayMode;

  return {
    ...defaultKeyFeedbackConfig,
    ...source,
    enabled: typeof source.enabled === "boolean" ? source.enabled : defaultKeyFeedbackConfig.enabled,
    animationStyle,
    originEdge,
    originMapping,
    keyDisplayMode,
    globalOffsetX: Number.isFinite(source.globalOffsetX) ? source.globalOffsetX as number : defaultKeyFeedbackConfig.globalOffsetX,
    globalOffsetY: Number.isFinite(source.globalOffsetY) ? source.globalOffsetY as number : defaultKeyFeedbackConfig.globalOffsetY,
    fontSize: Number.isFinite(source.fontSize) ? source.fontSize as number : defaultKeyFeedbackConfig.fontSize,
    color: typeof source.color === "string" ? source.color : defaultKeyFeedbackConfig.color,
    opacity: Number.isFinite(source.opacity) ? source.opacity as number : defaultKeyFeedbackConfig.opacity,
    uppercase: typeof source.uppercase === "boolean" ? source.uppercase : defaultKeyFeedbackConfig.uppercase,
    showModifierKeys: typeof source.showModifierKeys === "boolean" ? source.showModifierKeys : defaultKeyFeedbackConfig.showModifierKeys,
    semanticStyles: typeof source.semanticStyles === "boolean" ? source.semanticStyles : defaultKeyFeedbackConfig.semanticStyles,
    typingCombo: typeof source.typingCombo === "boolean" ? source.typingCombo : defaultKeyFeedbackConfig.typingCombo,
    duration: Number.isFinite(source.duration) ? source.duration as number : defaultKeyFeedbackConfig.duration,
    scale: Number.isFinite(source.scale) ? source.scale as number : defaultKeyFeedbackConfig.scale,
    bounceHeight: Number.isFinite(source.bounceHeight) ? source.bounceHeight as number : defaultKeyFeedbackConfig.bounceHeight,
    gravity: Number.isFinite(source.gravity) ? source.gravity as number : defaultKeyFeedbackConfig.gravity,
    wind: Number.isFinite(source.wind) ? source.wind as number : defaultKeyFeedbackConfig.wind,
    glow: typeof source.glow === "boolean" ? source.glow : defaultKeyFeedbackConfig.glow,
    glowColor: typeof source.glowColor === "string" ? source.glowColor : defaultKeyFeedbackConfig.glowColor,
    glowRadius: Number.isFinite(source.glowRadius) ? source.glowRadius as number : defaultKeyFeedbackConfig.glowRadius,
    trail: typeof source.trail === "boolean" ? source.trail : defaultKeyFeedbackConfig.trail,
    trailLength: Number.isFinite(source.trailLength) ? source.trailLength as number : defaultKeyFeedbackConfig.trailLength,
    splash: typeof source.splash === "boolean" ? source.splash : defaultKeyFeedbackConfig.splash,
    cooldownMs: Number.isFinite(source.cooldownMs) ? source.cooldownMs as number : defaultKeyFeedbackConfig.cooldownMs,
    maxSimultaneous: Number.isFinite(source.maxSimultaneous) ? source.maxSimultaneous as number : defaultKeyFeedbackConfig.maxSimultaneous,
    delay: Number.isFinite(source.delay) ? source.delay as number : defaultKeyFeedbackConfig.delay,
  };
}
