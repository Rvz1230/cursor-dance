import {
  getActionAudioConfig,
  getActionAnimationConfig,
  getActionCursorFeedbackConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
  getActionTriggerConfig,
} from "../model/workbenchSchema";

import { getPreviewCycleMs } from "./timelineModel";

// Computation logic shared with runtime content-script
import {
  hexToRgba as _hexToRgba,
  getAnimationEasingCss as _getAnimationEasingCss,
  getTextWeightValue as _getTextWeightValue,
  formatNumber as _formatNumber,
  getTextContent as _getTextContent,
  computeRippleLayers as _computeRippleLayers,
  computeParticleSpecs as _computeParticleSpecs,
  computeOrbitalParticleSpecs as _computeOrbitalParticleSpecs,
  getParticleShapeStyle as _getParticleShapeStyle,
  getParticleTint as _getParticleTint,
  getAnimationVisualStyle as _getAnimationVisualStyle,
  getAnimationKeyframeName as _getAnimationKeyframeName,
} from "./computeSpecs";

// Re-export shared computation functions under their original names
// so existing callers (WorkbenchPreviewRail, AnimatedPreview) don't need to change.
export const hexToRgba = _hexToRgba;
export const getAnimationEasingCss = _getAnimationEasingCss;
export const getTextWeightValue = _getTextWeightValue;
export const formatPreviewNumber = _formatNumber;
export const getAnimationKeyframeName = _getAnimationKeyframeName;
export const buildRippleSpecs = _computeRippleLayers;
export const buildParticleSpecs = _computeParticleSpecs;
export const buildOrbitalParticleSpecs = _computeOrbitalParticleSpecs;
export const getParticleStyleProps = _getParticleShapeStyle;
export const getParticleTint = _getParticleTint;
export const getAnimationVisualProps = _getAnimationVisualStyle;

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

export function getPreviewText(config, runIndex = 0, actionId = "leftClick") {
  return _getTextContent(config, runIndex, actionId);
}

export function getTextShadowValue(config) {
  const textConfig = getActionTextConfig(config);
  const color = hexToRgba(textConfig.textColor, textConfig.textShadow === "清晰" ? 0.36 : 0.24);
  if (textConfig.textShadow === "清晰") return `0 8px 18px ${color}`;
  if (textConfig.textShadow === "柔和") return `0 4px 12px ${color}`;
  return "none";
}

export function getPreviewLoopDelay(config) {
  return getPreviewCycleMs(config);
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

export function getPreviewSoundFile(config) {
  const audioConfig = getActionAudioConfig(config);
  return audioConfig.soundFile;
}

export function getPreviewTriggerSummary(config) {
  const triggerConfig = getActionTriggerConfig(config);
  return `${triggerConfig.triggerTiming} · ${triggerConfig.triggerZone}`;
}
