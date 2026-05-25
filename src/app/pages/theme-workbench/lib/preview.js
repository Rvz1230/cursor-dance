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
} from "../model/workbenchSchema.js";

export const PREVIEW_KEYFRAMES = `
  @keyframes cursorDancePreviewFloat {
    0% { opacity: 0; transform: translate3d(0, 8px, 0) scale(0.92); }
    18% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
    100% { opacity: 0; transform: translate3d(0, -46px, 0) scale(1.04); }
  }
  @keyframes cursorDancePreviewRipple {
    0% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(0.4); }
    20% { opacity: 1; transform: translate3d(-50%, -50%, 0) scale(0.72); }
    100% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(1); }
  }
  @keyframes cursorDancePreviewParticle {
    0% { opacity: 0; transform: translate3d(0, 0, 0) scale(0.4); }
    18% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
    100% { opacity: 0; transform: translate3d(var(--particle-x), var(--particle-y), 0) scale(0.72); }
  }
  @keyframes cursorDancePreviewImage {
    0% { opacity: 0; transform: translate3d(-50%, -30%, 0) scale(0.72) rotate(-8deg); }
    18% { opacity: 1; transform: translate3d(-50%, -50%, 0) scale(1) rotate(0deg); }
    100% { opacity: 0; transform: translate3d(-50%, -92%, 0) scale(1.06) rotate(4deg); }
  }
  @keyframes cursorDancePreviewAnimation {
    0% { opacity: 0; transform: translate3d(-50%, -42%, 0) scale(0.56) rotate(-12deg); }
    22% { opacity: 1; transform: translate3d(-50%, -50%, 0) scale(1) rotate(0deg); }
    100% { opacity: 0; transform: translate3d(-50%, -90%, 0) scale(1.18) rotate(8deg); }
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

export function getPreviewText(config, runIndex = 0) {
  const textConfig = getActionTextConfig(config);
  if (!textConfig.textEnabled) return "静默";
  if (textConfig.textKind === "文本飘字") {
    const tags = getOrderedActionTextTags(textConfig);
    if (!tags.length) return "未设置文本";
    if (textConfig.textTagPlayMode === "随机显示") {
      return tags[(runIndex * 7 + 3) % tags.length];
    }
    return tags[runIndex % tags.length];
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
  const normalized = (hex || "#FBBF24").replace("#", "");
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
  return hexToRgba(palette[0] || "#FBBF24", particleConfig.particleOpacity / 100);
}

export function buildParticleSpecs(config, runIndex) {
  const particleConfig = getActionParticleConfig(config);
  const visibleCount = Math.min(particleConfig.particleCount, 40);
  const spread = Math.max(0, Math.min(particleConfig.particleSpread, 90));

  return Array.from({ length: visibleCount }, (_, index) => {
    let startAngle = 0;
    let sweep = Math.PI * 2;

    if (particleConfig.particleDirection === "向上喷发") {
      startAngle = -Math.PI * 0.95;
      sweep = Math.PI * 0.9;
    } else if (particleConfig.particleDirection === "沿点击方向") {
      startAngle = -Math.PI * 0.38;
      sweep = Math.PI * 0.76;
    }

    const angle = startAngle + (visibleCount === 1 ? 0 : (index / (visibleCount - 1)) * sweep);
    const variance = ((runIndex + 5) * (index + 3)) % 11 - 5;
    const distance = spread * (0.58 + index / Math.max(visibleCount * 1.5, 1)) + variance * 1.8;
    const baseX = Math.cos(angle) * distance;
    const baseY = Math.sin(angle) * distance;
    const gravity = (particleConfig.particleGravity || 0) / 100;
    const wind = (particleConfig.particleWind || 0) / 100;
    const bounce = (particleConfig.particleBounce || 0) / 100;
    return {
      x: baseX + wind * spread * 1.2,
      y: baseY + gravity * spread * 1.6,
      delay: index * 26,
      size: Math.max(6, particleConfig.particleSize * (0.52 + (index % 4) * 0.1)),
      bounceY: bounce > 0 ? -spread * bounce * 1.0 : 0,
    };
  });
}

export function getParticleStyleProps(config, index, size) {
  const particleConfig = getActionParticleConfig(config);
  const style = particleConfig.particleStyle || "点状粒子";
  if (style === "火花") {
    return {
      width: size * 1.9,
      height: Math.max(3, size * 0.42),
      borderRadius: "999px",
      rotation: -28 + ((index * 17) % 7) * 11,
      boxShadow: `0 0 12px ${hexToRgba("#F59E0B", 0.34)}`,
    };
  }
  if (style === "碎屑粒子") {
    return {
      width: size * 1.35,
      height: Math.max(4, size * 0.72),
      borderRadius: "38%",
      rotation: -42 + ((index * 13) % 9) * 10,
      boxShadow: `0 4px 10px ${hexToRgba("#0F172A", 0.12)}`,
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
  const size = rippleConfig.rippleSize;
  const opacity = rippleConfig.rippleOpacity / 100;
  const style = rippleConfig.rippleStyle || "单环";

  if (style === "双环") {
    return [
      { size, opacity, delay: 0, filled: false },
      { size: size * 1.12, opacity: opacity * 0.82, delay: Math.min(120, rippleConfig.rippleDuration * 0.12), filled: false },
    ];
  }

  if (style === "柔和面波") {
    return [{ size, opacity, delay: 0, filled: true }];
  }

  if (style === "脉冲波纹") {
    return [
      { size, opacity, delay: 0, filled: true },
      { size: size * 1.24, opacity: opacity * 0.52, delay: Math.min(180, rippleConfig.rippleDuration * 0.18), filled: false },
      { size: size * 1.4, opacity: opacity * 0.26, delay: Math.min(320, rippleConfig.rippleDuration * 0.36), filled: false },
    ];
  }

  if (style === "回声环") {
    return [
      { size, opacity, delay: 0, filled: false },
      { size: size * 1.1, opacity: opacity * 0.68, delay: Math.min(90, rippleConfig.rippleDuration * 0.1), filled: false },
      { size: size * 1.22, opacity: opacity * 0.44, delay: Math.min(180, rippleConfig.rippleDuration * 0.2), filled: false },
      { size: size * 1.36, opacity: opacity * 0.22, delay: Math.min(280, rippleConfig.rippleDuration * 0.3), filled: false },
    ];
  }

  if (style === "能量脉冲") {
    return [
      { size, opacity: opacity * 1.1, delay: 0, filled: true },
      { size: size * 1.16, opacity: opacity * 0.58, delay: Math.min(140, rippleConfig.rippleDuration * 0.14), filled: false },
    ];
  }

  return [{ size, opacity, delay: 0, filled: false }];
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
      textConfig.textEnabled ? textConfig.textDuration : 0,
      animationConfig.animationEnabled ? animationConfig.animationDuration : 0,
      imageConfig.imageEnabled ? imageConfig.imageDuration : 0,
      particleConfig.particle ? particleConfig.particleDuration : 0,
      rippleConfig.ripple ? rippleConfig.rippleDuration : 0,
      audioConfig.sound ? 880 : 0,
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
