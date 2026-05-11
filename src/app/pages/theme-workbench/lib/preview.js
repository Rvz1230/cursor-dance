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

export function formatPreviewNumber(style) {
  if (style.includes("中文")) return "三";
  if (style.includes("英文")) return "three";
  return "3";
}

export function getPreviewText(config, runIndex = 0) {
  if (!config.textEnabled) return "静默";
  if (config.textKind === "文本飘字") {
    const primaryText = typeof config.textContent === "string" ? config.textContent.trim() : "";
    const tags = [
      ...(primaryText ? [primaryText] : []),
      ...(config.textTags || []).filter((item) => item && item !== primaryText),
    ];
    if (!tags.length) return "未设置文本";
    if (config.textTagPlayMode === "随机显示") {
      return tags[(runIndex * 7 + 3) % tags.length];
    }
    return tags[runIndex % tags.length];
  }

  const previewNumber = formatPreviewNumber(config.textStyle);
  if (config.textMode === "模板模式") {
    return config.textTemplate.replaceAll("${number}", previewNumber);
  }

  return `+${previewNumber}`;
}

export function getTextWeightValue(weight) {
  if (weight === "加粗") return 700;
  if (weight === "中等") return 600;
  return 500;
}

export function hexToRgba(hex, alpha) {
  const normalized = hex.replace("#", "");
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
  const color = hexToRgba(config.textColor, config.textShadow === "清晰" ? 0.36 : 0.24);
  if (config.textShadow === "清晰") return `0 8px 18px ${color}`;
  if (config.textShadow === "柔和") return `0 4px 12px ${color}`;
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
  if (config.particleColorMode === "跟随飘字色") return hexToRgba(config.textColor, config.particleOpacity / 100);
  if (config.particleColorMode === "随机轻变化") {
    const palette = ["#FDBA74", "#FDE68A", "#86EFAC", "#93C5FD", "#F9A8D4"];
    return hexToRgba(palette[index % palette.length], config.particleOpacity / 100);
  }
  return hexToRgba("#FBBF24", config.particleOpacity / 100);
}

export function buildParticleSpecs(config, runIndex) {
  const visibleCount = Math.min(config.particleCount, 20);
  const spread = Math.max(18, Math.min(config.particleSpread, 88));

  return Array.from({ length: visibleCount }, (_, index) => {
    let startAngle = 0;
    let sweep = Math.PI * 2;

    if (config.particleDirection === "向上喷发") {
      startAngle = -Math.PI * 0.95;
      sweep = Math.PI * 0.9;
    } else if (config.particleDirection === "沿点击方向") {
      startAngle = -Math.PI * 0.38;
      sweep = Math.PI * 0.76;
    }

    const angle = startAngle + (visibleCount === 1 ? 0 : (index / (visibleCount - 1)) * sweep);
    const variance = ((runIndex + 5) * (index + 3)) % 11 - 5;
    const distance = spread * (0.58 + index / Math.max(visibleCount * 1.5, 1)) + variance * 1.8;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      delay: index * 26,
      size: Math.max(6, config.particleSize * (0.52 + (index % 4) * 0.1)),
    };
  });
}

export function getParticleStyleProps(config, index, size) {
  const style = config.particleStyle || "点状粒子";
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
  return {
    width: size,
    height: size,
    borderRadius: "999px",
    rotation: 0,
    boxShadow: `0 0 0 1px ${hexToRgba("#FFFFFF", 0.4)}`,
  };
}

export function buildRippleSpecs(config) {
  const size = config.rippleSize;
  const opacity = config.rippleOpacity / 100;
  const style = config.rippleStyle || "单环";

  if (style === "双环") {
    return [
      { size, opacity, delay: 0, filled: false },
      { size: size * 1.12, opacity: opacity * 0.82, delay: Math.min(120, config.rippleDuration * 0.12), filled: false },
    ];
  }

  if (style === "柔和面波") {
    return [{ size, opacity, delay: 0, filled: true }];
  }

  return [{ size, opacity, delay: 0, filled: false }];
}
