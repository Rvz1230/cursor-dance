import {
  getActionAudioConfig,
  getActionAnimationConfig,
  getActionCursorFeedbackConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getOrderedActionTextTags,
  getActionRippleConfig,
  getActionTextConfig,
  getActionTriggerConfig,
} from "../model/workbenchSchema";

export const PREVIEW_KEYFRAMES = `
  @keyframes cursorDancePreviewFloat {
    0% { opacity: 0; transform: translate3d(0, 6px, 0) scale(0.92); }
    18% { opacity: 1; transform: translate3d(0, 2px, 0) scale(1); }
    100% { opacity: 0; transform: translate3d(0, -10px, 0) scale(1.02); }
  }
  @keyframes cursorDancePreviewRipple {
    0% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(var(--ripple-from, 0.18)); }
    20% { opacity: 1; transform: translate3d(-50%, -50%, 0) scale(var(--ripple-mid, 0.72)); }
    100% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(var(--ripple-to, 1)); }
  }
  @keyframes cursorDancePreviewParticle {
    0% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(0.5) rotate(var(--particle-rotation, 0deg)); }
    20% { opacity: 0.9; transform: translate3d(calc(-50% + var(--particle-mid-x, 0px)), calc(-50% + var(--particle-mid-y, 0px)), 0) scale(1) rotate(var(--particle-rotation, 0deg)); }
    100% { opacity: 0; transform: translate3d(calc(-50% + var(--particle-x, 0px)), calc(-50% + var(--particle-y, 0px)), 0) scale(var(--particle-end-scale, 0.65)) rotate(var(--particle-rotation, 0deg)); }
  }
  @keyframes cursorDancePreviewParticleOrbital {
    0% { opacity: var(--orbital-start-opacity, 0.5); transform: translate3d(-50%, -50%, 0) translate(var(--orbital-sx, -2px), var(--orbital-sy, -2px)) scale(var(--orbital-start-scale, 0.6)); }
    50% { opacity: var(--orbital-peak-opacity, 0.15); transform: translate3d(-50%, -50%, 0) translate(var(--orbital-ex, 32px), var(--orbital-ey, 0px)) scale(var(--orbital-peak-scale, 1.2)); }
    100% { opacity: var(--orbital-start-opacity, 0.5); transform: translate3d(-50%, -50%, 0) translate(var(--orbital-sx, -2px), var(--orbital-sy, -2px)) scale(var(--orbital-start-scale, 0.6)); }
  }
  @keyframes cursorDancePreviewImage {
    0% { opacity: 0; transform: translate3d(-50%, -30%, 0) scale(0.72) rotate(-8deg); }
    18% { opacity: 1; transform: translate3d(-50%, -50%, 0) scale(1) rotate(0deg); }
    100% { opacity: 0; transform: translate3d(-50%, -92%, 0) scale(1.06) rotate(4deg); }
  }
  @keyframes cursorDancePreviewAnimPulse {
    0% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(0.42); }
    30% { opacity: var(--anim-opacity, 1); transform: translate3d(-50%, -50%, 0) scale(0.92); }
    100% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(1.48); }
  }
  @keyframes cursorDancePreviewAnimSlice {
    0% { opacity: 0; transform: translate3d(-50%, -40%, 0) scale(0.68) rotate(-18deg); }
    22% { opacity: var(--anim-opacity, 1); transform: translate3d(-50%, -50%, 0) scale(1) rotate(-6deg); }
    100% { opacity: 0; transform: translate3d(calc(-50% + 18px), calc(-50% - 18px), 0) scale(1.08) rotate(12deg); }
  }
  @keyframes cursorDancePreviewAnimBounce {
    0% { opacity: 0; transform: translate3d(-50%, -24%, 0) scale(0.52); }
    26% { opacity: var(--anim-opacity, 1); transform: translate3d(-50%, -50%, 0) scale(1.04); }
    100% { opacity: 0; transform: translate3d(-50%, -92%, 0) scale(0.88); }
  }
  @keyframes cursorDancePreviewAnimSwirl {
    0% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(0.38) rotate(0deg); }
    22% { opacity: var(--anim-opacity, 1); transform: translate3d(-50%, -50%, 0) scale(1) rotate(180deg); }
    100% { opacity: 0; transform: translate3d(-50%, -80%, 0) scale(0.62) rotate(360deg); }
  }
  @keyframes cursorDancePreviewAnimStar {
    0% { opacity: 0; transform: translate3d(-50%, -44%, 0) scale(0.32); }
    22% { opacity: var(--anim-opacity, 1.2); transform: translate3d(-50%, -50%, 0) scale(1.12); }
    100% { opacity: 0; transform: translate3d(-50%, -94%, 0) scale(0.48); }
  }
  @keyframes cursorDancePreviewAnimOrbit {
    0% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(0.28) rotate(0deg); }
    22% { opacity: var(--anim-opacity, 1); transform: translate3d(-50%, -50%, 0) scale(1.06) rotate(270deg); }
    100% { opacity: 0; transform: translate3d(-50%, -84%, 0) scale(0.68) rotate(540deg); }
  }
  @keyframes cursorDancePreviewAnimSpiral {
    0% { opacity: 0; transform: translate3d(-50%, -38%, 0) scale(0.44) rotate(-20deg); }
    22% { opacity: var(--anim-opacity, 1); transform: translate3d(-50%, -50%, 0) scale(1) rotate(8deg); }
    100% { opacity: 0; transform: translate3d(calc(-50% + 10px), calc(-50% - 86%), 0) scale(0.72) rotate(36deg); }
  }
  @keyframes cursorDancePreviewCursorBounce {
    0% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(0.86); }
    30% { opacity: 1; transform: translate3d(calc(-50% + 0.72px), calc(-50% + 0.64px), 0) scale(1); }
    100% { opacity: 0; transform: translate3d(calc(-50% + 4px), calc(-50% + 8px), 0) scale(0.9); }
  }
  @keyframes cursorDancePreviewPulse {
    0% { transform: scale(0.98); }
    30% { transform: scale(1); }
    100% { transform: scale(0.98); }
  }
  @keyframes cursorDancePreviewBars {
    0%, 100% { opacity: 0.45; transform: scaleY(0.45); }
    50% { opacity: 1; transform: scaleY(1); }
  }
`;

export function formatPreviewNumber(style, number = 3) {
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

export function getPreviewText(config, runIndex = 0, actionId = "leftClick") {
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
  const previewNumber = formatPreviewNumber(textConfig.textStyle, numberValue);
  if (textConfig.textMode === "模板模式") {
    return textConfig.textTemplate.replaceAll("${number}", previewNumber);
  }

  return `+${previewNumber}`;
}

export function getTextWeightValue(weight) {
  if (weight === "加粗") return 700;
  if (weight === "中等") return 600;
  return 500;
}

const TEXT_FONT_FAMILY_VALUES = {
  系统默认: '"SF Pro Text","PingFang SC","Microsoft YaHei",system-ui,sans-serif',
  "苹方 / 微软雅黑": '"PingFang SC","Microsoft YaHei","Helvetica Neue",Arial,sans-serif',
  宋体: 'SimSun,"Songti SC",serif',
  黑体: 'SimHei,"Heiti SC",sans-serif',
  楷体: 'KaiTi,"Kaiti SC",serif',
  等宽字体: '"SFMono-Regular",Consolas,"Liberation Mono",monospace',
};

export function getTextFontFamilyValue(value) {
  const textFontFamily = typeof value === "string" ? value.trim() : "";
  if (!textFontFamily || textFontFamily === "自定义") return TEXT_FONT_FAMILY_VALUES.系统默认;
  if (TEXT_FONT_FAMILY_VALUES[textFontFamily]) return TEXT_FONT_FAMILY_VALUES[textFontFamily];
  return textFontFamily.replace(/[;\n\r]/g, "").slice(0, 120) || TEXT_FONT_FAMILY_VALUES.系统默认;
}

export function hexToRgba(hex, alpha) {
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

export function getTextShadowValue(config) {
  const textConfig = getActionTextConfig(config);
  const color = hexToRgba(textConfig.textColor, textConfig.textShadow === "清晰" ? 0.36 : 0.24);
  if (textConfig.textShadow === "清晰") return `0 8px 18px ${color}`;
  if (textConfig.textShadow === "柔和") return `0 4px 12px ${color}`;
  return "none";
}

export function getAnimationEasingCss(label) {
  if (label === "线性") return "linear";
  if (label === "缓入") return "cubic-bezier(0.4, 0, 1, 1)";
  if (label === "缓入缓出") return "cubic-bezier(0.4, 0, 0.2, 1)";
  if (label === "弹跳") return "cubic-bezier(0.34, 1.56, 0.64, 1)";
  if (label === "弹性") return "cubic-bezier(0.22, 1, 0.36, 1.18)";
  return "cubic-bezier(0, 0, 0.2, 1)";
}

export function getAnimationKeyframeName(style) {
  if (style === "斜切闪片") return "cursorDancePreviewAnimSlice";
  if (style === "弹跳徽记") return "cursorDancePreviewAnimBounce";
  if (style === "漩涡旋转") return "cursorDancePreviewAnimSwirl";
  if (style === "星光闪耀") return "cursorDancePreviewAnimStar";
  if (style === "轨道环绕") return "cursorDancePreviewAnimOrbit";
  if (style === "螺旋上升") return "cursorDancePreviewAnimSpiral";
  return "cursorDancePreviewAnimPulse";
}

export function getAnimationVisualProps(config) {
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
  return {
    borderRadius: "999px",
    background: `radial-gradient(circle, ${hexToRgba(animColor, 0.3)} 0%, ${hexToRgba(animColor, 0.14)} 55%, ${hexToRgba(animColor, 0)} 100%)`,
    border: `2px solid ${hexToRgba(animColor, 0.42)}`,
    boxShadow: glow || undefined,
  };
}

export function getParticleTint(config, index) {
  const particleConfig = getActionParticleConfig(config);
  const textConfig = getActionTextConfig(config);
  if (particleConfig.particleColorMode === "跟随飘字色") return hexToRgba(textConfig.textColor, particleConfig.particleOpacity / 100);
  const palette = Array.isArray(particleConfig.particlePalette) && particleConfig.particlePalette.length
    ? particleConfig.particlePalette
    : ["#FDBA74", "#FDE68A", "#86EFAC", "#93C5FD", "#F9A8D4"];
  if (particleConfig.particleColorMode === "随机轻变化") {
    return hexToRgba(palette[index % palette.length], particleConfig.particleOpacity / 100);
  }
  return hexToRgba(palette[0] || "#F59E0B", particleConfig.particleOpacity / 100);
}

export function buildParticleSpecs(config, runIndex) {
  const particleConfig = getActionParticleConfig(config);
  const baseDelay = particleConfig.particleDelay || 0;
  const visibleCount = Math.min(particleConfig.particleCount, 40);
  const spread = Math.max(0, Math.min(particleConfig.particleSpread || 52, 90));

  const direction = particleConfig.particleDirection || "四周扩散";

  // 构建角度顺序：旋转扫射不 shuffle（依次扫射），其余模式 shuffle（随机空间顺序）
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

    let angle;
    if (direction === "随机散射") {
      // 伪随机角度，每个粒子方向完全随机
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
    const gravity = ((particleConfig.particleGravity || 0) / 100) * gravityScale;
    const wind = (particleConfig.particleWind || 0) / 100;
    const bounce = (particleConfig.particleBounce || 0) / 100;
    const bounceY = bounce > 0 ? -effectiveSpread * bounce * 1.0 : 0;
    const tx = baseX + wind * effectiveSpread * 1.2;
    const ty = baseY + gravity * effectiveSpread * 1.6;
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

export function buildOrbitalParticleSpecs(config) {
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

export function getParticleStyleProps(config, index, size) {
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
      clipPath: "polygon(50% 15%, 72% 0%, 94% 12%, 94% 38%, 80% 62%, 50% 90%, 20% 62%, 6% 38%, 6% 12%, 28% 0%)",
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
  return {
    width: size,
    height: size,
    borderRadius: "999px",
    rotation: 0,
    boxShadow: `0 0 0 1px ${hexToRgba("#FFFFFF", 0.4)}`,
  };
}

export function buildRippleSpecs(config) {
  const rippleConfig = getActionRippleConfig(config);
  const baseDelay = rippleConfig.rippleDelay || 0;
  const size = rippleConfig.rippleSize;
  const opacity = rippleConfig.rippleOpacity / 100;
  const style = rippleConfig.rippleStyle || "单环";

  if (style === "双环") {
    return [
      { size, opacity, delay: baseDelay, filled: false, scaleFrom: 0.16, scaleMid: 0.62, scaleTo: 0.96 },
      { size: size * 1.12, opacity: opacity * 0.82, delay: baseDelay + Math.min(120, rippleConfig.rippleDuration * 0.12), filled: false, scaleFrom: 0.28, scaleMid: 0.84, scaleTo: 1.14 },
    ];
  }

  if (style === "柔和面波") {
    return [{ size, opacity, delay: baseDelay, filled: true, scaleFrom: 0.22, scaleMid: 0.7, scaleTo: 1.06 }];
  }

  if (style === "脉冲波纹") {
    return [
      { size, opacity, delay: baseDelay, filled: true, scaleFrom: 0.12, scaleMid: 0.58, scaleTo: 0.98 },
      { size: size * 1.24, opacity: opacity * 0.52, delay: baseDelay + Math.min(180, rippleConfig.rippleDuration * 0.18), filled: false, scaleFrom: 0.32, scaleMid: 0.78, scaleTo: 1.2 },
      { size: size * 1.4, opacity: opacity * 0.26, delay: baseDelay + Math.min(320, rippleConfig.rippleDuration * 0.36), filled: false, scaleFrom: 0.48, scaleMid: 0.88, scaleTo: 1.36 },
    ];
  }

  if (style === "回声环") {
    return [
      { size, opacity, delay: baseDelay, filled: false, scaleFrom: 0.16, scaleMid: 0.62, scaleTo: 0.96 },
      { size: size * 1.1, opacity: opacity * 0.68, delay: baseDelay + Math.min(90, rippleConfig.rippleDuration * 0.1), filled: false, scaleFrom: 0.28, scaleMid: 0.72, scaleTo: 1.06 },
      { size: size * 1.22, opacity: opacity * 0.44, delay: baseDelay + Math.min(180, rippleConfig.rippleDuration * 0.2), filled: false, scaleFrom: 0.4, scaleMid: 0.82, scaleTo: 1.18 },
      { size: size * 1.36, opacity: opacity * 0.22, delay: baseDelay + Math.min(280, rippleConfig.rippleDuration * 0.3), filled: false, scaleFrom: 0.52, scaleMid: 0.9, scaleTo: 1.32 },
    ];
  }

  if (style === "能量脉冲") {
    return [
      { size, opacity: opacity * 1.1, delay: baseDelay, filled: true, scaleFrom: 0.1, scaleMid: 0.56, scaleTo: 0.96 },
      { size: size * 1.16, opacity: opacity * 0.58, delay: baseDelay + Math.min(140, rippleConfig.rippleDuration * 0.14), filled: false, scaleFrom: 0.26, scaleMid: 0.74, scaleTo: 1.12 },
    ];
  }

  return [{ size, opacity, delay: baseDelay, filled: false, scaleFrom: 0.18, scaleMid: 0.72, scaleTo: 1 }];
}

export function getPreviewLoopDelay(config) {
  const textConfig = getActionTextConfig(config);
  const animationConfig = getActionAnimationConfig(config);
  const imageConfig = getActionImageConfig(config);
  const particleConfig = getActionParticleConfig(config);
  const rippleConfig = getActionRippleConfig(config);
  const audioConfig = getActionAudioConfig(config);

  return (
    Math.max(
      textConfig.textEnabled ? (textConfig.textDelay || 0) + textConfig.textDuration : 0,
      animationConfig.animationEnabled ? (animationConfig.animationDelay || 0) + animationConfig.animationDuration : 0,
      imageConfig.imageEnabled ? (imageConfig.imageDelay || 0) + imageConfig.imageDuration : 0,
      particleConfig.particle ? (particleConfig.particleDelay || 0) + particleConfig.particleDuration : 0,
      rippleConfig.ripple ? (rippleConfig.rippleDelay || 0) + rippleConfig.rippleDuration : 0,
      audioConfig.sound ? (audioConfig.soundDelay || 0) + 880 : 0,
      1400
    ) + 900
  );
}

export function getPreviewAnimationStyle(config) {
  const animationConfig = getActionAnimationConfig(config);
  const scale = Math.max(0.6, (animationConfig.animationScale || 100) / 100);
  const size = Math.round(56 * scale);
  return {
    width: `${size}px`,
    height: `${size}px`,
    opacity: Math.max(0.18, (animationConfig.animationOpacity || 100) / 100),
    marginLeft: `${animationConfig.animationOffsetX || 0}px`,
    marginTop: `${animationConfig.animationOffsetY || -10}px`,
  };
}

export function getPreviewImageStyle(config) {
  const imageConfig = getActionImageConfig(config);
  return {
    width: `${imageConfig.imageSize || 56}px`,
    height: `${imageConfig.imageSize || 56}px`,
    opacity: Math.max(0.2, (imageConfig.imageOpacity || 100) / 100),
    marginLeft: `${imageConfig.imageOffsetX || 0}px`,
    marginTop: `${imageConfig.imageOffsetY || -18}px`,
  };
}

export function getPreviewCursorSize(config) {
  const cursorConfig = getActionCursorFeedbackConfig(config);
  return cursorConfig.cursorSize;
}

export function getPreviewSoundFile(config) {
  const audioConfig = getActionAudioConfig(config);
  return audioConfig.soundFile;
}

export function getPreviewTriggerSummary(config) {
  const triggerConfig = getActionTriggerConfig(config);
  return `${triggerConfig.triggerTiming} · ${triggerConfig.triggerZone}`;
}
