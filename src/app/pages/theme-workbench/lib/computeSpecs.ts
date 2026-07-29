/**
 * Shared animation parameter computation.
 *
 * Pure functions that compute visual effect parameters from action configs.
 * Used by both the workbench preview (TS import) and the content script runtime
 * (via CursorDanceConfigHelpers IIFE). A parity test in computeSpecs.test.ts
 * ensures both implementations produce identical outputs.
 */

import {
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
  getActionAnimationConfig,
  getOrderedActionTextTags,
} from "../model/actionConfigSchema";

// ─── Utilities ────────────────────────────────────────────────────────

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = (hex || "#F59E0B").replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((item) => item + item)
          .join("")
      : normalized;
  const int = Number.parseInt(value, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getAnimationEasingCss(label: string): string {
  if (label === "线性") return "linear";
  if (label === "缓入") return "cubic-bezier(0.4, 0, 1, 1)";
  if (label === "缓入缓出") return "cubic-bezier(0.4, 0, 0.2, 1)";
  if (label === "弹跳") return "cubic-bezier(0.34, 1.56, 0.64, 1)";
  if (label === "弹性") return "cubic-bezier(0.22, 1, 0.36, 1.18)";
  return "cubic-bezier(0, 0, 0.2, 1)";
}

export function getTextWeightValue(weight: string): number {
  if (weight === "加粗") return 700;
  if (weight === "中等") return 600;
  return 500;
}

export function formatNumber(style: string, number: number): string {
  const safeNumber = Math.max(1, Math.round(number || 3));
  if (style.includes("中文")) {
    const values = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
    return values[(safeNumber - 1) % values.length];
  }
  if (style.includes("英文")) {
    const values = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
    return values[(safeNumber - 1) % values.length];
  }
  return String(safeNumber);
}

// ─── Text content ─────────────────────────────────────────────────────

export function getTextContent(
  config: Record<string, unknown>,
  runIndex = 0,
  actionId = "leftClick",
): string {
  const textConfig = getActionTextConfig(config);
  if (!textConfig.textEnabled) return "静默";

  if (textConfig.textKind === "文本飘字") {
    const tags = getOrderedActionTextTags(textConfig);
    if (!tags.length) return "未设置文本";
    if (textConfig.textTagPlayMode === "随机显示") {
      return tags[(runIndex * 7 + actionId.length) % tags.length];
    }
    return tags[(runIndex - 1) % tags.length];
  }

  const numberValue = textConfig.comboEnabled ? Math.max(1, runIndex || 1) : 1;
  const previewNumber = formatNumber(textConfig.textStyle || "阿拉伯数字 (1, 2, 3)", numberValue);
  if (textConfig.textMode === "模板模式") {
    return (textConfig.textTemplate || "${number}").replaceAll("${number}", previewNumber);
  }

  return `+${previewNumber}`;
}

// ─── Ripple layers ────────────────────────────────────────────────────

export interface RippleLayerSpec {
  size: number;
  opacity: number;
  delay: number;
  filled: boolean;
  scaleFrom: number;
  scaleMid: number;
  scaleTo: number;
}

export function computeRippleLayers(config: Record<string, unknown>): RippleLayerSpec[] {
  const rippleConfig = getActionRippleConfig(config);
  const baseDelay = rippleConfig.rippleDelay || 0;
  const size = rippleConfig.rippleSize;
  const opacity = rippleConfig.rippleOpacity / 100;
  const style = rippleConfig.rippleStyle || "单环";

  if (style === "双环") {
    return [
      { size, opacity, delay: baseDelay, filled: false, scaleFrom: 0.16, scaleMid: 0.62, scaleTo: 0.96 },
      {
        size: size * 1.12,
        opacity: opacity * 0.82,
        delay: baseDelay + Math.min(120, rippleConfig.rippleDuration * 0.12),
        filled: false,
        scaleFrom: 0.28,
        scaleMid: 0.84,
        scaleTo: 1.14,
      },
    ];
  }

  if (style === "柔和面波") {
    return [{ size, opacity, delay: baseDelay, filled: true, scaleFrom: 0.22, scaleMid: 0.7, scaleTo: 1.06 }];
  }

  if (style === "脉冲波纹") {
    return [
      { size, opacity, delay: baseDelay, filled: true, scaleFrom: 0.12, scaleMid: 0.58, scaleTo: 0.98 },
      {
        size: size * 1.24,
        opacity: opacity * 0.52,
        delay: baseDelay + Math.min(180, rippleConfig.rippleDuration * 0.18),
        filled: false,
        scaleFrom: 0.32,
        scaleMid: 0.78,
        scaleTo: 1.2,
      },
      {
        size: size * 1.4,
        opacity: opacity * 0.26,
        delay: baseDelay + Math.min(320, rippleConfig.rippleDuration * 0.36),
        filled: false,
        scaleFrom: 0.48,
        scaleMid: 0.88,
        scaleTo: 1.36,
      },
    ];
  }

  if (style === "回声环") {
    return [
      { size, opacity, delay: baseDelay, filled: false, scaleFrom: 0.16, scaleMid: 0.62, scaleTo: 0.96 },
      {
        size: size * 1.1,
        opacity: opacity * 0.68,
        delay: baseDelay + Math.min(90, rippleConfig.rippleDuration * 0.1),
        filled: false,
        scaleFrom: 0.28,
        scaleMid: 0.72,
        scaleTo: 1.06,
      },
      {
        size: size * 1.22,
        opacity: opacity * 0.44,
        delay: baseDelay + Math.min(180, rippleConfig.rippleDuration * 0.2),
        filled: false,
        scaleFrom: 0.4,
        scaleMid: 0.82,
        scaleTo: 1.18,
      },
      {
        size: size * 1.36,
        opacity: opacity * 0.22,
        delay: baseDelay + Math.min(280, rippleConfig.rippleDuration * 0.3),
        filled: false,
        scaleFrom: 0.52,
        scaleMid: 0.9,
        scaleTo: 1.32,
      },
    ];
  }

  if (style === "能量脉冲") {
    return [
      { size, opacity: opacity * 1.1, delay: baseDelay, filled: true, scaleFrom: 0.1, scaleMid: 0.56, scaleTo: 0.96 },
      {
        size: size * 1.16,
        opacity: opacity * 0.58,
        delay: baseDelay + Math.min(140, rippleConfig.rippleDuration * 0.14),
        filled: false,
        scaleFrom: 0.26,
        scaleMid: 0.74,
        scaleTo: 1.12,
      },
    ];
  }

  // 单环 (default)
  return [{ size, opacity, delay: baseDelay, filled: false, scaleFrom: 0.18, scaleMid: 0.72, scaleTo: 1 }];
}

// ─── Particle physics ─────────────────────────────────────────────────

export interface ParticleSpec {
  x: number;
  y: number;
  midX: number;
  midY: number;
  delay: number;
  size: number;
  endScale: number;
}

export function computeParticleSpecs(config: Record<string, unknown>, runIndex: number): ParticleSpec[] {
  const particleConfig = getActionParticleConfig(config);
  const baseDelay = particleConfig.particleDelay || 0;
  const visibleCount = Math.min(particleConfig.particleCount, 40);
  const spread = Math.max(0, Math.min(particleConfig.particleSpread || 52, 90));

  const direction = particleConfig.particleDirection || "四周扩散";

  const angleOrder = Array.from({ length: visibleCount }, (_, i) => i);
  if (direction !== "旋转扫射") {
    for (let i = angleOrder.length - 1; i > 0; i--) {
      const j = (runIndex * 7 + i * 13) % (i + 1);
      [angleOrder[i], angleOrder[j]] = [angleOrder[j], angleOrder[i]];
    }
  }

  return Array.from({ length: visibleCount }, (_, index) => {
    let startAngle = 0;
    let sweep = Math.PI * 2;

    if (direction === "向上喷发") {
      startAngle = -Math.PI * 0.95;
      sweep = Math.PI * 0.9;
    }

    let angle: number;
    if (direction === "随机散射") {
      angle = ((runIndex * 13 + index * 7 + (index % 5) * 19) % 360) * (Math.PI / 180);
    } else {
      const angleIndex = angleOrder[index];
      angle = startAngle + (visibleCount === 1 ? 0 : (angleIndex / (visibleCount - 1)) * sweep);
    }

    const angleForVariance = direction === "随机散射" ? index : angleOrder[index];
    const variance = ((runIndex + 5) * (angleForVariance + 3)) % 11 - 5;
    const style = particleConfig.particleStyle || "点状粒子";
    const motionScale = style === "火花" ? 1.45 : style === "碎屑粒子" ? 1.2 : 1.0;
    const gravityScale = style === "火花" ? 0.35 : style === "碎屑粒子" ? 1.45 : 1.0;
    const spreadScale = style === "火花" ? 0.7 : style === "碎屑粒子" ? 1.3 : 1.0;
    const staggerScale = style === "火花" ? 0.5 : style === "碎屑粒子" ? 0.75 : 1.0;
    const effectiveSpread = spread * spreadScale;
    const distance = Math.max(16, effectiveSpread * (0.55 + index / Math.max(visibleCount * 1.45, 1)) + variance * 1.8);
    const baseX = Math.cos(angle) * distance * motionScale;
    const baseY = Math.sin(angle) * distance * motionScale;
    const gravity = (particleConfig.particleGravity || 0) / 100;
    const wind = (particleConfig.particleWind || 0) / 100;
    const bounce = (particleConfig.particleBounce || 0) / 100;
    const bounceY = bounce > 0 ? -effectiveSpread * bounce * 1.0 : 0;
    const tx = baseX + wind * effectiveSpread * 1.2;
    const ty = baseY + gravity * gravityScale * effectiveSpread * 1.6;
    return {
      x: tx,
      y: ty,
      midX: tx * 0.35,
      midY: (ty + bounceY) * 0.4,
      delay: baseDelay + index * (particleConfig.particleStagger ?? 26) * staggerScale,
      size: Math.max(4, (particleConfig.particleSize || 10) * (0.52 + (index % 4) * 0.1)),
      endScale: style === "火花" ? 0.35 : style === "碎屑粒子" ? 0.55 : style === "星光" ? 0.38 : 0.65,
    };
  });
}

// ─── Orbital particle specs ───────────────────────────────────────────

export interface OrbitalParticleSpec {
  angle: number;
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  delay: number;
  size: number;
  duration: number;
  speed: number;
}

export function computeOrbitalParticleSpecs(config: Record<string, unknown>): OrbitalParticleSpec[] {
  const particleConfig = getActionParticleConfig(config);
  const count = Math.min(particleConfig.orbitalCount || 6, 16);
  const radius = Math.max(16, Math.min(particleConfig.orbitalRadius || 32, 80));
  const speed = Math.max(1, Math.min(particleConfig.orbitalSpeed || 3, 8));
  const duration = particleConfig.particleDuration || 780;

  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const size = Math.max(4, (particleConfig.particleSize || 10) * (0.5 + (i % 3) * 0.12));
    return {
      angle,
      sx: Math.cos(angle) * 4,
      sy: Math.sin(angle) * 4,
      ex: Math.cos(angle) * radius,
      ey: Math.sin(angle) * radius,
      delay: -(i / count) * speed * 1000,
      size,
      duration,
      speed,
    };
  });
}

// ─── Particle shape / style ───────────────────────────────────────────

export interface ParticleShapeStyle {
  width: number;
  height: number;
  borderRadius: string;
  rotation: number;
  clipPath?: string;
  boxShadow: string;
}

export function getParticleShapeStyle(
  config: Record<string, unknown>,
  index: number,
  size: number,
): ParticleShapeStyle {
  const particleConfig = getActionParticleConfig(config);
  const style = particleConfig.particleStyle || "点状粒子";

  if (style === "火花") {
    const w = size * 1.9;
    const h = Math.max(3, size * 0.42);
    return {
      width: w,
      height: h,
      borderRadius: "999px",
      rotation: -28 + ((index * 17) % 7) * 11,
      boxShadow: [
        `0 0 4px ${hexToRgba("#F59E0B", 0.5)}`,
        `0 0 16px ${hexToRgba("#F59E0B", 0.28)}`,
      ].join(", "),
    };
  }

  if (style === "碎屑粒子") {
    const w = size * (1.2 + (index % 3) * 0.15);
    const h = size * (0.6 + (index % 2) * 0.2);
    return {
      width: w,
      height: h,
      borderRadius: `${20 + (index % 5) * 6}%`,
      rotation: -42 + ((index * 13) % 9) * 10,
      boxShadow: [
        `0 4px 10px ${hexToRgba("#0F172A", 0.12)}`,
        `inset 0 1px 0 ${hexToRgba("#FFFFFF", 0.18)}`,
      ].join(", "),
    };
  }

  if (style === "星光") {
    return {
      width: size * 1.5,
      height: size * 1.5,
      borderRadius: "0",
      rotation: ((index * 23) % 9) * 8,
      clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
      boxShadow: `0 0 10px ${hexToRgba("#FBBF24", 0.38)}`,
    };
  }

  if (style === "钻石") {
    return {
      width: size * 1.2,
      height: size * 1.2,
      borderRadius: "18%",
      rotation: 45 + ((index * 11) % 7) * 5,
      clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
      boxShadow: `0 4px 12px ${hexToRgba("#0F172A", 0.16)}`,
    };
  }

  if (style === "心形") {
    return {
      width: size * 1.4,
      height: size * 1.3,
      borderRadius: "0",
      rotation: -12 + ((index * 9) % 7) * 6,
      clipPath:
        "polygon(50% 15%, 72% 0%, 94% 12%, 94% 38%, 80% 62%, 50% 90%, 20% 62%, 6% 38%, 6% 12%, 28% 0%)",
      boxShadow: `0 3px 10px ${hexToRgba("#EC4899", 0.22)}`,
    };
  }

  if (style === "方块") {
    return {
      width: size * 1.15,
      height: size * 1.15,
      borderRadius: "12%",
      rotation: ((index * 19) % 13) * 7,
      boxShadow: `0 4px 10px ${hexToRgba("#0F172A", 0.14)}`,
    };
  }

  if (style === "三角") {
    return {
      width: size * 1.3,
      height: size * 1.2,
      borderRadius: "0",
      rotation: ((index * 31) % 11) * 16,
      clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
      boxShadow: `0 3px 9px ${hexToRgba("#0F172A", 0.12)}`,
    };
  }

  // 点状粒子 (default)
  return {
    width: size,
    height: size,
    borderRadius: "999px",
    rotation: 0,
    boxShadow: `0 0 0 1px ${hexToRgba("#FFFFFF", 0.4)}`,
  };
}

// ─── Particle color / tint ────────────────────────────────────────────

export function getParticleTint(config: Record<string, unknown>, index: number): string {
  const particleConfig = getActionParticleConfig(config);
  const textConfig = getActionTextConfig(config);
  if (particleConfig.particleColorMode === "跟随飘字色") {
    return hexToRgba(textConfig.textColor, particleConfig.particleOpacity / 100);
  }
  const palette = Array.isArray(particleConfig.particlePalette) && particleConfig.particlePalette.length
    ? particleConfig.particlePalette
    : ["#FDBA74", "#FDE68A", "#86EFAC", "#93C5FD", "#F9A8D4"];
  if (particleConfig.particleColorMode === "随机轻变化") {
    return hexToRgba(palette[index % palette.length], particleConfig.particleOpacity / 100);
  }
  return hexToRgba(palette[0] || "#F59E0B", particleConfig.particleOpacity / 100);
}

// ─── Animation visual style ───────────────────────────────────────────

export interface AnimationVisualStyle {
  borderRadius: string;
  background: string;
  clipPath?: string;
  boxShadow?: string;
  border?: string;
}

export function getAnimationVisualStyle(config: Record<string, unknown>): AnimationVisualStyle {
  const animationConfig = getActionAnimationConfig(config);
  const style = animationConfig.animationStyle || "聚焦脉冲";
  const animColor = animationConfig.animationColor || "#34D399";
  const glow = animationConfig.animationGlow ? `0 0 18px ${hexToRgba(animColor, 0.24)}` : "";

  if (style === "斜切闪片") {
    return {
      borderRadius: "22px",
      background: "linear-gradient(135deg, rgba(250,204,21,0.96), rgba(249,115,22,0.92))",
      boxShadow: "0 18px 32px rgba(249, 115, 22, 0.22)",
    };
  }
  if (style === "弹跳徽记") {
    return {
      borderRadius: "999px",
      background: "radial-gradient(circle at 35% 35%, rgba(96,165,250,0.96), rgba(79,70,229,0.94))",
      boxShadow: "0 16px 30px rgba(79, 70, 229, 0.2)",
    };
  }
  if (style === "漩涡旋转") {
    return {
      borderRadius: "38%",
      background: `linear-gradient(135deg, ${hexToRgba(animColor, 0.92)}, ${hexToRgba(animColor, 0.48)})`,
      boxShadow: `0 14px 28px ${hexToRgba(animColor, 0.26)}`,
    };
  }
  if (style === "星光闪耀") {
    return {
      borderRadius: "0",
      clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
      background: `radial-gradient(circle at 35% 35%, ${hexToRgba(animColor, 0.96)}, ${hexToRgba(animColor, 0.62)})`,
      boxShadow: glow || undefined,
    };
  }
  if (style === "轨道环绕") {
    return {
      borderRadius: "28%",
      background: `conic-gradient(from 0deg, ${hexToRgba(animColor, 0.72)}, ${hexToRgba(animColor, 0)}, ${hexToRgba(animColor, 0.72)})`,
      boxShadow: glow || undefined,
    };
  }
  if (style === "螺旋上升") {
    return {
      borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%",
      background: `radial-gradient(circle at 35% 35%, ${hexToRgba(animColor, 0.92)}, ${hexToRgba(animColor, 0.28)})`,
      boxShadow: `0 12px 26px ${hexToRgba(animColor, 0.22)}`,
    };
  }

  // 聚焦脉冲 (default)
  return {
    borderRadius: "999px",
    background: `radial-gradient(circle, ${hexToRgba(animColor, 0.3)} 0%, ${hexToRgba(animColor, 0.14)} 55%, ${hexToRgba(animColor, 0)} 100%)`,
    border: `2px solid ${hexToRgba(animColor, 0.42)}`,
    boxShadow: glow || undefined,
  };
}

// ─── Animation keyframe name ──────────────────────────────────────────

export function getAnimationKeyframeName(style: string): string {
  if (style === "斜切闪片") return "cursorDancePreviewAnimSlice";
  if (style === "弹跳徽记") return "cursorDancePreviewAnimBounce";
  if (style === "漩涡旋转") return "cursorDancePreviewAnimSwirl";
  if (style === "星光闪耀") return "cursorDancePreviewAnimStar";
  if (style === "轨道环绕") return "cursorDancePreviewAnimOrbit";
  if (style === "螺旋上升") return "cursorDancePreviewAnimSpiral";
  return "cursorDancePreviewAnimPulse";
}
