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
import {
  buildKeyFeedbackKeyframes,
  resolveKeyFeedbackMotion,
} from "@/shared/effect-core/key-feedback-motion";

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
    if (!state.pressedKeycodes) state.pressedKeycodes = new Set();
    if (event.type === "keyup") {
      state.pressedKeycodes.delete(event.keycode);
      return;
    }

    const isAutoRepeat = event.repeat ?? state.pressedKeycodes.has(event.keycode);
    state.pressedKeycodes.add(event.keycode);

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
    const comboLevel = config.typingCombo && kind === "character"
      ? isAutoRepeat
        ? Math.max(0, (state.keyFeedbackCombo?.count ?? 1) - 1)
        : getComboLevel(state, now)
      : 0;
    if (kind !== "character" && !isAutoRepeat) resetCombo(state);
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

    let typewriterOffset = 0;
    if (config.originMapping === "typewriter") {
      const now = Date.now();
      const advance = fontSize * 0.62;
      if (now - typewriterRun.lastAt > 1200 || typewriterRun.x + advance > anchor.width * 0.88) {
        typewriterRun = { x: 0, lastAt: now };
      }
      typewriterOffset = typewriterRun.x;
      typewriterRun = { x: typewriterRun.x + advance, lastAt: now };
    }
    const motion = resolveKeyFeedbackMotion({
      config,
      bounds: anchor,
      viewport: { width: screenW, height: screenH },
      fontSize,
      layoutX: layoutNormX,
      typewriterOffset,
      jitter: Math.random() * 40 - 20,
    });
    const { startX, startY } = motion;

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
    const keyframes = buildKeyFeedbackKeyframes({
      config,
      motion,
      viewport: { width: screenW, height: screenH },
      fontSize,
      entranceEasing,
      persistentFilter: config.gradient && config.glow
        ? `drop-shadow(0 0 ${config.glowRadius}px ${hexToRgba(config.glowColor, Math.min(config.opacity / 100, 0.8))})`
        : undefined,
    });

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
