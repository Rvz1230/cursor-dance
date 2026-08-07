import type { KeyFeedbackConfig } from "../config/key-feedback";

export interface KeyFeedbackBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface KeyFeedbackMotion {
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  edge: KeyFeedbackConfig["originEdge"];
  isVertical: boolean;
}

export function resolveKeyFeedbackMotion(input: {
  config: KeyFeedbackConfig;
  bounds: KeyFeedbackBounds;
  viewport: { width: number; height: number };
  fontSize: number;
  layoutX: number;
  typewriterOffset?: number;
  jitter?: number;
}): KeyFeedbackMotion {
  const { config, bounds, fontSize, layoutX } = input;
  const edge = config.anchor === "caret" ? "bottom" : config.originEdge;
  const isVertical = edge === "bottom" || edge === "top";
  const halfFont = fontSize / 2;
  const restDistance = config.bounceHeight;
  const typewriterOffset = input.typewriterOffset ?? 0;
  const spreadX = config.originMapping === "typewriter"
    ? bounds.x + bounds.width * 0.04 + typewriterOffset + halfFont
    : bounds.x + bounds.width * (config.originMapping === "center" ? config.globalOffsetX : layoutX);
  const rainSpanX = bounds.width > 0 ? bounds.width + fontSize * 2 : restDistance + halfFont;
  const rainSpanY = bounds.height > 0 ? bounds.height + fontSize * 2 : restDistance + halfFont;

  let startX: number;
  let startY: number;
  let dx = 0;
  let dy = 0;
  if (edge === "bottom") {
    startX = spreadX;
    startY = bounds.y + bounds.height + halfFont;
    dy = config.animationStyle === "bounce"
      ? -(restDistance + bounds.height * config.globalOffsetY + halfFont)
      : -rainSpanY;
  } else if (edge === "top") {
    startX = spreadX;
    startY = bounds.y - halfFont;
    dy = config.animationStyle === "bounce"
      ? restDistance + bounds.height * config.globalOffsetY + halfFont
      : rainSpanY;
  } else if (edge === "left") {
    startX = bounds.x - halfFont;
    startY = bounds.y + bounds.height * config.globalOffsetY;
    dx = config.animationStyle === "bounce"
      ? restDistance + bounds.width * config.globalOffsetX + halfFont
      : rainSpanX;
  } else {
    startX = bounds.x + bounds.width + halfFont;
    startY = bounds.y + bounds.height * config.globalOffsetY;
    dx = config.animationStyle === "bounce"
      ? -(restDistance + bounds.width * config.globalOffsetX + halfFont)
      : -rainSpanX;
  }

  const jitter = config.anchor === "caret" || config.originMapping === "typewriter"
    ? 0
    : input.jitter ?? 0;
  if (isVertical) dy += dy >= 0 ? jitter : -jitter;
  else dx += dx >= 0 ? jitter : -jitter;
  return { startX, startY, dx, dy, edge, isVertical };
}

export function resolveKeyFeedbackRestPoint(motion: KeyFeedbackMotion, animationStyle: KeyFeedbackConfig["animationStyle"]): { x: number; y: number } {
  if (animationStyle === "raindrop") return { x: motion.startX, y: motion.startY };
  return { x: motion.startX + motion.dx, y: motion.startY + motion.dy };
}

export function buildKeyFeedbackKeyframes(input: {
  config: KeyFeedbackConfig;
  motion: KeyFeedbackMotion;
  viewport: { width: number; height: number };
  fontSize: number;
  entranceEasing: string;
  persistentFilter?: string;
}): Keyframe[] {
  const { config, motion, viewport, fontSize, entranceEasing } = input;
  const { dx, dy, isVertical } = motion;
  const targetOpacity = config.opacity / 100;
  let frames: Keyframe[];
  if (config.animationStyle === "raindrop") {
    const gravityBoost = config.gravity * 0.5;
    const windDistance = (isVertical ? viewport.width : viewport.height) * 0.3 * config.wind;
    const finalDx = dx * (1 + gravityBoost) + (isVertical ? windDistance : 0);
    const finalDy = dy * (1 + gravityBoost) + (isVertical ? 0 : windDistance);
    frames = [
      { opacity: 0, transform: "translate(-50%,-50%) translate(0,0)", easing: entranceEasing },
      { opacity: targetOpacity, transform: `translate(-50%,-50%) translate(${dx * 0.2}px, ${dy * 0.2}px)`, offset: 0.2 },
      { opacity: targetOpacity, transform: `translate(-50%,-50%) translate(${dx * 0.5 + (isVertical ? windDistance * 0.3 : 0)}px, ${dy * 0.5 + (isVertical ? 0 : windDistance * 0.3)}px)`, offset: 0.6 },
      { opacity: 0, transform: `translate(-50%,-50%) translate(${finalDx}px, ${finalDy}px)` },
    ];
  } else {
    const ease = "cubic-bezier(0.4, 0, 0.2, 1)";
    frames = [
      { opacity: 0, transform: "translate(-50%,-50%) translate(0,0) scale(0.4)", easing: entranceEasing },
      { opacity: targetOpacity, transform: `translate(-50%,-50%) translate(${dx * 0.12}px, ${dy * 0.12}px) scale(0.82)`, offset: 0.12, easing: ease },
      { opacity: targetOpacity, transform: `translate(-50%,-50%) translate(${dx * 1.06}px, ${dy * 1.06}px) scale(1.18)`, offset: 0.42, easing: ease },
      { transform: `translate(-50%,-50%) translate(${dx * 0.94}px, ${dy * 0.94}px) scale(0.96)`, offset: 0.6, easing: ease },
      { transform: `translate(-50%,-50%) translate(${dx * 1.02}px, ${dy * 1.02}px) scale(1.04)`, offset: 0.74, easing: ease },
      { opacity: targetOpacity, transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(1)`, offset: 0.85, easing: ease },
      { opacity: 0, transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(1)` },
    ];
  }

  const finalFrame = { ...frames[frames.length - 1] };
  const finalTransform = String(finalFrame.transform || "");
  if (config.exitStyle === "shrink") {
    finalFrame.transform = /scale\([^)]*\)/.test(finalTransform)
      ? finalTransform.replace(/scale\([^)]*\)/, "scale(0.35)")
      : `${finalTransform} scale(0.35)`;
  } else if (config.exitStyle === "rise") {
    finalFrame.transform = `${finalTransform} translateY(-${fontSize * 1.1}px)`;
  } else if (config.exitStyle === "blur") {
    finalFrame.filter = `blur(${Math.max(3, fontSize * 0.16)}px)${input.persistentFilter ? ` ${input.persistentFilter}` : ""}`;
  } else if (input.persistentFilter) {
    finalFrame.filter = input.persistentFilter;
  }
  frames[frames.length - 1] = finalFrame;
  return frames;
}
