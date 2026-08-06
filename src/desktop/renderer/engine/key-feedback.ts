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

type KeySemanticKind = "character" | "shortcut" | "modifier" | "special";

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

function deriveRenderConfig(config: KeyFeedbackConfig, context: KeyRenderContext): KeyFeedbackConfig {
  let next = { ...config };

  if (config.semanticStyles) {
    if (context.kind === "shortcut") {
      next = {
        ...next,
        originMapping: "center",
        globalOffsetX: 0.5,
        globalOffsetY: 0.5,
        fontSize: config.fontSize * 1.18,
        duration: Math.round(config.duration * 0.72),
        opacity: Math.min(100, config.opacity + 8),
      };
    } else if (context.kind === "modifier") {
      next = {
        ...next,
        fontSize: config.fontSize * 0.72,
        duration: Math.round(config.duration * 0.55),
        opacity: Math.max(45, Math.round(config.opacity * 0.72)),
      };
    } else if (context.kind === "special") {
      next = {
        ...next,
        fontSize: config.fontSize * 1.08,
        duration: Math.round(config.duration * 0.82),
        opacity: Math.min(100, config.opacity + 4),
      };
    }
  }

  if (config.typingCombo && context.kind === "character" && context.comboLevel > 0) {
    const boost = Math.min(context.comboLevel, 5);
    next = {
      ...next,
      scale: next.scale * (1 + boost * 0.035),
      opacity: Math.min(100, next.opacity + boost * 2),
      glow: next.glow || boost >= 3,
      glowColor: next.glowColor || next.color,
      glowRadius: Math.max(next.glowRadius, 6 + boost * 2),
    };
  }

  return next;
}

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
    renderKeyFeedback(displayChar, event.keycode, deriveRenderConfig(config, { kind, comboLevel }));
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
    //   raindrop 也尊重 originEdge / originMapping：它表示重力贯穿轨迹，
    //     不等同于固定从顶部居中下落。
    // ────────────────────────────────────────────────────────────
    const style = config.animationStyle;
    const edge = config.originEdge;
    const mapping = config.originMapping;
    const offsetX = config.globalOffsetX;
    const isVertical = edge === "bottom" || edge === "top";
    const layoutNormX = keyLayoutNormalizedX(keycode);

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
    const halfFont = fontSize / 2;
    if (edge === "bottom") {
      startX = mapping === "center" ? screenW * offsetX : screenW * layoutNormX;
      startY = screenH + halfFont;
      dx = 0;
      dy = style === "bounce"
        ? -(config.bounceHeight + screenH * config.globalOffsetY + halfFont)
        : -(screenH + fontSize * 2);
    } else if (edge === "top") {
      startX = mapping === "center" ? screenW * offsetX : screenW * layoutNormX;
      startY = -halfFont;
      dx = 0;
      dy = style === "bounce"
        ? (config.bounceHeight + screenH * config.globalOffsetY + halfFont)
        : (screenH + fontSize * 2);
    } else if (edge === "left") {
      startX = -halfFont;
      // keyLayoutNormalizedX 是 QWERTY 的**横向**位置映射，对纵轴没有语义。
      // 横向入场时 keyboardLayout 回落到 center 行为，而不是硬编码屏幕中线——
      // 否则 globalOffsetY 会被静默忽略。UI 侧在横向入场时如实禁用该映射。
      startY = screenH * config.globalOffsetY;
      dy = 0;
      dx = style === "bounce"
        ? (config.bounceHeight + screenW * offsetX + halfFont)
        : (screenW + fontSize * 2);
    } else {
      // right
      startX = screenW + halfFont;
      startY = screenH * config.globalOffsetY;
      dy = 0;
      dx = style === "bounce"
        ? -(config.bounceHeight + screenW * offsetX + halfFont)
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
    const safeFamilyName = config.fontFamily.replace(/[;'"\n\r]/g, "").slice(0, 80);
    const family = FONT_FAMILY_COMPATIBILITY[config.fontFamily] ?? `${safeFamilyName || "system-ui"}, system-ui, sans-serif`;
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

    // 动画
    state.activeEffects += 1;
    state.activeKeyEffects! += 1;
    (doc.getElementById("cursordance-root") ?? doc.documentElement).append(el);

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
