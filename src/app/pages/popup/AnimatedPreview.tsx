import { motion } from "framer-motion";
import {
  getParticleStyleProps,
  getParticleTint,
  buildParticleSpecs,
  buildOrbitalParticleSpecs,
  buildRippleSpecs,
  getAnimationVisualProps,
  getPreviewText,
  hexToRgba,
} from "../theme-workbench/lib/preview";

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function toFramerEase(label) {
  if (label === "线性") return "linear";
  if (label === "缓出" || !label) return "easeOut";
  if (label === "缓入") return [0.4, 0, 1, 1];
  if (label === "缓入缓出") return [0.4, 0, 0.2, 1];
  if (label === "弹跳") return [0.34, 1.56, 0.64, 1];
  if (label === "弹性") return [0.22, 1, 0.36, 1.18];
  return "easeOut";
}


// ═══════════════════════════════════════════════════════════════════
// ParticleBurstPreview — burst-mode particles driven by config
// ═══════════════════════════════════════════════════════════════════

function ParticleBurstPreview({ config }) {
  const allSpecs = buildParticleSpecs(config, 0);
  const maxCount = 12;
  const specs = allSpecs.length > maxCount ? allSpecs.slice(0, maxCount) : allSpecs;
  const scale = 0.4;
  const duration = Math.min(config.particleDuration || 780, 1200) / 1000;
  const peakOpacity = (config.particleOpacity ?? 100) / 100;

  return (
    <>
      {specs.map((spec, i) => {
        const styleProps = getParticleStyleProps(config, i, spec.size);
        const color = getParticleTint(config, i);

        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{
              width: styleProps.width,
              height: styleProps.height,
              marginLeft: -(styleProps.width / 2),
              marginTop: -(styleProps.height / 2),
              borderRadius: styleProps.borderRadius,
              clipPath: styleProps.clipPath,
              backgroundColor: color,
              boxShadow: styleProps.boxShadow,
            }}
            animate={{
              x: [0, spec.midX * scale, spec.x * scale],
              y: [0, spec.midY * scale, spec.y * scale],
              opacity: [0, peakOpacity, 0],
              scale: [0.5, 1, spec.endScale],
              rotate: [0, (styleProps.rotation || 0) * 0.5, styleProps.rotation || 0],
            }}
            transition={{
              duration,
              repeat: Infinity,
              delay: spec.delay / 1000,
              ease: "easeOut",
              times: [0, 0.25, 1],
            }}
          />
        );
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ParticleOrbitalPreview — orbital-mode particles driven by config
// ═══════════════════════════════════════════════════════════════════

function ParticleOrbitalPreview({ config }) {
  const specs = buildOrbitalParticleSpecs(config);
  const clamped = specs.map((s) => ({
    ...s,
    ex: s.ex > 50 ? (s.ex > 0 ? 50 : -50) : s.ex,
    ey: s.ey > 50 ? (s.ey > 0 ? 50 : -50) : s.ey,
  }));

  return (
    <>
      {clamped.map((spec, i) => {
        const styleProps = getParticleStyleProps(config, i, spec.size);
        const color = getParticleTint(config, i);

        return (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{
              width: styleProps.width,
              height: styleProps.height,
              marginLeft: -(styleProps.width / 2),
              marginTop: -(styleProps.height / 2),
              borderRadius: styleProps.borderRadius,
              clipPath: styleProps.clipPath,
              backgroundColor: color,
              boxShadow: styleProps.boxShadow,
            }}
            animate={{
              x: [spec.sx, spec.ex, spec.sx],
              y: [spec.sy, spec.ey, spec.sy],
              opacity: [0.5, 0.15, 0.5],
              scale: [0.6, 1.2, 0.6],
            }}
            transition={{
              duration: spec.speed,
              repeat: Infinity,
              delay: -(i / clamped.length) * spec.speed,
              ease: "easeInOut",
            }}
          />
        );
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// RipplePreview — config-driven ripple layers
// ═══════════════════════════════════════════════════════════════════

function RipplePreview({ config }) {
  const specs = buildRippleSpecs(config);
  const rippleConfig = config;
  const color = rippleConfig.rippleColor || "#F59E0B";
  const duration = Math.min(rippleConfig.rippleDuration || 860, 1400) / 1000;
  const lineWidth = rippleConfig.rippleLineWidth || 2;
  const easing = toFramerEase(rippleConfig.rippleEasing || "缓出");

  return (
    <>
      {specs.map((spec, i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: spec.size,
            height: spec.size,
            marginLeft: -(spec.size / 2),
            marginTop: -(spec.size / 2),
            border: spec.filled
              ? "none"
              : `${lineWidth}px solid ${hexToRgba(color, spec.opacity)}`,
            background: spec.filled
              ? `radial-gradient(circle, ${hexToRgba(color, 0.34)} 0%, ${hexToRgba(color, 0.16)} 56%, transparent 100%)`
              : "none",
            boxShadow: spec.filled
              ? `inset 0 0 0 1px ${hexToRgba(color, 0.22)}`
              : "none",
          }}
          animate={{
            scale: [spec.scaleFrom, spec.scaleMid, spec.scaleTo],
            opacity: [0, spec.opacity, 0],
          }}
          transition={{
            duration,
            repeat: Infinity,
            delay: spec.delay / 1000,
            ease: easing,
            times: [0, 0.2, 1],
          }}
        />
      ))}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TextPreview — config-driven floating text
// ═══════════════════════════════════════════════════════════════════

function TextPreview({ config }) {
  const textConfig = config;
  const content = textConfig.textContent || "✦";
  const color = textConfig.textColor || "#94A3B8";
  const size = Math.min(textConfig.fontSize || 22, 30);
  const duration = Math.min(textConfig.textDuration || 1000, 2000) / 1000;
  const peakOpacity = (textConfig.textOpacity ?? 100) / 100;
  const truncated = content.length > 8 ? content.slice(0, 8) + "…" : content;

  // respect textKind: 数字飘字 shows +N, 文本飘字 shows tag
  let display = truncated;
  if (textConfig.textKind === "数字飘字") {
    display = `+${truncated.replace(/^\+/, "")}`;
  }

  return (
    <motion.span
      className="font-bold leading-none text-center pointer-events-none"
      style={{
        color,
        fontSize: size,
        opacity: peakOpacity,
      }}
      animate={{ scale: [1, 1.06, 1], opacity: [peakOpacity * 0.6, peakOpacity, peakOpacity * 0.6] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
    >
      {display}
    </motion.span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SoundIndicator — audio bar in bottom-right corner
// ═══════════════════════════════════════════════════════════════════

function SoundIndicator({ accent }) {
  const bars = [
    { height: 6, delay: 0 },
    { height: 9, delay: 0.1 },
    { height: 13, delay: 0.2 },
    { height: 9, delay: 0.1 },
  ];

  return (
    <div className="absolute bottom-1.5 right-1.5 flex items-end gap-[2px] pointer-events-none">
      {bars.map((bar, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          style={{
            width: 2,
            height: bar.height,
            backgroundColor: accent,
          }}
          animate={{
            scaleY: [1, 1.8, 1],
            opacity: [0.35, 0.7, 0.35],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: bar.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CursorGlowIndicator — subtle glow at center
// ═══════════════════════════════════════════════════════════════════

function CursorGlowIndicator({ color }) {
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 rounded-full pointer-events-none"
      style={{
        width: 72,
        height: 72,
        marginLeft: -36,
        marginTop: -36,
        background: `radial-gradient(circle, ${hexToRgba(color, 0.18)} 0%, ${hexToRgba(color, 0.08)} 50%, transparent 70%)`,
      }}
      animate={{ opacity: [0.06, 0.14, 0.06], scale: [1, 1.06, 1] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════
// AnimationPreview — animation effect behind everything
// ═══════════════════════════════════════════════════════════════════

function AnimationPreview({ config }) {
  const visProps = getAnimationVisualProps(config);
  const animConfig = config;
  const duration = Math.min(animConfig.animationDuration || 720, 1400) / 1000;
  const easing = toFramerEase(animConfig.animationEasing || "缓出");
  const style = animConfig.animationStyle || "聚焦脉冲";
  const scaleFactor = Math.max(0.5, (animConfig.animationScale || 100) / 100);

  // keyframes per style
  const animDef = getAnimationKeyframes(style);

  return (
    <motion.div
      className="absolute left-1/2 top-1/2 pointer-events-none"
      style={{
        width: 40 * scaleFactor,
        height: 40 * scaleFactor,
        marginLeft: -(20 * scaleFactor),
        marginTop: -(20 * scaleFactor),
        borderRadius: visProps.borderRadius,
        background: visProps.background,
        clipPath: visProps.clipPath,
        boxShadow: visProps.boxShadow,
      }}
      animate={{
        scale: animDef.scale,
        x: animDef.x,
        y: animDef.y,
        rotate: animDef.rotate,
        opacity: animDef.opacity,
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: easing,
        times: [0, 0.22, 1],
      }}
    />
  );
}

function getAnimationKeyframes(style) {
  if (style === "斜切闪片") {
    return {
      scale: [0.68, 1, 1.08],
      x: [0, 0, 12],
      y: [4, 0, -12],
      rotate: [-18, -6, 12],
      opacity: [0, 1, 0],
    };
  }
  if (style === "弹跳徽记") {
    return {
      scale: [0.52, 1.04, 0.88],
      x: [0, 0, 0],
      y: [6, 0, -16],
      rotate: [0, 0, 0],
      opacity: [0, 1, 0],
    };
  }
  if (style === "漩涡旋转") {
    return {
      scale: [0.38, 1, 0.62],
      x: [0, 0, 0],
      y: [0, 0, -12],
      rotate: [0, 180, 360],
      opacity: [0, 1, 0],
    };
  }
  if (style === "星光闪耀") {
    return {
      scale: [0.32, 1.12, 0.48],
      x: [0, 0, 0],
      y: [-3, 0, -16],
      rotate: [0, 0, 0],
      opacity: [0, 1.2, 0],
    };
  }
  if (style === "轨道环绕") {
    return {
      scale: [0.28, 1.06, 0.68],
      x: [0, 0, 0],
      y: [0, 0, -14],
      rotate: [0, 270, 540],
      opacity: [0, 1, 0],
    };
  }
  if (style === "螺旋上升") {
    return {
      scale: [0.44, 1, 0.72],
      x: [0, 0, 8],
      y: [6, 0, -16],
      rotate: [-20, 8, 36],
      opacity: [0, 1, 0],
    };
  }
  // 聚焦脉冲 (default)
  return {
    scale: [0.42, 0.92, 1.48],
    x: [0, 0, 0],
    y: [0, 0, 0],
    rotate: [0, 0, 0],
    opacity: [0, 1, 0],
  };
}

// ═══════════════════════════════════════════════════════════════════
// AnimatedPreview — orchestrator
// ═══════════════════════════════════════════════════════════════════

export default function AnimatedPreview({ actionConfig, accent }) {
  const hasParticle = actionConfig?.particle;
  const hasRipple = actionConfig?.ripple;
  const hasText = actionConfig?.textEnabled && actionConfig?.textContent;
  const hasSound = actionConfig?.sound;
  const hasCursorGlow = actionConfig?.cursorGlowColor?.trim();
  const hasAnimation = actionConfig?.animationEnabled;
  const hasOrbital = actionConfig?.particleMotionMode === "orbital";
  const hasAny = hasParticle || hasRipple || hasText;

  if (!hasAny) return null;

  return (
    <div className="relative flex items-center justify-center size-full">
      {/* animation effect (back-most) */}
      {hasAnimation && <AnimationPreview config={actionConfig} />}

      {/* cursor glow */}
      {hasCursorGlow && <CursorGlowIndicator color={actionConfig.cursorGlowColor} />}

      {/* ripple */}
      {hasRipple && <RipplePreview config={actionConfig} />}

      {/* particle */}
      {hasParticle && hasOrbital && <ParticleOrbitalPreview config={actionConfig} />}
      {hasParticle && !hasOrbital && <ParticleBurstPreview config={actionConfig} />}

      {/* text */}
      {hasText && <TextPreview config={actionConfig} />}

      {/* sound indicator (front-most, bottom-right) */}
      {hasSound && <SoundIndicator accent={accent} />}
    </div>
  );
}
