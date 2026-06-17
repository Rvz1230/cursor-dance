// CursorDance 键盘动效渲染模块
//
// 用户按下任意键时，在 overlay 上渲染一个带动画的字符。
// 两种风格：弹跳 (bounce) 和雨滴 (raindrop)。
// 动画使用 Web Animations API (Element.animate)，与现有 visual-effects 模式一致。

import type { EngineDeps, KeyFeedbackModule, NativeKeyboardEvent } from "./types";
import type { KeyFeedbackConfig } from "./key-feedback-types";
import { defaultKeyFeedbackConfig, normalizeKeyFeedbackConfig } from "./key-feedback-types";
import { keyLayoutNormalizedX, keyDisplayCharacter } from "./key-layout-map";
import { hexToRgba, getAnimationEasing, getTextWeightValue } from "./action-config";

const FONT_WEIGHT_MAP: Record<string, number> = {
  "特细": 100, "细体": 200, "标准": 400, "中等": 500,
  "半粗": 600, "加粗": 700, "特粗": 900,
};

const FONT_FAMILY_MAP: Record<string, string> = {
  "系统默认": "system-ui, -apple-system, sans-serif",
  "SF Mono": '"SF Mono", Menlo, Monaco, monospace',
  "SF Pro Rounded": '"SF Pro Rounded", system-ui, sans-serif',
  "Helvetica Neue": '"Helvetica Neue", Helvetica, Arial, sans-serif',
};

export function createKeyFeedback(deps: EngineDeps): KeyFeedbackModule {
  const { window: win, document: doc, state, configStore } = deps;

  function getConfig(): KeyFeedbackConfig {
    const raw = configStore.getKeyFeedbackConfig?.();
    return normalizeKeyFeedbackConfig(raw as Partial<KeyFeedbackConfig> | undefined);
  }

  function handleKeyboardEvent(event: NativeKeyboardEvent): void {
    if (event.type !== "keydown") return;

    const config = getConfig();
    if (!config.enabled) return;

    // Per-keycode 冷却
    const now = Date.now();
    if (!state.lastKeydownAtByKeycode) state.lastKeydownAtByKeycode = new Map();
    const lastAt = state.lastKeydownAtByKeycode.get(event.keycode) ?? 0;
    if (now - lastAt < config.cooldownMs) return;
    state.lastKeydownAtByKeycode.set(event.keycode, now);

    // 并发守卫
    if (!state.activeKeyEffects) state.activeKeyEffects = 0;
    if (state.activeKeyEffects >= config.maxSimultaneous) return;

    // 字符解析
    const char = keyDisplayCharacter(event.keycode);
    if (char === null) return;
    const displayChar = config.uppercase ? char.toUpperCase() : char;

    // 全局效果预算守卫
    if (state.activeEffects >= configStore.getMaxActiveEffects()) return;

    renderKeyFeedback(displayChar, event.keycode, config);
  }

  function renderKeyFeedback(character: string, keycode: number, config: KeyFeedbackConfig): void {
    const screenW = win.innerWidth;
    const screenH = win.innerHeight;
    const fontSize = config.fontSize * config.scale;
    const duration = config.duration;
    const startDelay = config.delay;

    // ────────────────────────────────────────────────────────────
    // 入场几何
    //   originEdge   入场轴 + 入场方向
    //     bottom : 从屏外下方进入，向上飞
    //     top    : 从屏外上方进入，向下落
    //     left   : 从屏外左侧进入，向右飞
    //     right  : 从屏外右侧进入，向左飞
    //   originMapping
    //     keyboardLayout : 入场轴 ⊥ 维度由 QWERTY 键码映射 (vertical 时影响 X)
    //     center         : 入场轴 ⊥ 维度由 globalOffsetX/Y 控制
    //   globalOffsetX / globalOffsetY
    //     vertical 入场时，globalOffsetY 是「最终位置距入场边」距离（屏高比例）
    //     horizontal 入场时，globalOffsetX 是「最终位置距入场边」距离（屏宽比例）
    // ────────────────────────────────────────────────────────────
    const edge = config.originEdge;
    const style = config.animationStyle;
    const isVertical = edge === "bottom" || edge === "top";
    const layoutNormX = keyLayoutNormalizedX(keycode);

    // 起点（DOM left/top 锚点，屏幕外刚好藏住字符）
    let startX: number;
    let startY: number;

    // 位移向量（keyframes translateX/Y 的目标值，代表"飞向哪里多远"）
    let dx: number;
    let dy: number;

    if (edge === "bottom") {
      startX = config.originMapping === "center" ? screenW * config.globalOffsetX : screenW * layoutNormX;
      startY = screenH + fontSize;
      dx = 0;
      // bounce: 飞到距底边 (bounceHeight + offsetMargin)；raindrop: 反向贯穿到顶部外
      dy = style === "bounce"
        ? -(config.bounceHeight + screenH * config.globalOffsetY)
        : -(screenH + fontSize * 2);
    } else if (edge === "top") {
      startX = config.originMapping === "center" ? screenW * config.globalOffsetX : screenW * layoutNormX;
      startY = -fontSize;
      dx = 0;
      dy = style === "bounce"
        ? (config.bounceHeight + screenH * config.globalOffsetY)
        : (screenH + fontSize * 2);
    } else if (edge === "left") {
      startX = -fontSize;
      startY = config.originMapping === "center" ? screenH * config.globalOffsetY : screenH * 0.5;
      dy = 0;
      dx = style === "bounce"
        ? (config.bounceHeight + screenW * config.globalOffsetX)
        : (screenW + fontSize * 2);
    } else {
      // right
      startX = screenW + fontSize;
      startY = config.originMapping === "center" ? screenH * config.globalOffsetY : screenH * 0.5;
      dy = 0;
      dx = style === "bounce"
        ? -(config.bounceHeight + screenW * config.globalOffsetX)
        : -(screenW + fontSize * 2);
    }

    // 抖动：在入场轴上加 ±20px 的随机偏移，避免连按完全重叠
    const jitter = Math.random() * 40 - 20;
    if (isVertical) dy += dy >= 0 ? jitter : -jitter;
    else dx += dx >= 0 ? jitter : -jitter;

    // 创建 DOM 元素
    const el = doc.createElement("div");
    el.className = "cd-effect cd-key-feedback";
    el.textContent = character;

    // 字体样式
    const weight = FONT_WEIGHT_MAP[config.fontWeight] ?? 700;
    const family = FONT_FAMILY_MAP[config.fontFamily] ?? "system-ui, sans-serif";
    el.style.cssText = [
      `position:absolute`,
      `left:${startX}px`,
      `top:${startY}px`,
      `transform:translate(-50%,-50%)`,
      `font-size:${fontSize}px`,
      `font-weight:${weight}`,
      `font-family:${family}`,
      `color:${hexToRgba(config.color, config.opacity / 100)}`,
      `pointer-events:none`,
      `user-select:none`,
      `will-change:transform,opacity`,
      `line-height:1`,
    ].join(";");

    // 发光
    if (config.glow) {
      const glowAlpha = Math.min(config.opacity / 100, 0.8);
      el.style.textShadow = `0 0 ${config.glowRadius}px ${hexToRgba(config.glowColor, glowAlpha)}`;
    }

    // 构建 keyframes
    const easing = getAnimationEasing(config.easing);
    const targetOpacity = config.opacity / 100;
    let keyframes: Keyframe[];

    if (style === "raindrop") {
      // raindrop: 贯穿屏幕。重力把末段加速；wind 在 ⊥ 入场轴方向加横向风
      const gravityBoost = config.gravity * 0.5; // 0~0.5 倍位移再叠加
      const windPerpFactor = isVertical ? config.wind : 0; // 横向风仅在垂直入场时生效（视觉直觉）
      const windDist = (isVertical ? screenW : screenH) * 0.3 * windPerpFactor;
      const finalDx = dx * (1 + gravityBoost) + (isVertical ? windDist : 0);
      const finalDy = dy * (1 + gravityBoost) + (isVertical ? 0 : windDist);
      const midDx = dx * 0.5 + (isVertical ? windDist * 0.3 : 0);
      const midDy = dy * 0.5 + (isVertical ? 0 : windDist * 0.3);
      keyframes = [
        { opacity: 0, transform: `translate(-50%,-50%) translate(0,0)` },
        { opacity: targetOpacity, transform: `translate(-50%,-50%) translate(${dx * 0.2}px, ${dy * 0.2}px)`, offset: 0.2 },
        { opacity: targetOpacity, transform: `translate(-50%,-50%) translate(${midDx}px, ${midDy}px)`, offset: 0.6 },
        { opacity: 0, transform: `translate(-50%,-50%) translate(${finalDx}px, ${finalDy}px)` },
      ];
    } else {
      // bounce: 弹到目标位置 + 缩放回弹
      keyframes = [
        { opacity: 0, transform: `translate(-50%,-50%) translate(0,0) scale(0.3)` },
        { opacity: targetOpacity, transform: `translate(-50%,-50%) translate(${dx * 0.85}px, ${dy * 0.85}px) scale(1.15)`, offset: 0.7 },
        { opacity: 0, transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(1.0)` },
      ];
    }

    // 动画
    state.activeEffects += 1;
    state.activeKeyEffects! += 1;
    (doc.getElementById("cursordance-root") ?? doc.documentElement).append(el);

    const animation = el.animate(keyframes, {
      duration,
      easing,
      delay: startDelay,
      fill: "forwards",
    });

    const cleanup = (): void => {
      el.remove();
      state.activeEffects = Math.max(0, state.activeEffects - 1);
      state.activeKeyEffects = Math.max(0, (state.activeKeyEffects ?? 1) - 1);
    };

    animation.addEventListener("finish", cleanup, { once: true });
    animation.addEventListener("cancel", cleanup, { once: true });
  }

  return { handleKeyboardEvent };
}
