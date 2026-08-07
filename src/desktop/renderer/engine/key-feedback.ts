// CursorDance 键盘动效渲染模块
//
// 用户按下任意键时，在 overlay 上渲染一个带动画的字符。
// 两种风格：弹跳 (bounce) 和雨滴 (raindrop)。
// 动画使用 Web Animations API (Element.animate)，与现有 visual-effects 模式一致。

import type { EngineDeps, KeyFeedbackModule, NativeKeyboardEvent } from "./types";
import type { KeyFeedbackConfig } from "@/shared/config/key-feedback";
import { normalizeKeyFeedbackConfig } from "@/shared/config/key-feedback";
import { keyLayoutNormalizedX, keyDisplayLabel, isModifierKeycode, isSpecialKeycode } from "./key-layout-map";
import { hexToRgba, getAnimationEasing } from "./action-config";
import {
  deriveKeyFeedbackConfig,
  resolveKeyFeedbackColor,
  type KeySemanticKind,
} from "@/shared/effect-core/key-feedback-style";

const FONT_WEIGHT_MAP: Record<string, number> = {
  "特细": 100, "细体": 200, "标准": 400, "中等": 500,
  "半粗": 600, "加粗": 700, "特粗": 900,
};

// 兼容已有配置的展示名；其余字体名可直接作为 CSS font-family，并追加系统回退。
const FONT_FAMILY_COMPATIBILITY: Record<string, string> = {
  "系统默认": "system-ui, -apple-system, sans-serif",
  "SF Mono": '"SF Mono", Menlo, Monaco, monospace',
  "SF Pro Rounded": '"SF Pro Rounded", system-ui, sans-serif',
  "Helvetica Neue": '"Helvetica Neue", Helvetica, Arial, sans-serif',
};

interface KeyRenderContext {
  kind: KeySemanticKind;
  comboLevel: number;
}

const COMBO_WINDOW_MS = 260;

function getSemanticKind(event: NativeKeyboardEvent): KeySemanticKind {
  if (isModifierKeycode(event.keycode)) return "modifier";
  if (event.metaKey || event.ctrlKey || event.altKey) return "shortcut";
  if (isSpecialKeycode(event.keycode)) return "special";
  return "character";
}

function getComboLevel(state: EngineDeps["state"], now: number): number {
  const previous = state.keyFeedbackCombo;
  const count = previous && now - previous.lastAt <= COMBO_WINDOW_MS
    ? Math.min(previous.count + 1, 8)
    : 1;
  state.keyFeedbackCombo = { count, lastAt: now };
  return Math.max(0, count - 1);
}

function resetCombo(state: EngineDeps["state"]): void {
  state.keyFeedbackCombo = undefined;
}

export function createKeyFeedback(deps: EngineDeps): KeyFeedbackModule {
  const { window: win, document: doc, state, configStore } = deps;
  let typewriterRun = { x: 0, lastAt: 0 };

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
    const label = keyDisplayLabel(event, {
      showModifierKeys: config.showModifierKeys,
      keyDisplayMode: config.keyDisplayMode,
    });
    if (label === null) return;
    const displayChar = config.uppercase ? label.toUpperCase() : label;

    // 全局效果预算守卫
    if (state.activeEffects >= configStore.getMaxActiveEffects()) return;

    const kind = getSemanticKind(event);
    const comboLevel = config.typingCombo && kind === "character" ? getComboLevel(state, now) : 0;
    if (kind !== "character") resetCombo(state);
    const context = { kind, comboLevel };
    renderKeyFeedback(displayChar, event.keycode, deriveKeyFeedbackConfig(config, context), context);
  }

  function renderKeyFeedback(
    character: string,
    keycode: number,
    config: KeyFeedbackConfig,
    context: KeyRenderContext,
  ): void {
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
    //   raindrop 也尊重 originEdge / originMapping：它表示重力贯穿轨迹，
    //     不等同于固定从顶部居中下落。
    // ────────────────────────────────────────────────────────────
    const style = config.animationStyle;
    const edge = config.originEdge;
    const mapping = config.originMapping;
    const offsetX = config.globalOffsetX;
    const isVertical = edge === "bottom" || edge === "top";
    const layoutNormX = keyLayoutNormalizedX(keycode);
    const screenAnchor = { x: 0, y: 0, width: screenW, height: screenH };
    const activeBounds = config.anchor === "window" ? deps.getActiveWindowBounds?.() : null;
    const windowAnchor = activeBounds ? {
      x: Math.max(0, activeBounds.x - (win.screenX || 0)),
      y: Math.max(0, activeBounds.y - (win.screenY || 0)),
      width: Math.min(screenW, activeBounds.x - (win.screenX || 0) + activeBounds.width) - Math.max(0, activeBounds.x - (win.screenX || 0)),
      height: Math.min(screenH, activeBounds.y - (win.screenY || 0) + activeBounds.height) - Math.max(0, activeBounds.y - (win.screenY || 0)),
    } : null;
    const anchor = windowAnchor && windowAnchor.width > 0 && windowAnchor.height > 0 ? windowAnchor : screenAnchor;
    if (config.anchor !== "screen" && anchor === screenAnchor) {
      deps.diagnostics?.log("keyboard.anchor-fallback", {
        requested: config.anchor,
        reason: config.anchor === "caret" ? "caret-unavailable" : "window-bounds-unavailable",
      });
    }

    const halfFont = fontSize / 2;
    let mappedX = anchor.x + anchor.width * (mapping === "center" ? offsetX : layoutNormX);
    if (mapping === "typewriter" && isVertical) {
      const now = Date.now();
      const advance = fontSize * 0.62;
      if (now - typewriterRun.lastAt > 1200 || typewriterRun.x + advance > anchor.width * 0.88) {
        typewriterRun = { x: 0, lastAt: now };
      }
      mappedX = anchor.x + anchor.width * 0.06 + typewriterRun.x + halfFont;
      typewriterRun = { x: typewriterRun.x + advance, lastAt: now };
    }

    // 起点（DOM left/top 锚点，屏幕外刚好藏住字符）
    let startX: number;
    let startY: number;

    // 位移向量（keyframes translateX/Y 的目标值，代表"飞向哪里多远"）
    let dx: number;
    let dy: number;

    // 元素中心锚 = top/left。line-height:1 时元素高度 ≈ fontSize；
    // 要让整字"刚好藏在屏外"——最近边贴屏边——center 须再外推 fontSize/2。
    // bounce 终点 = 距入场边 (bounceHeight + screenDim * globalOffset⊥)；
    // dy/dx 必须把 fontSize/2 也补偿掉，否则低 bounceHeight 时字根本进不来。
    if (edge === "bottom") {
      startX = mappedX;
      startY = anchor.y + anchor.height + halfFont;
      dx = 0;
      dy = style === "bounce"
        ? -(config.bounceHeight + anchor.height * config.globalOffsetY + halfFont)
        : -(anchor.height + fontSize * 2);
    } else if (edge === "top") {
      startX = mappedX;
      startY = anchor.y - halfFont;
      dx = 0;
      dy = style === "bounce"
        ? (config.bounceHeight + anchor.height * config.globalOffsetY + halfFont)
        : (anchor.height + fontSize * 2);
    } else if (edge === "left") {
      startX = anchor.x - halfFont;
      // keyLayoutNormalizedX 是 QWERTY 的**横向**位置映射，对纵轴没有语义。
      // 横向入场时 keyboardLayout 回落到 center 行为，而不是硬编码屏幕中线——
      // 否则 globalOffsetY 会被静默忽略。UI 侧在横向入场时如实禁用该映射。
      startY = anchor.y + anchor.height * config.globalOffsetY;
      dy = 0;
      dx = style === "bounce"
        ? (config.bounceHeight + anchor.width * offsetX + halfFont)
        : (anchor.width + fontSize * 2);
    } else {
      // right
      startX = anchor.x + anchor.width + halfFont;
      startY = anchor.y + anchor.height * config.globalOffsetY;
      dy = 0;
      dx = style === "bounce"
        ? -(config.bounceHeight + anchor.width * offsetX + halfFont)
        : -(anchor.width + fontSize * 2);
    }

    // 抖动：在入场轴上加 ±20px 的随机偏移，避免连按完全重叠
    const jitter = mapping === "typewriter" ? 0 : Math.random() * 40 - 20;
    if (isVertical) dy += dy >= 0 ? jitter : -jitter;
    else dx += dx >= 0 ? jitter : -jitter;

    // 字体样式
    const weight = FONT_WEIGHT_MAP[config.fontWeight] ?? 700;
    const safeFamilyName = config.fontFamily.replace(/[;'"\n\r]/g, "").slice(0, 80);
    const family = FONT_FAMILY_COMPATIBILITY[config.fontFamily] ?? `${safeFamilyName || "system-ui"}, system-ui, sans-serif`;
    const paint = resolveKeyFeedbackColor(config, {
      layoutX: layoutNormX,
      kind: context.kind,
      comboLevel: context.comboLevel,
    });

    function createGlyph(opacityFactor = 1): HTMLElement {
      const glyph = doc.createElement("div");
      glyph.className = "cd-effect cd-key-feedback";
      glyph.textContent = character;
      glyph.style.cssText = [
        "position:absolute",
        `left:${startX}px`,
        `top:${startY}px`,
        "transform:translate(-50%,-50%)",
        `font-size:${fontSize}px`,
        `font-weight:${weight}`,
        `font-family:${family}`,
        `color:${hexToRgba(paint, config.opacity / 100)}`,
        `opacity:${opacityFactor}`,
        "pointer-events:none",
        "user-select:none",
        "will-change:transform,opacity,filter",
        "line-height:1",
      ].join(";");
      if (config.gradient) {
        glyph.style.backgroundImage = `linear-gradient(180deg, ${paint}, ${config.gradientTo})`;
        glyph.style.backgroundClip = "text";
        glyph.style.webkitBackgroundClip = "text";
        glyph.style.color = "transparent";
      }
      if (config.glow) {
        const glowAlpha = Math.min(config.opacity / 100, 0.8);
        const glowColor = hexToRgba(config.glowColor, glowAlpha);
        if (config.gradient) glyph.style.filter = `drop-shadow(0 0 ${config.glowRadius}px ${glowColor})`;
        else glyph.style.textShadow = `0 0 ${config.glowRadius}px ${glowColor}`;
      }
      return glyph;
    }
    const el = createGlyph();

    // 构建 keyframes
    //
    // 选中的缓动只作用在**入场段**（第一个 keyframe），动画级 easing 必须是 linear。
    // 原因：像「弹跳」这样的过冲曲线 (cubic-bezier(0.34,1.56,0.64,1)) 输出会超过 1，
    // 当它是动画级 timing function 时，整条时间轴的进度会在中途冲过末帧——
    // 而末帧 opacity 是 0，于是字符在过冲窗口里整段不可见。
    // 实测（默认配置、bounce）：easing 留在动画级时可见时长只占 29.8%，
    // 改成 linear + 入场段带曲线后是 86.5%。
    // linear 让 keyframe 的 offset 与真实时间一一对应，可见性由 keyframes 自己说清楚。
    const entranceEasing = getAnimationEasing(config.easing);
    const targetOpacity = config.opacity / 100;
    let keyframes: Keyframe[];

    if (style === "raindrop") {
      // raindrop: 沿入场轴贯穿屏幕；gravity 加速入场轴，wind 偏移垂直于入场轴。
      const gravityBoost = config.gravity * 0.5;
      const windDist = (isVertical ? screenW : screenH) * 0.3 * config.wind;
      const finalDx = dx * (1 + gravityBoost) + (isVertical ? windDist : 0);
      const finalDy = dy * (1 + gravityBoost) + (isVertical ? 0 : windDist);
      const midDx = dx * 0.5 + (isVertical ? windDist * 0.3 : 0);
      const midDy = dy * 0.5 + (isVertical ? 0 : windDist * 0.3);
      keyframes = [
        { opacity: 0, transform: `translate(-50%,-50%) translate(0,0)`, easing: entranceEasing },
        { opacity: targetOpacity, transform: `translate(-50%,-50%) translate(${dx * 0.2}px, ${dy * 0.2}px)`, offset: 0.2 },
        { opacity: targetOpacity, transform: `translate(-50%,-50%) translate(${midDx}px, ${midDy}px)`, offset: 0.6 },
        { opacity: 0, transform: `translate(-50%,-50%) translate(${finalDx}px, ${finalDy}px)` },
      ];
    } else {
      // bounce: 物理键帽手感 —— 入场过冲 → 反弹 → 小过冲 → 收敛 → 淡出
      // 每段 keyframe 用独立 easing，模拟阻尼弹簧
      const ease = "cubic-bezier(0.4, 0, 0.2, 1)";
      keyframes = [
        { opacity: 0, transform: `translate(-50%,-50%) translate(0,0) scale(0.4)`, easing: entranceEasing },
        { opacity: targetOpacity, transform: `translate(-50%,-50%) translate(${dx * 0.12}px, ${dy * 0.12}px) scale(0.82)`, offset: 0.12, easing: ease },
        { opacity: targetOpacity, transform: `translate(-50%,-50%) translate(${dx * 1.06}px, ${dy * 1.06}px) scale(1.18)`, offset: 0.42, easing: ease },
        { transform: `translate(-50%,-50%) translate(${dx * 0.94}px, ${dy * 0.94}px) scale(0.96)`, offset: 0.6, easing: ease },
        { transform: `translate(-50%,-50%) translate(${dx * 1.02}px, ${dy * 1.02}px) scale(1.04)`, offset: 0.74, easing: ease },
        { opacity: targetOpacity, transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(1.0)`, offset: 0.85, easing: ease },
        { opacity: 0, transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(1.0)` },
      ];
    }

    const lastFrame = { ...keyframes[keyframes.length - 1] };
    const lastTransform = String(lastFrame.transform || "");
    if (config.exitStyle === "shrink") {
      lastFrame.transform = /scale\([^)]*\)/.test(lastTransform)
        ? lastTransform.replace(/scale\([^)]*\)/, "scale(0.35)")
        : `${lastTransform} scale(0.35)`;
    } else if (config.exitStyle === "rise") {
      lastFrame.transform = `${lastTransform} translateY(-${fontSize * 1.1}px)`;
    } else if (config.exitStyle === "blur") {
      lastFrame.filter = `blur(${Math.max(3, fontSize * 0.16)}px)`;
    }
    keyframes[keyframes.length - 1] = lastFrame;

    // 动画
    state.activeEffects += 1;
    state.activeKeyEffects! += 1;
    const root = doc.getElementById("cursordance-root") ?? doc.documentElement;
    if (config.trail && config.trailLength > 0) {
      const trailCount = Math.min(6, Math.max(1, Math.round(config.trailLength)));
      for (let index = trailCount; index >= 1; index -= 1) {
        const opacityFactor = (1 - index / (trailCount + 1)) * 0.7;
        const ghost = createGlyph(opacityFactor);
        ghost.className += " cd-key-feedback-trail";
        root.append(ghost);
        const ghostFrames = keyframes.map((frame) => ({
          ...frame,
          opacity: typeof frame.opacity === "number" ? frame.opacity * opacityFactor : frame.opacity,
        }));
        const ghostAnimation = ghost.animate(ghostFrames, {
          duration,
          easing: "linear",
          delay: startDelay + index * Math.max(24, duration * 0.035),
          fill: "forwards",
        });
        const cleanupGhost = (): void => ghost.remove();
        ghostAnimation.addEventListener("finish", cleanupGhost, { once: true });
        ghostAnimation.addEventListener("cancel", cleanupGhost, { once: true });
      }
    }
    root.append(el);

    const animation = el.animate(keyframes, {
      duration,
      easing: "linear",
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
