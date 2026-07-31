import {
  getAnimationEasing,
  getTextFontFamily,
  getTextWeightValue,
  hexToRgba,
} from "@/shared/effect-core/action-config";
import {
  computeRippleLayers,
  getAnimationVisualStyle,
  getTextContent,
} from "@/shared/effect-core/compute-specs";
import type { EffectHandle } from "../contracts";
import { combineEffectHandles, emptyEffectHandle } from "../effect-lifecycle";
import type {
  AnimateEffectNode,
  VisualEffectsConfigStore,
} from "./types";

export function createBasicEffectRenderers(deps: {
  document: Document;
  configStore: VisualEffectsConfigStore;
  animateNode: AnimateEffectNode;
}) {
  const { document, configStore, animateNode } = deps;

  const getTextWeight = (config: Record<string, unknown>): number =>
    getTextWeightValue((config?.textWeight as string) || "常规");

  function getActionText(actionConfig: Record<string, unknown>, actionId: string, runIndex: number): string {
    return getTextContent(actionConfig, runIndex, actionId);
  }
  function renderText(
    x: number,
    y: number,
    actionConfig: Record<string, unknown>,
    actionId: string,
    runIndex: number,
  ): EffectHandle {
    const textConfig = configStore.getActionTextConfig(actionConfig);
    if (!textConfig.textEnabled) return emptyEffectHandle;

    const content = getActionText(actionConfig, actionId, runIndex);
    if (!content) return emptyEffectHandle;

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

    return animateNode(
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

  function renderRipple(x: number, y: number, actionConfig: Record<string, unknown>): EffectHandle {
    const rippleConfig = configStore.getActionRippleConfig(actionConfig);
    if (!rippleConfig.ripple) return emptyEffectHandle;

    const easing = getAnimationEasing(rippleConfig.rippleEasing as string);
    const lineWidth = (rippleConfig.rippleLineWidth as number) || 2;
    const duration = (rippleConfig.rippleDuration as number) || 820;
    const rippleColor = (rippleConfig.rippleColor as string) || "#34D399";

    const layers = computeRippleLayers(actionConfig);
    if (!layers || !layers.length) return emptyEffectHandle;

    const handles: EffectHandle[] = [];
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

      handles.push(animateNode(
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
      ));
    }
    return combineEffectHandles(handles);
  }

  function renderAnimationEffect(x: number, y: number, actionConfig: Record<string, unknown>): EffectHandle {
    const animationConfig = configStore.getActionAnimationConfig(actionConfig);
    if (!animationConfig.animationEnabled) return emptyEffectHandle;

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

    return animateNode(node, keyframes, {
      duration,
      easing: getAnimationEasing(animationConfig.animationEasing as string),
    });
  }

  function renderImageEffect(x: number, y: number, actionConfig: Record<string, unknown>): EffectHandle {
    const imageConfig = configStore.getActionImageConfig(actionConfig);
    if (!imageConfig.imageEnabled || !imageConfig.imageDataUrl) return emptyEffectHandle;

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

    return animateNode(
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

  return { renderText, renderRipple, renderAnimationEffect, renderImageEffect };
}
