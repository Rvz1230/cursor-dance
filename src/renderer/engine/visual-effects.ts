// CursorDance 视觉效果渲染层
//
// 从 public/content-runtime/visual-effects.js 迁移而来（任务 2.1）。
// 保留所有 Element.animate() 调用与关键帧字面量，仅做 ESM 化与 TS 类型补全：
//   - 去掉 IIFE + window.CursorDanceContentModules 注册
//   - 改为 export function createVisualEffects(deps)
//   - helper 不再从 globalThis.CursorDanceConfigHelpers 取，改为静态 import
//   - 不再访问 chrome.* / audio-duck-profile（原文件本就没有这两类引用）
//
// 调用方在桌面端是 src/renderer/overlay 与 Workbench 预览面板；
// 在扩展端继续由 public/content-runtime/visual-effects.js 注册。两份代码必须保持等价。

import type { EngineDeps, VisualEffectsModule } from "./types";
import {
  hexToRgba,
  getAnimationEasing,
  getTextWeightValue,
  getTextFontFamily,
} from "./action-config";
import {
  getTextContent,
  computeRippleLayers,
  computeParticleSpecs,
  computeOrbitalParticleSpecs,
  getParticleShapeStyle,
  getAnimationVisualStyle,
} from "./compute-specs";

type AnimateOptions = number | { duration?: number; easing?: string; delay?: number };

export function createVisualEffects(deps: EngineDeps): VisualEffectsModule {
  const { window, document, constants, state, configStore } = deps;

  const getTextWeight = (config: Record<string, unknown>): number =>
    getTextWeightValue((config?.textWeight as string) || "常规");

  function getActionText(actionConfig: Record<string, unknown>, actionId: string, runIndex: number): string {
    return getTextContent(actionConfig, runIndex, actionId);
  }

  function ensureStyles(): void {
    if (document.getElementById(constants.STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = constants.STYLE_ID;
    style.textContent = `
        #${constants.ROOT_ID} {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 2147483647;
          overflow: hidden;
          contain: layout style paint;
        }
        .cd-effect {
          position: fixed;
          pointer-events: none;
          box-sizing: border-box;
          transform: translate3d(-50%, -50%, 0);
          will-change: transform, opacity;
        }
        .cd-text {
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.92);
          white-space: nowrap;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.14);
        }
        .cd-ripple {
          border-radius: 999px;
        }
        .cd-particle {
          border-radius: 999px;
          box-shadow: 0 6px 14px rgba(15, 23, 42, 0.12);
        }
        .cd-animation-effect,
        .cd-animation-effect::before,
        .cd-animation-effect::after {
          box-sizing: border-box;
        }
        .cd-image-effect img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          user-select: none;
          -webkit-user-drag: none;
          filter: drop-shadow(0 12px 24px rgba(15, 23, 42, 0.16));
        }
        .cd-cursor {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.72);
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.18);
          color: #fff;
          font: 700 13px/1 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: 0.04em;
          backdrop-filter: blur(6px);
        }
        html.${constants.HIDE_CURSOR_CLASS},
        html.${constants.HIDE_CURSOR_CLASS} * {
          cursor: none !important;
        }
        .cd-state-cursor {
          position: fixed;
          top: 0;
          left: 0;
          pointer-events: none;
          will-change: transform;
        }
        .cd-state-cursor img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          user-select: none;
          -webkit-user-drag: none;
        }
      `;
    document.head.append(style);
  }

  function ensureRoot(): HTMLElement {
    let root = document.getElementById(constants.ROOT_ID);
    if (!root) {
      ensureStyles();
      root = document.createElement("div");
      root.id = constants.ROOT_ID;
      document.documentElement.append(root);
    }
    return root;
  }

  function animateNode(node: HTMLElement, keyframes: Keyframe[], options: AnimateOptions): void {
    if (state.activeEffects >= configStore.getMaxActiveEffects()) return;

    const animationOptions = typeof options === "number"
      ? { duration: options, easing: "ease-out", delay: 0 }
      : {
          duration: options?.duration || 0,
          easing: options?.easing || "ease-out",
          delay: options?.delay || 0,
        };

    state.activeEffects += 1;
    ensureRoot().append(node);
    const animation = node.animate(keyframes, {
      duration: animationOptions.duration,
      easing: animationOptions.easing,
      delay: animationOptions.delay,
      fill: "forwards",
    });

    const cleanup = (): void => {
      node.remove();
      state.activeEffects = Math.max(0, state.activeEffects - 1);
    };

    animation.addEventListener("finish", cleanup, { once: true });
    animation.addEventListener("cancel", cleanup, { once: true });
  }

  function getCursorOverrideKind(cursorOverride: unknown): "boost" | "press" | "woodfish" | "pointer" | null {
    if (cursorOverride === "木鱼（增强态）") return "boost";
    if (cursorOverride === "木鱼（按压态）") return "press";
    if (cursorOverride === "木鱼（继承默认）") return "woodfish";
    if (cursorOverride === "切换到 pointer") return "pointer";
    return null;
  }

  function hasCursorOverride(actionConfig: Record<string, unknown>): boolean {
    const cursorFeedbackConfig = configStore.getActionCursorFeedbackConfig(actionConfig);
    return Boolean(getCursorOverrideKind(cursorFeedbackConfig.cursorOverride));
  }

  function renderCursorOverride(x: number, y: number, actionConfig: Record<string, unknown>): void {
    const cursorFeedbackConfig = configStore.getActionCursorFeedbackConfig(actionConfig);
    const cursorKind = getCursorOverrideKind(cursorFeedbackConfig.cursorOverride);
    if (!cursorKind) return;

    if (cursorKind === "pointer") {
      const target = document.body;
      const previousCursor = target.style.cursor;
      target.style.cursor = "pointer";
      window.setTimeout(() => {
        target.style.cursor = previousCursor;
      }, 360);
      return;
    }

    const node = document.createElement("div");
    node.className = "cd-effect cd-cursor";
    const size = (cursorFeedbackConfig.cursorSize as number) || 48;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;

    if (cursorKind === "boost") {
      node.style.background = "radial-gradient(circle at 35% 35%, rgba(253,224,71,0.95), rgba(180,83,9,0.94))";
      node.textContent = "击";
    } else if (cursorKind === "press") {
      node.style.background = "radial-gradient(circle at 35% 35%, rgba(251,191,36,0.92), rgba(146,64,14,0.96))";
      node.textContent = "压";
      node.style.borderRadius = "38% 38% 58% 58% / 42% 42% 56% 56%";
    } else {
      node.style.background = "radial-gradient(circle at 35% 35%, rgba(252,211,77,0.94), rgba(180,83,9,0.92))";
      node.textContent = "咚";
    }

    const shake = Math.max(0, (cursorFeedbackConfig.shake as number) || 0) / 100;
    const driftX = (shake * 18) || 4;
    const driftY = Math.max(8, shake * 26);
    animateNode(
      node,
      [
        { opacity: 0, transform: "translate3d(-50%, -50%, 0) scale(0.86)" },
        { opacity: 1, transform: `translate3d(calc(-50% + ${driftX * 0.18}px), calc(-50% + ${driftY * 0.08}px), 0) scale(1)` },
        { opacity: 0, transform: `translate3d(calc(-50% + ${driftX}px), calc(-50% + ${driftY}px), 0) scale(0.9)` },
      ],
      { duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }

  function renderText(
    x: number,
    y: number,
    actionConfig: Record<string, unknown>,
    actionId: string,
    runIndex: number,
  ): void {
    const textConfig = configStore.getActionTextConfig(actionConfig);
    if (!textConfig.textEnabled) return;

    const content = getActionText(actionConfig, actionId, runIndex);
    if (!content) return;

    const node = document.createElement("div");
    node.className = "cd-effect cd-text";
    node.textContent = content;
    node.style.left = `${x + ((textConfig.textOffsetX as number) || 0)}px`;
    node.style.top = `${y + ((textConfig.textOffsetY as number) || -48)}px`;
    node.style.color = hexToRgba((textConfig.textColor as string) || "#ec4899", ((textConfig.textOpacity as number) || 100) / 100);
    node.style.fontFamily = getTextFontFamily(textConfig.textFontFamily as string | undefined);
    node.style.fontSize = `${(textConfig.fontSize as number) || 22}px`;
    node.style.fontWeight = String(getTextWeight(textConfig));
    node.style.webkitTextStroke = textConfig.textOutlineWidth
      ? `${textConfig.textOutlineWidth}px ${hexToRgba("#ffffff", 0.82)}`
      : "";
    node.style.textShadow = textConfig.textShadow === "清晰"
      ? `0 8px 18px ${hexToRgba((textConfig.textColor as string) || "#ec4899", 0.32)}`
      : textConfig.textShadow === "柔和"
        ? `0 4px 12px ${hexToRgba((textConfig.textColor as string) || "#ec4899", 0.22)}`
        : "none";

    animateNode(
      node,
      [
        { opacity: 0, transform: "translate3d(-50%, -32%, 0) scale(0.92)" },
        { opacity: 1, transform: "translate3d(-50%, -50%, 0) scale(1)" },
        { opacity: 0, transform: "translate3d(-50%, -96%, 0) scale(1.02)" },
      ],
      {
        duration: (textConfig.textDuration as number) || 950,
        easing: getAnimationEasing(textConfig.textEasing as string),
      },
    );
  }

  function renderRipple(x: number, y: number, actionConfig: Record<string, unknown>): void {
    const rippleConfig = configStore.getActionRippleConfig(actionConfig);
    if (!rippleConfig.ripple) return;

    const easing = getAnimationEasing(rippleConfig.rippleEasing as string);
    const lineWidth = (rippleConfig.rippleLineWidth as number) || 2;
    const duration = (rippleConfig.rippleDuration as number) || 820;
    const rippleColor = (rippleConfig.rippleColor as string) || "#34D399";

    const layers = computeRippleLayers(actionConfig);
    if (!layers || !layers.length) return;

    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li];
      const node = document.createElement("div");
      node.className = "cd-effect cd-ripple";
      node.style.left = x + "px";
      node.style.top = y + "px";
      node.style.width = layer.size + "px";
      node.style.height = layer.size + "px";
      node.style.borderRadius = "999px";
      node.style.border = layer.filled ? "none" : lineWidth + "px solid " + hexToRgba(rippleColor, layer.opacity);
      if (layer.filled) {
        node.style.background = "radial-gradient(circle, " + hexToRgba(rippleColor, layer.opacity * 0.34) + " 0%, " + hexToRgba(rippleColor, layer.opacity * 0.16) + " 56%, " + hexToRgba(rippleColor, 0) + " 100%)";
        node.style.boxShadow = "0 0 0 1px " + hexToRgba(rippleColor, layer.opacity * 0.22) + " inset";
      }

      animateNode(
        node,
        [
          { opacity: layer.filled ? layer.opacity * 0.84 : layer.opacity * 0.46, transform: "translate3d(-50%, -50%, 0) scale(" + layer.scaleFrom + ")" },
          { opacity: layer.filled ? layer.opacity * 0.42 : layer.opacity * 0.22, transform: "translate3d(-50%, -50%, 0) scale(" + layer.scaleMid + ")" },
          { opacity: 0, transform: "translate3d(-50%, -50%, 0) scale(" + layer.scaleTo + ")" },
        ],
        {
          duration,
          delay: layer.delay,
          easing,
        },
      );
    }
  }

  function renderAnimationEffect(x: number, y: number, actionConfig: Record<string, unknown>): void {
    const animationConfig = configStore.getActionAnimationConfig(actionConfig);
    if (!animationConfig.animationEnabled) return;

    const node = document.createElement("div");
    const scale = Math.max(0.6, ((animationConfig.animationScale as number) || 100) / 100);
    const opacity = Math.max(0.18, ((animationConfig.animationOpacity as number) || 100) / 100);
    const style = (animationConfig.animationStyle as string) || "聚焦脉冲";
    const duration = (animationConfig.animationDuration as number) || 720;
    const size = Math.round(56 * scale);
    const animColor = (animationConfig.animationColor as string) || "#34D399";
    const glow = animationConfig.animationGlow ? `0 0 18px ${hexToRgba(animColor, 0.24)}` : "";
    void glow; // 与原文件一致：变量保留但未在 keyframes 中使用，避免静默改语义

    node.className = "cd-effect cd-animation-effect";
    node.style.left = `${x + ((animationConfig.animationOffsetX as number) || 0)}px`;
    node.style.top = `${y + ((animationConfig.animationOffsetY as number) || -10)}px`;
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;

    // 来自 compute-specs.ts 的视觉外观（borderRadius / background / clipPath / 阴影 / border）
    const visStyle = getAnimationVisualStyle(actionConfig);
    node.style.borderRadius = visStyle.borderRadius || "";
    node.style.background = visStyle.background || "";
    if (visStyle.clipPath) node.style.clipPath = visStyle.clipPath;
    if (visStyle.boxShadow) node.style.boxShadow = visStyle.boxShadow;
    if (visStyle.border) node.style.border = visStyle.border;

    let keyframes: Keyframe[];
    if (style === "斜切闪片") {
      keyframes = [
        { opacity: 0, transform: "translate3d(-50%, -40%, 0) scale(0.68) rotate(-18deg)" },
        { opacity, transform: "translate3d(-50%, -50%, 0) scale(1) rotate(-6deg)" },
        { opacity: 0, transform: "translate3d(calc(-50% + 18px), calc(-50% - 18px), 0) scale(1.08) rotate(12deg)" },
      ];
    } else if (style === "弹跳徽记") {
      keyframes = [
        { opacity: 0, transform: "translate3d(-50%, -24%, 0) scale(0.52)" },
        { opacity, transform: "translate3d(-50%, -50%, 0) scale(1.04)" },
        { opacity: 0, transform: "translate3d(-50%, -92%, 0) scale(0.88)" },
      ];
    } else if (style === "漩涡旋转") {
      keyframes = [
        { opacity: 0, transform: "translate3d(-50%, -50%, 0) scale(0.38) rotate(0deg)" },
        { opacity, transform: "translate3d(-50%, -50%, 0) scale(1) rotate(180deg)" },
        { opacity: 0, transform: "translate3d(-50%, -80%, 0) scale(0.62) rotate(360deg)" },
      ];
    } else if (style === "星光闪耀") {
      keyframes = [
        { opacity: 0, transform: "translate3d(-50%, -44%, 0) scale(0.32)" },
        { opacity: Math.min(1, opacity * 1.2), transform: "translate3d(-50%, -50%, 0) scale(1.12)" },
        { opacity: 0, transform: "translate3d(-50%, -94%, 0) scale(0.48)" },
      ];
    } else if (style === "轨道环绕") {
      keyframes = [
        { opacity: 0, transform: "translate3d(-50%, -50%, 0) scale(0.28) rotate(0deg)" },
        { opacity, transform: "translate3d(-50%, -50%, 0) scale(1.06) rotate(270deg)" },
        { opacity: 0, transform: "translate3d(-50%, -84%, 0) scale(0.68) rotate(540deg)" },
      ];
    } else if (style === "螺旋上升") {
      keyframes = [
        { opacity: 0, transform: "translate3d(-50%, -38%, 0) scale(0.44) rotate(-20deg)" },
        { opacity, transform: "translate3d(-50%, -50%, 0) scale(1) rotate(8deg)" },
        { opacity: 0, transform: "translate3d(calc(-50% + 10px), calc(-50% - 86%), 0) scale(0.72) rotate(36deg)" },
      ];
    } else {
      keyframes = [
        { opacity: 0, transform: "translate3d(-50%, -50%, 0) scale(0.42)" },
        { opacity, transform: "translate3d(-50%, -50%, 0) scale(0.92)" },
        { opacity: 0, transform: "translate3d(-50%, -50%, 0) scale(1.48)" },
      ];
    }

    animateNode(node, keyframes, {
      duration,
      easing: getAnimationEasing(animationConfig.animationEasing as string),
    });
  }

  function renderImageEffect(x: number, y: number, actionConfig: Record<string, unknown>): void {
    const imageConfig = configStore.getActionImageConfig(actionConfig);
    if (!imageConfig.imageEnabled || !imageConfig.imageDataUrl) return;

    const node = document.createElement("div");
    node.className = "cd-effect cd-image-effect";
    node.style.left = `${x + ((imageConfig.imageOffsetX as number) || 0)}px`;
    node.style.top = `${y + ((imageConfig.imageOffsetY as number) || -18)}px`;
    node.style.width = `${(imageConfig.imageSize as number) || 56}px`;
    node.style.height = `${(imageConfig.imageSize as number) || 56}px`;
    node.style.opacity = String(Math.max(0.2, ((imageConfig.imageOpacity as number) || 100) / 100));

    const image = document.createElement("img");
    image.src = imageConfig.imageDataUrl as string;
    image.alt = "";
    node.append(image);

    animateNode(
      node,
      [
        { opacity: 0, transform: "translate3d(-50%, -30%, 0) scale(0.72) rotate(-8deg)" },
        { opacity: Math.max(0.2, ((imageConfig.imageOpacity as number) || 100) / 100), transform: "translate3d(-50%, -50%, 0) scale(1) rotate(0deg)" },
        { opacity: 0, transform: "translate3d(-50%, -92%, 0) scale(1.06) rotate(4deg)" },
      ],
      {
        duration: (imageConfig.imageDuration as number) || 780,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    );
  }

  function renderParticles(x: number, y: number, actionConfig: Record<string, unknown>, runIndex: number): void {
    const particleConfig = configStore.getActionParticleConfig(actionConfig);
    if (!particleConfig.particle) return;

    const count = Math.min((particleConfig.particleCount as number) || 0, 40);
    if (!count) return;

    const hasTrail = particleConfig.particleTrail;

    const specs = computeParticleSpecs(actionConfig, runIndex);
    if (!specs || !specs.length) return;

    for (let index = 0; index < specs.length; index++) {
      const spec = specs[index];
      let rotation = 0;
      const shapeStyle = getParticleShapeStyle(actionConfig, index, spec.size);
      if (shapeStyle) rotation = shapeStyle.rotation || 0;

      const node = document.createElement("span");
      node.className = "cd-effect cd-particle";
      node.style.left = x + "px";
      node.style.top = y + "px";
      if (shapeStyle) {
        node.style.width = shapeStyle.width + "px";
        node.style.height = shapeStyle.height + "px";
        node.style.borderRadius = shapeStyle.borderRadius || "";
        if (shapeStyle.clipPath) node.style.clipPath = shapeStyle.clipPath;
        if (shapeStyle.boxShadow) node.style.boxShadow = shapeStyle.boxShadow;
      }

      const particleStyle = (particleConfig.particleStyle as string) || "点状粒子";
      const midTransform = "translate3d(calc(-50% + " + spec.midX + "px), calc(-50% + " + spec.midY + "px), 0) rotate(" + rotation + "deg)";
      const endTransform = "translate3d(calc(-50% + " + spec.x + "px), calc(-50% + " + spec.y + "px), 0) rotate(" + rotation + "deg)";

      animateNode(
        node,
        [
          { opacity: 0, transform: "translate3d(-50%, -50%, 0) rotate(" + rotation + "deg) scale(0.5)" },
          { opacity: 0.9, transform: midTransform + " scale(1)" },
          { opacity: 0, transform: endTransform + " scale(" + spec.endScale + ")" },
        ],
        {
          duration: (particleConfig.particleDuration as number) || 760,
          easing: particleStyle === "火花" || particleStyle === "星光"
            ? "cubic-bezier(0.22, 1, 0.36, 1)"
            : particleStyle === "碎屑粒子"
              ? "cubic-bezier(0.34, 1.56, 0.64, 1)"
              : "ease-out",
          delay: spec.delay,
        },
      );

      if (hasTrail && index % 3 === 0) {
        for (let t = 1; t <= 2; t++) {
          const trailNode = document.createElement("span");
          trailNode.className = "cd-effect cd-particle";
          trailNode.style.left = x + "px";
          trailNode.style.top = y + "px";
          const trailSize = spec.size * (1 - t * 0.32);
          const trailShapeStyle = getParticleShapeStyle(actionConfig, index + t, trailSize);
          if (trailShapeStyle) {
            trailNode.style.width = trailShapeStyle.width + "px";
            trailNode.style.height = trailShapeStyle.height + "px";
            trailNode.style.borderRadius = trailShapeStyle.borderRadius || "";
            if (trailShapeStyle.clipPath) trailNode.style.clipPath = trailShapeStyle.clipPath;
            if (trailShapeStyle.boxShadow) trailNode.style.boxShadow = trailShapeStyle.boxShadow;
          }
          const trailTx = spec.x * 0.24;
          const trailTy = spec.y * 0.24;
          const trailTxEnd = spec.x * 0.6;
          const trailTyEnd = spec.y * 0.6;
          trailNode.style.opacity = String(Math.max(0.12, 0.4 - t * 0.14));
          animateNode(
            trailNode,
            [
              { opacity: 0, transform: "translate3d(-50%, -50%, 0) rotate(" + rotation + "deg) scale(0.5)" },
              { opacity: Math.max(0.12, 0.4 - t * 0.14), transform: "translate3d(calc(-50% + " + trailTx + "px), calc(-50% + " + trailTy + "px), 0) rotate(" + rotation + "deg) scale(0.68)" },
              { opacity: 0, transform: "translate3d(calc(-50% + " + trailTxEnd + "px), calc(-50% + " + trailTyEnd + "px), 0) rotate(" + rotation + "deg) scale(0.44)" },
            ],
            { duration: ((particleConfig.particleDuration as number) || 760) * 0.8, easing: "ease-out", delay: spec.delay + t * 40 },
          );
        }
      }
    }
  }

  function renderOrbitalParticles(
    x: number,
    y: number,
    actionConfig: Record<string, unknown>,
    runIndex: number,
  ): void {
    void runIndex; // 原 JS 形参不在轨道粒子算法中使用，保留签名一致
    const particleConfig = configStore.getActionParticleConfig(actionConfig);
    if (!particleConfig.particle) return;

    const orbitalDuration = Math.max(0, ((particleConfig.particleDuration as number) || 760));
    const fadeInDuration = Math.min(400, ((particleConfig.particleDuration as number) || 760) * 0.3);

    const specs = computeOrbitalParticleSpecs(actionConfig);
    if (!specs || !specs.length) return;

    const root = ensureRoot();
    const dots: { dot: HTMLElement; anim: Animation }[] = [];

    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      const dot = document.createElement("span");
      dot.className = "cd-effect cd-particle";
      dot.style.left = x + "px";
      dot.style.top = y + "px";

      const shapeStyle = getParticleShapeStyle(actionConfig, i, spec.size);
      if (shapeStyle) {
        dot.style.width = shapeStyle.width + "px";
        dot.style.height = shapeStyle.height + "px";
        dot.style.borderRadius = shapeStyle.borderRadius || "";
        if (shapeStyle.clipPath) dot.style.clipPath = shapeStyle.clipPath;
        if (shapeStyle.boxShadow) dot.style.boxShadow = shapeStyle.boxShadow;
      }

      const oscFrames: Keyframe[] = [
        { transform: "translate3d(calc(-50% + " + spec.sx + "px), calc(-50% + " + spec.sy + "px), 0) scale(0.6)", opacity: 0.5, offset: 0 },
        { transform: "translate3d(calc(-50% + " + spec.ex + "px), calc(-50% + " + spec.ey + "px), 0) scale(1.2)", opacity: 0.15, offset: 0.5 },
        { transform: "translate3d(calc(-50% + " + spec.sx + "px), calc(-50% + " + spec.sy + "px), 0) scale(0.6)", opacity: 0.5, offset: 1 },
      ];

      const iterations = orbitalDuration > 0 ? Math.ceil(orbitalDuration / (spec.speed * 1000)) : Infinity;
      const anim = dot.animate(oscFrames, {
        duration: spec.speed * 1000,
        iterations,
        delay: spec.delay,
        easing: "ease-in-out",
        fill: orbitalDuration > 0 ? "forwards" : "none",
      });

      // fade in (uses particleDuration for smoothness)
      dot.animate(
        [{ opacity: 0 }, { opacity: 0.9 }],
        { duration: fadeInDuration, easing: "ease-out", fill: "forwards" },
      );

      root.append(dot);
      dots.push({ dot, anim });
    }

    // store for external cleanup (e.g. hover leave)
    state.orbitalGroups = state.orbitalGroups || [];
    state.orbitalGroups.push(dots);
  }

  function clearOrbitalParticles(): void {
    const groups = state.orbitalGroups;
    if (!groups) return;
    state.orbitalGroups = [];
    for (let g = 0; g < groups.length; g++) {
      const group = groups[g];
      for (let d = 0; d < group.length; d++) {
        const item = group[d];
        item.anim.cancel();
        item.dot.remove();
      }
    }
  }

  return {
    ensureRoot,
    renderText,
    renderRipple,
    renderAnimationEffect,
    renderImageEffect,
    renderParticles,
    renderOrbitalParticles,
    clearOrbitalParticles,
    renderCursorOverride,
    hasCursorOverride,
  };
}
