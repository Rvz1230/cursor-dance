import type { KeyFeedbackConfig as DomainKeyFeedbackConfig } from "../domain/cursor-dance";

// CursorDance 键盘动效配置类型
//
// 字段是桌面工作台、配置存储与 overlay 运行时的唯一键盘动效模型。

export type KeyFeedbackConfig = DomainKeyFeedbackConfig;

export const defaultKeyFeedbackConfig: KeyFeedbackConfig = {
  enabled: true,
  animationStyle: "bounce",
  anchor: "screen",
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
  semShortcut: 1,
  semModifier: 1,
  semSpecial: 1,
  typingCombo: true,
  comboGain: 100,
  comboScale: true,
  comboOpacity: true,
  comboGlow: true,
  duration: 900,
  easing: "弹跳",
  scale: 1.0,
  bounceHeight: 140,
  gravity: 0.3,
  wind: 0.0,
  glow: false,
  glowColor: "#FBBF24",
  glowRadius: 8.0,
  colorMode: "solid",
  hueSpread: 140,
  gradient: false,
  gradientTo: "#F43F5E",
  trail: false,
  trailLength: 3,
  exitStyle: "fade",
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
  const anchor = source.anchor === "screen" || source.anchor === "window" || source.anchor === "caret" ? source.anchor : defaultKeyFeedbackConfig.anchor;
  const originEdge = source.originEdge === "bottom" || source.originEdge === "top" || source.originEdge === "left" || source.originEdge === "right" ? source.originEdge : defaultKeyFeedbackConfig.originEdge;
  const originMapping = source.originMapping === "keyboardLayout" || source.originMapping === "center" || source.originMapping === "typewriter" ? source.originMapping : defaultKeyFeedbackConfig.originMapping;
  const keyDisplayMode = source.keyDisplayMode === "typed" || source.keyDisplayMode === "physical" ? source.keyDisplayMode : defaultKeyFeedbackConfig.keyDisplayMode;
  const colorMode = source.colorMode === "solid" || source.colorMode === "byKey" || source.colorMode === "byRhythm" || source.colorMode === "bySemantic" ? source.colorMode : defaultKeyFeedbackConfig.colorMode;
  const exitStyle = source.exitStyle === "fade" || source.exitStyle === "shrink" || source.exitStyle === "rise" || source.exitStyle === "blur" ? source.exitStyle : defaultKeyFeedbackConfig.exitStyle;

  return {
    ...defaultKeyFeedbackConfig,
    ...source,
    enabled: typeof source.enabled === "boolean" ? source.enabled : defaultKeyFeedbackConfig.enabled,
    animationStyle,
    anchor,
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
    semShortcut: Number.isFinite(source.semShortcut) ? source.semShortcut as number : defaultKeyFeedbackConfig.semShortcut,
    semModifier: Number.isFinite(source.semModifier) ? source.semModifier as number : defaultKeyFeedbackConfig.semModifier,
    semSpecial: Number.isFinite(source.semSpecial) ? source.semSpecial as number : defaultKeyFeedbackConfig.semSpecial,
    typingCombo: typeof source.typingCombo === "boolean" ? source.typingCombo : defaultKeyFeedbackConfig.typingCombo,
    comboGain: Number.isFinite(source.comboGain) ? source.comboGain as number : defaultKeyFeedbackConfig.comboGain,
    comboScale: typeof source.comboScale === "boolean" ? source.comboScale : defaultKeyFeedbackConfig.comboScale,
    comboOpacity: typeof source.comboOpacity === "boolean" ? source.comboOpacity : defaultKeyFeedbackConfig.comboOpacity,
    comboGlow: typeof source.comboGlow === "boolean" ? source.comboGlow : defaultKeyFeedbackConfig.comboGlow,
    duration: Number.isFinite(source.duration) ? source.duration as number : defaultKeyFeedbackConfig.duration,
    scale: Number.isFinite(source.scale) ? source.scale as number : defaultKeyFeedbackConfig.scale,
    bounceHeight: Number.isFinite(source.bounceHeight) ? source.bounceHeight as number : defaultKeyFeedbackConfig.bounceHeight,
    gravity: Number.isFinite(source.gravity) ? source.gravity as number : defaultKeyFeedbackConfig.gravity,
    wind: Number.isFinite(source.wind) ? source.wind as number : defaultKeyFeedbackConfig.wind,
    glow: typeof source.glow === "boolean" ? source.glow : defaultKeyFeedbackConfig.glow,
    glowColor: typeof source.glowColor === "string" ? source.glowColor : defaultKeyFeedbackConfig.glowColor,
    glowRadius: Number.isFinite(source.glowRadius) ? source.glowRadius as number : defaultKeyFeedbackConfig.glowRadius,
    colorMode,
    hueSpread: Number.isFinite(source.hueSpread) ? source.hueSpread as number : defaultKeyFeedbackConfig.hueSpread,
    gradient: typeof source.gradient === "boolean" ? source.gradient : defaultKeyFeedbackConfig.gradient,
    gradientTo: typeof source.gradientTo === "string" ? source.gradientTo : defaultKeyFeedbackConfig.gradientTo,
    trail: typeof source.trail === "boolean" ? source.trail : defaultKeyFeedbackConfig.trail,
    trailLength: Number.isFinite(source.trailLength) ? source.trailLength as number : defaultKeyFeedbackConfig.trailLength,
    exitStyle,
    splash: typeof source.splash === "boolean" ? source.splash : defaultKeyFeedbackConfig.splash,
    cooldownMs: Number.isFinite(source.cooldownMs) ? source.cooldownMs as number : defaultKeyFeedbackConfig.cooldownMs,
    maxSimultaneous: Number.isFinite(source.maxSimultaneous) ? source.maxSimultaneous as number : defaultKeyFeedbackConfig.maxSimultaneous,
    delay: Number.isFinite(source.delay) ? source.delay as number : defaultKeyFeedbackConfig.delay,
  };
}
