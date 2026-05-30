import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  getParticleStyleProps,
  getParticleTint,
  buildParticleSpecs,
  buildOrbitalParticleSpecs,
  buildRippleSpecs,
  getAnimationVisualProps,
  getPreviewText,
  getAnimationKeyframeName,
  getAnimationEasingCss,
  PREVIEW_KEYFRAMES,
  hexToRgba,
} from "../theme-workbench/lib/preview";

// ═══════════════════════════════════════════════════════════════════
// Custom keyframes — hand-written to exactly match visual-effects.js
// ═══════════════════════════════════════════════════════════════════

const POPUP_KF = `
/* particles — matches renderParticles() exactly:
   transform order: translate → rotate → scale (matching Web Animations keyframes)
   runtime keyframe offsets: 0%, 50%, 100% → mapped to 0%, 20%, 100% for more natural feel
   (20% mid matches the runtime's implicit easing distribution) */
@keyframes cdParticle {
  0%   { opacity: 0; transform: translate3d(-50%,-50%,0) rotate(var(--p-r,0deg)) scale(0.5); }
  20%  { opacity: 0.9; transform: translate3d(calc(-50% + var(--p-mx,0px)),calc(-50% + var(--p-my,0px)),0) rotate(var(--p-r,0deg)) scale(1); }
  100% { opacity: 0; transform: translate3d(calc(-50% + var(--p-x,0px)),calc(-50% + var(--p-y,0px)),0) rotate(var(--p-r,0deg)) scale(var(--p-es,0.65)); }
}

/* ripple — matches renderRipple() exactly:
   runtime starts at partial opacity (filled: 0.84*op, outline: 0.46*op)
   and fades THROUGH mid to 0 — NOT 0→peak→0 */
@keyframes cdRipple {
  0%   { opacity: var(--r-so,0.46); transform: translate3d(-50%,-50%,0) scale(var(--r-from,0.18)); }
  50%  { opacity: var(--r-mo,0.22); transform: translate3d(-50%,-50%,0) scale(var(--r-mid,0.72)); }
  100% { opacity: 0; transform: translate3d(-50%,-50%,0) scale(var(--r-to,1)); }
}

/* text float — matches renderText() exactly:
   uses -50% translate for center alignment (not pixel offsets) */
@keyframes cdText {
  0%   { opacity: 0; transform: translate3d(-50%,-32%,0) scale(0.92); }
  50%  { opacity: 1; transform: translate3d(-50%,-50%,0) scale(1); }
  100% { opacity: 0; transform: translate3d(-50%,-96%,0) scale(1.02); }
}
`;

// ═══════════════════════════════════════════════════════════════════
// CSS custom property helper
// ═══════════════════════════════════════════════════════════════════

function cssVars(vars) {
  return vars as React.CSSProperties;
}

// ═══════════════════════════════════════════════════════════════════
// Keyframe injection (run once per popup lifetime)
// ═══════════════════════════════════════════════════════════════════

const KF_ID = "cd-popup-preview-kf";

function usePreviewKeyframes() {
  const injected = useRef(false);
  useEffect(() => {
    if (injected.current || document.getElementById(KF_ID)) return;
    injected.current = true;
    const style = document.createElement("style");
    style.id = KF_ID;
    // Inject both PREVIEW_KEYFRAMES (for animation effects) and POPUP_KF
    style.textContent = PREVIEW_KEYFRAMES + POPUP_KF;
    document.head.appendChild(style);
  }, []);
}

// ═══════════════════════════════════════════════════════════════════
// Runtime-matching easing per particle style
// ═══════════════════════════════════════════════════════════════════

const PARTICLE_EASING = {
  火花: "cubic-bezier(0.22, 1, 0.36, 1)",
  星光: "cubic-bezier(0.22, 1, 0.36, 1)",
  碎屑粒子: "cubic-bezier(0.34, 1.56, 0.64, 1)",
};

function particleEasing(style) {
  return PARTICLE_EASING[style] || "ease-out";
}

// ═══════════════════════════════════════════════════════════════════
// ParticleBurstPreview — CSS @keyframes matching runtime renderParticles()
// ═══════════════════════════════════════════════════════════════════

function ParticleBurstPreview({ config, durationMs }) {
  const allSpecs = buildParticleSpecs(config, 0);
  const specs = allSpecs.length > 12 ? allSpecs.slice(0, 12) : allSpecs;
  const scale = 0.4;
  const durationSec = Math.max(durationMs, 1) / 1000;
  const particleStyle = config.particleStyle || "点状粒子";
  const easing = particleEasing(particleStyle);

  return (
    <>
      {specs.map((spec, i) => {
        const styleProps = getParticleStyleProps(config, i, spec.size);
        const color = getParticleTint(config, i);
        const staggerSec = spec.delay / 1000;
        const rotation = styleProps.rotation || 0;

        return (
          <div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={cssVars({
              width: styleProps.width,
              height: styleProps.height,
              marginLeft: -(styleProps.width / 2),
              marginTop: -(styleProps.height / 2),
              borderRadius: styleProps.borderRadius,
              clipPath: styleProps.clipPath,
              backgroundColor: color,
              boxShadow: styleProps.boxShadow,
              "--p-x": `${spec.x * scale}px`,
              "--p-y": `${spec.y * scale}px`,
              "--p-mx": `${spec.midX * scale}px`,
              "--p-my": `${spec.midY * scale}px`,
              "--p-r": `${rotation}deg`,
              "--p-es": spec.endScale,
              animation: `cdParticle ${durationSec}s ${easing} ${staggerSec}s both`,
            })}
          />
        );
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ParticleOrbitalPreview — continuous orbiting (uses PREVIEW_KEYFRAMES)
// ═══════════════════════════════════════════════════════════════════

function ParticleOrbitalPreview({ config }) {
  const specs = buildOrbitalParticleSpecs(config);
  const clamp = (v) => (v > 50 ? (v > 0 ? 50 : -50) : v);

  return (
    <>
      {specs.map((spec, i) => {
        const styleProps = getParticleStyleProps(config, i, spec.size);
        const color = getParticleTint(config, i);
        const ex = clamp(spec.ex);
        const ey = clamp(spec.ey);
        const delay = -(i / specs.length) * spec.speed;

        return (
          <div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={cssVars({
              width: styleProps.width,
              height: styleProps.height,
              marginLeft: -(styleProps.width / 2),
              marginTop: -(styleProps.height / 2),
              borderRadius: styleProps.borderRadius,
              clipPath: styleProps.clipPath,
              backgroundColor: color,
              boxShadow: styleProps.boxShadow,
              "--orbital-sx": `${spec.sx}px`,
              "--orbital-sy": `${spec.sy}px`,
              "--orbital-ex": `${ex}px`,
              "--orbital-ey": `${ey}px`,
              "--orbital-start-opacity": "0.5",
              "--orbital-peak-opacity": "0.15",
              "--orbital-start-scale": "0.6",
              "--orbital-peak-scale": "1.2",
              animation: `cursorDancePreviewParticleOrbital ${spec.speed}s ease-in-out ${delay}s infinite`,
            })}
          />
        );
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// RipplePreview — CSS @keyframes matching runtime renderRipple()
// ═══════════════════════════════════════════════════════════════════

function RipplePreview({ config, durationMs }) {
  const specs = buildRippleSpecs(config);
  const color = config.rippleColor || "#F59E0B";
  const durationSec = Math.max(durationMs, 1) / 1000;
  const lineWidth = config.rippleLineWidth || 2;
  const easing = getAnimationEasingCss(config.rippleEasing || "缓出");

  return (
    <>
      {specs.map((spec, i) => {
        // runtime opacity curve:
        //   filled:   start = layerOpacity * 0.84,  mid = layerOpacity * 0.42
        //   outline:  start = layerOpacity * 0.46,  mid = layerOpacity * 0.22
        const startOp = spec.filled ? spec.opacity * 0.84 : spec.opacity * 0.46;
        const midOp = spec.filled ? spec.opacity * 0.42 : spec.opacity * 0.22;

        return (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={cssVars({
              width: spec.size,
              height: spec.size,
              marginLeft: -(spec.size / 2),
              marginTop: -(spec.size / 2),
              border: spec.filled ? "none" : `${lineWidth}px solid ${hexToRgba(color, spec.opacity)}`,
              background: spec.filled
                ? `radial-gradient(circle, ${hexToRgba(color, spec.opacity * 0.34)} 0%, ${hexToRgba(color, spec.opacity * 0.16)} 56%, transparent 100%)`
                : "none",
              boxShadow: spec.filled ? `inset 0 0 0 1px ${hexToRgba(color, spec.opacity * 0.22)}` : "none",
              "--r-so": startOp,
              "--r-mo": midOp,
              "--r-from": spec.scaleFrom,
              "--r-mid": spec.scaleMid,
              "--r-to": spec.scaleTo,
              animation: `cdRipple ${durationSec}s ${easing} ${spec.delay / 1000}s both`,
            })}
          />
        );
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TextPreview — CSS @keyframes matching runtime renderText()
// ═══════════════════════════════════════════════════════════════════

function TextPreview({ config, durationMs, burstIndex }) {
  const textConfig = config;
  const durationSec = Math.max(durationMs, 1) / 1000;
  const runIndex = burstIndex;
  const content = getPreviewText(config, runIndex);
  const color = textConfig.textColor || "#ec4899";
  const size = Math.min(textConfig.fontSize || 22, 30);
  const truncated = content.length > 8 ? content.slice(0, 8) + "…" : content;

  return (
    <span
      className="font-bold leading-none text-center pointer-events-none"
      style={cssVars({
        color,
        fontSize: size,
        // position at center via absolute; cdText keyframe uses -50% for centering
        position: "absolute",
        left: "50%",
        top: "50%",
        animation: `cdText ${durationSec}s ${getAnimationEasingCss(textConfig.textEasing)} 0s both`,
      })}
    >
      {truncated}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// AnimationPreview — CSS @keyframes (from PREVIEW_KEYFRAMES)
// ═══════════════════════════════════════════════════════════════════

function AnimationPreview({ config }) {
  const visProps = getAnimationVisualProps(config);
  const animConfig = config;
  const duration = Math.min(animConfig.animationDuration || 720, 1400) / 1000;
  const easing = getAnimationEasingCss(animConfig.animationEasing || "缓出");
  const style = animConfig.animationStyle || "聚焦脉冲";
  const scaleFactor = Math.max(0.5, (animConfig.animationScale || 100) / 100);
  const kfName = getAnimationKeyframeName(style);

  return (
    <div
      className="absolute left-1/2 top-1/2 pointer-events-none"
      style={cssVars({
        width: 40 * scaleFactor,
        height: 40 * scaleFactor,
        marginLeft: -(20 * scaleFactor),
        marginTop: -(20 * scaleFactor),
        borderRadius: visProps.borderRadius,
        background: visProps.background,
        clipPath: visProps.clipPath,
        boxShadow: visProps.boxShadow,
        "--anim-opacity": Math.max(0.18, (animConfig.animationOpacity || 100) / 100),
        animation: `${kfName} ${duration}s ${easing} 0s infinite`,
      })}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════
// SoundIndicator — decorative audio bars (Framer Motion)
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
          style={{ width: 2, height: bar.height, backgroundColor: accent }}
          animate={{ scaleY: [1, 1.8, 1], opacity: [0.35, 0.7, 0.35] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: bar.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CursorGlowIndicator — decorative glow ring (Framer Motion)
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
// AnimatedPreview — orchestrator
// ═══════════════════════════════════════════════════════════════════

export default function AnimatedPreview({ actionConfig, accent }) {
  usePreviewKeyframes();

  const cfg = actionConfig || {};
  const hasParticle = cfg.particle;
  const hasRipple = cfg.ripple;
  const hasText = cfg.textEnabled && cfg.textContent;
  const hasSound = cfg.sound;
  const hasCursorGlow = cfg.cursorGlowColor?.trim();
  const hasAnimation = cfg.animationEnabled;
  const hasOrbital = cfg.particleMotionMode === "orbital";
  const hasAny = hasParticle || hasRipple || hasText;

  const particleDuration = Math.min(cfg.particleDuration || 780, 1200);
  const rippleDuration = Math.min(cfg.rippleDuration || 860, 1400);
  const textDuration = Math.min(cfg.textDuration || 1000, 2000);
  const maxStagger = ((cfg.particleStagger ?? 26) * 11) || 300;
  const cycleMs = Math.max(particleDuration + maxStagger, rippleDuration, textDuration) + 800;

  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setBurstKey((k) => k + 1), cycleMs);
    return () => clearInterval(timer);
  }, [cycleMs]);

  if (!hasAny) return null;

  return (
    <div className="relative flex items-center justify-center size-full">
      {hasAnimation && <AnimationPreview config={cfg} />}
      {hasCursorGlow && <CursorGlowIndicator color={cfg.cursorGlowColor} />}

      {/* Burst group — key remount syncs all effects */}
      <div key={burstKey}>
        {hasRipple && <RipplePreview config={cfg} durationMs={rippleDuration} />}
        {hasParticle && !hasOrbital && <ParticleBurstPreview config={cfg} durationMs={particleDuration} />}
        {hasText && <TextPreview config={cfg} durationMs={textDuration} burstIndex={burstKey} />}
      </div>

      {hasParticle && hasOrbital && <ParticleOrbitalPreview config={cfg} />}
      {hasSound && <SoundIndicator accent={accent} />}
    </div>
  );
}
