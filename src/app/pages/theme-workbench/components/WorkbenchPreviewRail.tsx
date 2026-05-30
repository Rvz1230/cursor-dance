import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MousePointerClick, Pause, Play, RotateCcw, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import {
  PREVIEW_KEYFRAMES,
  buildOrbitalParticleSpecs,
  buildParticleSpecs,
  buildRippleSpecs,
  getAnimationEasingCss,
  getAnimationKeyframeName,
  getAnimationVisualProps,
  getParticleStyleProps,
  getParticleTint,
  getPreviewAnimationStyle,
  getPreviewImageStyle,
  getPreviewLoopDelay,
  getPreviewSoundFile,
  getPreviewText,
  getTextFontFamilyValue,
  getPreviewTriggerSummary,
  getTextShadowValue,
  getTextWeightValue,
  hexToRgba,
} from "../lib/preview";
import { useTimelineDrag } from "../lib/useTimelineDrag";
import {
  getActionAnimationConfig,
  getActionAudioConfig,
  getActionCursorFeedbackConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
} from "../model/workbenchSchema";
import { Panel } from "./WorkbenchControls";
import { AtmosphereStagePreview } from "./AtmosphereStagePreview";

function scalePreviewTime(value, playbackSpeed) {
  return Math.max(1, Math.round(value / playbackSpeed));
}

function formatPlaybackSpeed(value) {
  return `${Number(value).toFixed(value % 1 === 0 ? 0 : 1)}x`;
}

function buildOutputTags({ textConfig, particleConfig, rippleConfig, audioConfig, animationConfig, imageConfig, config }) {
  const tags = [];
  if (textConfig.textEnabled) tags.push({ id: "card-text", label: "飘字" });
  if (rippleConfig.ripple) tags.push({ id: "card-ripple", label: "波纹" });
  if (particleConfig.particle) tags.push({ id: "card-particle", label: "粒子" });
  if (audioConfig.sound) tags.push({ id: "card-audio", label: "音效" });
  if (animationConfig.animationEnabled) tags.push({ id: "card-animation", label: "动画" });
  if (imageConfig.imageEnabled && imageConfig.imageDataUrl) tags.push({ id: "card-image", label: "贴纸" });
  if (config.cursorOverride && config.cursorOverride !== "跟随当前状态") tags.push({ id: "card-cursor", label: "光标" });
  return tags;
}

function getCursorOverrideProps(cursorOverride) {
  if (cursorOverride === "木鱼（增强态）") return { text: "击", background: "radial-gradient(circle at 35% 35%, rgba(253,224,71,0.95), rgba(180,83,9,0.94))", borderRadius: "999px" };
  if (cursorOverride === "木鱼（按压态）") return { text: "压", background: "radial-gradient(circle at 35% 35%, rgba(251,191,36,0.92), rgba(146,64,14,0.96))", borderRadius: "38% 38% 58% 58% / 42% 42% 56% 56%" };
  if (cursorOverride === "木鱼（继承默认）") return { text: "咚", background: "radial-gradient(circle at 35% 35%, rgba(252,211,77,0.94), rgba(180,83,9,0.92))", borderRadius: "999px" };
  return null;
}

function PreviewEffects({
  disabled,
  config,
  runId,
  comboIndex,
  actionId,
  textConfig,
  particleConfig,
  rippleConfig,
  animationConfig,
  imageConfig,
  playbackSpeed,
  textDelay,
  rippleDelay,
  particleDelay,
  animationDelay,
  imageDelay,
}) {
  const accentText = getPreviewText(config, comboIndex, actionId);
  const isOrbital = particleConfig.particleMotionMode === "orbital";
  const particles = useMemo(() => isOrbital ? buildOrbitalParticleSpecs(config) : buildParticleSpecs(config, runId), [config, runId, isOrbital]);
  const ripples = useMemo(() => buildRippleSpecs(config), [config]);
  const animationStyle = getPreviewAnimationStyle(config);
  const imageStyle = getPreviewImageStyle(config);
  const animVisual = useMemo(() => getAnimationVisualProps(config), [config]);
  const animKeyframe = getAnimationKeyframeName(animationConfig.animationStyle || "聚焦脉冲");

  if (disabled) return null;

  return (
    <>
      {rippleConfig.ripple
        ? ripples.map((ripple, index) => (
            <div
              key={`ripple-${runId}-${index}`}
              className="absolute left-1/2 top-1/2 rounded-full border"
              style={{
                width: `${ripple.size}px`,
                height: `${ripple.size}px`,
                borderWidth: ripple.filled ? 0 : `${rippleConfig.rippleLineWidth}px`,
                borderColor: ripple.filled ? "transparent" : hexToRgba(rippleConfig.rippleColor || "#34D399", ripple.opacity),
                background: ripple.filled
                  ? `radial-gradient(circle, ${hexToRgba(rippleConfig.rippleColor || "#34D399", ripple.opacity * 0.34)} 0%, ${hexToRgba(rippleConfig.rippleColor || "#34D399", ripple.opacity * 0.16)} 56%, ${hexToRgba(rippleConfig.rippleColor || "#34D399", 0)} 100%)`
                  : "transparent",
                boxShadow: ripple.filled ? `0 0 0 1px ${hexToRgba(rippleConfig.rippleColor || "#34D399", ripple.opacity * 0.22)} inset` : undefined,
                "--ripple-from": ripple.scaleFrom,
                "--ripple-mid": ripple.scaleMid,
                "--ripple-to": ripple.scaleTo,
                animation: `cursorDancePreviewRipple ${scalePreviewTime(rippleConfig.rippleDuration, playbackSpeed)}ms ${getAnimationEasingCss(rippleConfig.rippleEasing)} ${scalePreviewTime(rippleDelay + ripple.delay, playbackSpeed)}ms both`,
              }}
            />
          ))
        : null}

      {particleConfig.particle && !isOrbital
        ? particles.map((particle, index) => {
            const shape = getParticleStyleProps(config, index, particle.size);
            const style = particleConfig.particleStyle || "点状粒子";
            const easing = style === "火花" || style === "星光"
              ? "cubic-bezier(0.22, 1, 0.36, 1)"
              : style === "碎屑粒子"
                ? "cubic-bezier(0.34, 1.56, 0.64, 1)"
                : "ease-out";
            const mainParticle = (
              <div
                key={`particle-${runId}-${index}`}
                className="absolute left-1/2 top-1/2"
                style={{
                  width: `${shape.width}px`,
                  height: `${shape.height}px`,
                  borderRadius: shape.borderRadius,
                  backgroundColor: getParticleTint(config, index),
                  boxShadow: shape.boxShadow,
                  clipPath: shape.clipPath || undefined,
                  "--particle-x": `${particle.x}px`,
                  "--particle-y": `${particle.y}px`,
                  "--particle-mid-x": `${particle.midX}px`,
                  "--particle-mid-y": `${particle.midY}px`,
                  "--particle-rotation": `${shape.rotation}deg`,
                  "--particle-end-scale": particle.endScale,
                  animation: `cursorDancePreviewParticle ${scalePreviewTime(particleConfig.particleDuration, playbackSpeed)}ms ${easing} ${scalePreviewTime(particleDelay + particle.delay, playbackSpeed)}ms both`,
                }}
              />
            );

            if (!particleConfig.particleTrail || index % 3 !== 0) return mainParticle;

            const trailElements = [1, 2].map((t) => {
              const trailScale = 1 - t * 0.32;
              const trailOpacity = Math.max(0.12, 0.4 - t * 0.14);
              return (
                <div
                  key={`particle-trail-${runId}-${index}-${t}`}
                  className="absolute left-1/2 top-1/2"
                  style={{
                    width: `${shape.width * trailScale}px`,
                    height: `${shape.height * trailScale}px`,
                    borderRadius: shape.borderRadius,
                    clipPath: shape.clipPath || undefined,
                    backgroundColor: getParticleTint(config, index + t),
                    boxShadow: shape.boxShadow,
                    opacity: trailOpacity,
                    "--particle-x": `${particle.x * 0.6}px`,
                    "--particle-y": `${particle.y * 0.6}px`,
                    "--particle-mid-x": `${particle.x * 0.24}px`,
                    "--particle-mid-y": `${particle.y * 0.24}px`,
                    "--particle-rotation": `${shape.rotation}deg`,
                    "--particle-end-scale": "0.44",
                    animation: `cursorDancePreviewParticle ${scalePreviewTime(particleConfig.particleDuration * 0.8, playbackSpeed)}ms ease-out ${scalePreviewTime(particleDelay + particle.delay + t * 40, playbackSpeed)}ms both`,
                  }}
                />
              );
            });

            return [mainParticle, ...trailElements];
          })
        : null}

      {particleConfig.particle && isOrbital
        ? particles.map((orbital, index) => {
            const shape = getParticleStyleProps(config, index, orbital.size);
            const style = particleConfig.particleStyle || "点状粒子";
            return (
              <div
                key={`orbital-${runId}-${index}`}
                className="absolute left-1/2 top-1/2"
                style={{
                  width: `${shape.width}px`,
                  height: `${shape.height}px`,
                  borderRadius: shape.borderRadius,
                  backgroundColor: getParticleTint(config, index),
                  boxShadow: shape.boxShadow,
                  clipPath: shape.clipPath || undefined,
                  "--orbital-sx": `${orbital.sx}px`,
                  "--orbital-sy": `${orbital.sy}px`,
                  "--orbital-ex": `${orbital.ex}px`,
                  "--orbital-ey": `${orbital.ey}px`,
                  "--orbital-start-opacity": "0.5",
                  "--orbital-peak-opacity": "0.15",
                  "--orbital-start-scale": "0.6",
                  "--orbital-peak-scale": "1.2",
                  animation: `cursorDancePreviewParticleOrbital ${scalePreviewTime(orbital.speed * 1000, playbackSpeed)}ms ease-in-out ${orbital.delay}ms infinite`,
                }}
              />
            );
          })
        : null}

      {textConfig.textEnabled ? (
        <div className="absolute left-1/2 top-1/2" style={{ marginLeft: `${textConfig.textOffsetX}px`, marginTop: `${textConfig.textOffsetY}px` }}>
          <div
            key={`text-${runId}`}
            className="whitespace-nowrap text-center tabular-nums"
            style={{
              color: hexToRgba(textConfig.textColor || "#ec4899", (textConfig.textOpacity || 100) / 100),
              fontFamily: getTextFontFamilyValue(textConfig.textFontFamily),
              fontSize: `${textConfig.fontSize || 22}px`,
              fontWeight: getTextWeightValue(textConfig.textWeight),
              textShadow: getTextShadowValue(config),
              WebkitTextStroke: textConfig.textOutlineWidth ? `${textConfig.textOutlineWidth}px ${hexToRgba("#FFFFFF", 0.82)}` : undefined,
              animation: `cursorDancePreviewFloat ${scalePreviewTime(textConfig.textDuration || 950, playbackSpeed)}ms ${getAnimationEasingCss(textConfig.textEasing)} ${scalePreviewTime(textDelay, playbackSpeed)}ms forwards`,
            }}
          >
            {accentText}
          </div>
        </div>
      ) : null}

      {animationConfig.animationEnabled ? (
        <div
          key={`animation-${runId}`}
          className="absolute left-1/2 top-1/2"
          style={{
            ...animationStyle,
            "--anim-opacity": animationStyle.opacity,
            animation: `${animKeyframe} ${scalePreviewTime(animationConfig.animationDuration, playbackSpeed)}ms ${getAnimationEasingCss(animationConfig.animationEasing)} ${scalePreviewTime(animationDelay, playbackSpeed)}ms forwards`,
            borderRadius: animVisual.borderRadius,
            background: animVisual.background,
            clipPath: animVisual.clipPath || undefined,
            boxShadow: animVisual.boxShadow || undefined,
            border: animVisual.border || undefined,
          }}
        />
      ) : null}

      {imageConfig.imageEnabled && imageConfig.imageDataUrl ? (
        <div
          key={`image-${runId}`}
          className="absolute left-1/2 top-1/2"
          style={{
            ...imageStyle,
            animation: `cursorDancePreviewImage ${scalePreviewTime(imageConfig.imageDuration, playbackSpeed)}ms cubic-bezier(0.22, 1, 0.36, 1) ${scalePreviewTime(imageDelay, playbackSpeed)}ms forwards`,
          }}
        >
          <img
            src={imageConfig.imageDataUrl}
            alt="贴纸预览"
            className="block h-full w-full object-contain drop-shadow-[0_12px_24px_rgba(15,23,42,0.16)]"
          />
        </div>
      ) : null}

      {(() => {
        const cursorFeedbackConfig = getActionCursorFeedbackConfig(config);
        const cursorProps = getCursorOverrideProps(cursorFeedbackConfig.cursorOverride);
        if (!cursorProps) return null;
        const cursorSize = cursorFeedbackConfig.cursorSize || 48;
        return (
          <div
            key={`cursor-${runId}`}
            className="absolute left-1/2 top-1/2 flex items-center justify-center"
            style={{
              width: `${cursorSize}px`,
              height: `${cursorSize}px`,
              background: cursorProps.background,
              borderRadius: cursorProps.borderRadius,
              border: cursorProps.borderRadius === "999px" ? "1px solid rgba(255,255,255,0.72)" : undefined,
              boxShadow: "0 14px 34px rgba(15, 23, 42, 0.18)",
              color: "#fff",
              fontSize: `${Math.round(cursorSize * 0.27)}px`,
              fontWeight: 700,
              letterSpacing: "0.04em",
              backdropFilter: "blur(6px)",
              animation: `cursorDancePreviewCursorBounce 260ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
            }}
          >
            {cursorProps.text}
          </div>
        );
      })()}
    </>
  );
}

function buildTimelineTracks({ textConfig, particleConfig, rippleConfig, audioConfig, animationConfig, imageConfig, config }) {
  const tracks = [];
  const textDelay = textConfig.textDelay || 0;
  const rippleDelay = rippleConfig.rippleDelay || 0;
  const particleDelay = particleConfig.particleDelay || 0;
  const animationDelay = animationConfig.animationDelay || 0;
  const imageDelay = imageConfig.imageDelay || 0;
  const soundDelay = audioConfig.soundDelay || 0;

  const ripples = rippleConfig.ripple ? buildRippleSpecs(config) : [];
  const rippleEnd = rippleDelay + ripples.reduce((max, ripple) => Math.max(max, ripple.delay + rippleConfig.rippleDuration), 0);
  const particleEnd = particleConfig.particle
    ? (particleConfig.particleMotionMode === "orbital"
      ? particleDelay + Math.max(particleConfig.particleDuration || 3000, 1000)
      : particleDelay + particleConfig.particleDuration + Math.min(520, Math.max(0, particleConfig.particleCount - 1) * (particleConfig.particleStagger ?? 26)))
    : 0;

  if (textConfig.textEnabled) tracks.push({ id: "text", label: "飘字", tone: "rose", start: textDelay, end: textDelay + textConfig.textDuration, configuredDuration: textConfig.textDuration, markers: [{ label: "出现", at: textDelay }, { label: "峰值", at: textDelay + Math.round(textConfig.textDuration * 0.18) }, { label: "淡出", at: textDelay + textConfig.textDuration }] });
  if (rippleConfig.ripple) tracks.push({ id: "ripple", label: "波纹", tone: "teal", start: rippleDelay, end: rippleEnd, configuredDuration: rippleConfig.rippleDuration, markers: [{ label: "扩散", at: rippleDelay }, { label: "最大", at: rippleEnd }] });
  if (particleConfig.particle) tracks.push({ id: "particle", label: "粒子", tone: "amber", start: particleDelay, end: particleEnd, configuredDuration: particleConfig.particleDuration, markers: [{ label: "喷发", at: particleDelay }, { label: "散开", at: Math.round(particleDelay + (particleEnd - particleDelay) * 0.55) }] });
  if (animationConfig.animationEnabled) tracks.push({ id: "animation", label: "动画", tone: "sky", start: animationDelay, end: animationDelay + animationConfig.animationDuration, configuredDuration: animationConfig.animationDuration, markers: [{ label: "入场", at: animationDelay }, { label: "收束", at: animationDelay + animationConfig.animationDuration }] });
  if (imageConfig.imageEnabled && imageConfig.imageDataUrl) tracks.push({ id: "image", label: "贴纸", tone: "violet", start: imageDelay, end: imageDelay + imageConfig.imageDuration, configuredDuration: imageConfig.imageDuration, markers: [{ label: "弹出", at: imageDelay }, { label: "离场", at: imageDelay + imageConfig.imageDuration }] });
  if (audioConfig.sound) tracks.push({ id: "audio", label: "音效", tone: "slate", start: soundDelay, end: soundDelay + 120, markers: [{ label: "播放", at: soundDelay }] });

  const totalMs = Math.max(820, ...tracks.map((track) => track.end));
  return { tracks, totalMs: Math.ceil(totalMs / 100) * 100 };
}

function getTimelineTone(tone) {
  if (tone === "rose") return { bg: "bg-rose-200", text: "text-rose-600", dot: "bg-rose-500", border: "border-rose-300/60", gradient: "from-rose-200/90 to-rose-300/80" };
  if (tone === "teal") return { bg: "bg-teal-200", text: "text-teal-600", dot: "bg-teal-500", border: "border-teal-300/60", gradient: "from-teal-200/90 to-teal-300/80" };
  if (tone === "amber") return { bg: "bg-amber-200", text: "text-amber-600", dot: "bg-amber-500", border: "border-amber-300/60", gradient: "from-amber-200/90 to-amber-300/80" };
  if (tone === "sky") return { bg: "bg-sky-200", text: "text-sky-600", dot: "bg-sky-500", border: "border-sky-300/60", gradient: "from-sky-200/90 to-sky-300/80" };
  if (tone === "violet") return { bg: "bg-violet-200", text: "text-violet-600", dot: "bg-violet-500", border: "border-violet-300/60", gradient: "from-violet-200/90 to-violet-300/80" };
  return { bg: "bg-slate-200", text: "text-slate-600", dot: "bg-slate-500", border: "border-slate-300/60", gradient: "from-slate-200/90 to-slate-300/80" };
}

const DELAY_FIELD_BY_TRACK = {
  text: "textDelay",
  ripple: "rippleDelay",
  particle: "particleDelay",
  animation: "animationDelay",
  image: "imageDelay",
  audio: "soundDelay",
};

const DURATION_FIELD_BY_TRACK = {
  text: "textDuration",
  ripple: "rippleDuration",
  particle: "particleDuration",
  animation: "animationDuration",
  image: "imageDuration",
};

const TRACK_DEFAULTS = {
  text: { delay: 0, duration: 1000 },
  ripple: { delay: 0, duration: 820 },
  particle: { delay: 0, duration: 760 },
  animation: { delay: 0, duration: 720 },
  image: { delay: 0, duration: 780 },
  audio: { delay: 0 },
};

function buildTickMarks(totalMs) {
  const step = totalMs <= 1200 ? 100 : totalMs <= 2400 ? 200 : 500;
  const ticks = [];
  for (let t = 0; t <= totalMs; t += step) {
    ticks.push(t);
  }
  if (ticks[ticks.length - 1] !== totalMs) ticks.push(totalMs);
  return ticks;
}

function buildMinorTicks(totalMs) {
  const step = totalMs <= 1200 ? 100 : totalMs <= 2400 ? 200 : 500;
  const minorStep = step / 5;
  const ticks = [];
  for (let t = minorStep; t < totalMs; t += minorStep) {
    if (t % step !== 0) ticks.push(t);
  }
  return ticks;
}

function formatTickMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 1 : 2)}s`;
}

function TrackHandle({ side, track, totalMs, pxPerMs, updateActionConfig }) {
  const isLeft = side === "left";
  const delayField = DELAY_FIELD_BY_TRACK[track.id];
  const durationField = DURATION_FIELD_BY_TRACK[track.id];

  const commitRef = useRef(null);
  commitRef.current = useCallback(
    (deltaMs) => {
      if (isLeft && delayField) {
        const newDelay = Math.max(0, track.start + deltaMs);
        const patch = { [delayField]: newDelay };
        if (durationField) {
          patch[durationField] = Math.max(40, (track.configuredDuration ?? (track.end - track.start)) - deltaMs);
        }
        updateActionConfig(patch);
      } else if (!isLeft && durationField) {
        const baseDuration = track.configuredDuration ?? (track.end - track.start);
        updateActionConfig({ [durationField]: Math.max(40, baseDuration + deltaMs) });
      }
    },
    [isLeft, delayField, durationField, track.start, track.end, track.configuredDuration, updateActionConfig]
  );

  const { isDragging, tooltipMs, handlers } = useTimelineDrag({
    mode: isLeft ? "resize-left" : "resize-right",
    pxPerMs,
    snapMs: 20,
    minMs: isLeft ? -track.start : -((track.configuredDuration ?? (track.end - track.start)) - 40),
    onCommit: (deltaMs) => commitRef.current?.(deltaMs),
  });

  const posPct = `${(isLeft ? track.start : track.end) / totalMs * 100}%`;

  return (
    <>
      <div
        className={cn(
          "absolute top-0 z-10 h-full w-[9px] -translate-x-1/2 cursor-col-resize rounded-sm transition-[background-color,box-shadow] duration-150",
          isDragging
            ? "bg-slate-400/50 shadow-[0_0_6px_rgba(100,116,139,0.3)]"
            : "bg-slate-300/20 hover:bg-slate-300/50"
        )}
        style={{ left: posPct }}
        {...handlers}
      >
        <div className={cn(
          "absolute inset-y-2 left-1/2 flex -translate-x-1/2 flex-col justify-center gap-[2px] transition-opacity duration-150",
          isDragging ? "opacity-100" : "opacity-30 group-hover:opacity-80"
        )}>
          <span className="block h-[2px] w-[3px] rounded-full bg-slate-500" />
          <span className="block h-[2px] w-[3px] rounded-full bg-slate-500" />
          <span className="block h-[2px] w-[3px] rounded-full bg-slate-500" />
        </div>
      </div>
      {isDragging && tooltipMs !== null ? (
        <div
          className="absolute -top-8 z-30 -translate-x-1/2 rounded-lg bg-slate-900 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white shadow-lg pointer-events-none whitespace-nowrap"
          style={{ left: posPct }}
        >
          {isLeft
            ? `${Math.max(0, track.start + tooltipMs)}ms`
            : `${track.start + (track.configuredDuration ?? (track.end - track.start)) + tooltipMs}ms`}
        </div>
      ) : null}
    </>
  );
}

function TimelineTrackRow({ track, totalMs, pxPerMs, updateActionConfig, isEven }) {
  const leftPct = `${(track.start / totalMs) * 100}%`;
  const widthPct = `${Math.max(0.5, ((track.end - track.start) / totalMs) * 100)}%`;
  const tone = getTimelineTone(track.tone);
  const delayField = DELAY_FIELD_BY_TRACK[track.id];
  const minorTicks = useMemo(() => buildMinorTicks(totalMs), [totalMs]);

  const commitRef = useRef(null);
  commitRef.current = useCallback(
    (deltaMs) => {
      if (delayField) {
        const newDelay = Math.max(0, track.start + deltaMs);
        updateActionConfig({ [delayField]: newDelay });
      }
    },
    [delayField, track.start, updateActionConfig]
  );

  const { isDragging: isMoving, tooltipMs, handlers: moveHandlers } = useTimelineDrag({
    mode: "move",
    pxPerMs,
    snapMs: 20,
    minMs: -track.start,
    onCommit: (deltaMs) => commitRef.current?.(deltaMs),
  });

  const defaults = TRACK_DEFAULTS[track.id];
  const isDirty = defaults && (track.start !== defaults.delay || (defaults.duration && track.configuredDuration !== defaults.duration));

  return (
    <div className={cn(
      "group relative grid grid-cols-[42px_minmax(0,1fr)] items-center gap-2.5 py-1 -mx-1 px-1 rounded-lg transition-colors",
      isEven ? "bg-slate-50/60" : "bg-white"
    )}>
      <div className="flex items-center gap-1.5">
        <span className={cn("size-1.5 rounded-full shrink-0", tone.dot)} />
        <span className={cn("text-[11px] font-semibold select-none truncate", tone.text)}>{track.label}</span>
        {isDirty ? (
          <button
            type="button"
            className="hidden group-hover:flex size-4 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-slate-700 transition-colors shrink-0"
            title="重置延迟和时长"
            onClick={(e) => {
              e.stopPropagation();
              const patch = {};
              if (delayField && defaults) patch[delayField] = defaults.delay;
              if (DURATION_FIELD_BY_TRACK[track.id] && defaults?.duration) patch[DURATION_FIELD_BY_TRACK[track.id]] = defaults.duration;
              updateActionConfig(patch);
            }}
          >
            <X className="size-2.5" />
          </button>
        ) : null}
      </div>

      <div className={cn("relative h-7 rounded-lg border", isEven ? "bg-slate-100/50 border-slate-200/70" : "bg-slate-100/80 border-slate-200/60")}>
        {/* minor grid lines */}
        {minorTicks.map((tick) => (
          <div
            key={`grid-minor-${track.id}-${tick}`}
            className="absolute inset-y-0 w-px bg-slate-200/50 pointer-events-none"
            style={{ left: `${(tick / totalMs) * 100}%` }}
          />
        ))}
        {/* major grid lines */}
        {buildTickMarks(totalMs).map((tick) => (
          <div
            key={`grid-${track.id}-${tick}`}
            className="absolute inset-y-0 w-px bg-slate-300/70 pointer-events-none"
            style={{ left: `${(tick / totalMs) * 100}%` }}
          />
        ))}

        {/* left resize handle — only if track has a delay field */}
        {DELAY_FIELD_BY_TRACK[track.id] ? (
          <TrackHandle side="left" track={track} totalMs={totalMs} pxPerMs={pxPerMs} updateActionConfig={updateActionConfig} />
        ) : null}

        {/* right resize handle — only if track has a duration field */}
        {DURATION_FIELD_BY_TRACK[track.id] ? (
          <TrackHandle side="right" track={track} totalMs={totalMs} pxPerMs={pxPerMs} updateActionConfig={updateActionConfig} />
        ) : null}

        {/* main block (draggable middle) — only if track has a delay field */}
        {DELAY_FIELD_BY_TRACK[track.id] ? (
        <div
          className={cn(
            "absolute top-1/2 h-5 -translate-y-1/2 rounded-md transition-all duration-150",
            "bg-gradient-to-b border shadow-sm",
            tone.gradient, tone.border,
            isMoving
              ? "shadow-md ring-1 ring-slate-400/50 cursor-grabbing z-10 brightness-95 scale-y-110"
              : "cursor-grab group-hover:shadow-md group-hover:brightness-100"
          )}
          style={{ left: leftPct, width: widthPct }}
          {...moveHandlers}
          role="slider"
          aria-label={`${track.label} 时间块`}
          aria-valuemin={0}
          aria-valuemax={totalMs}
          aria-valuenow={track.start}
          tabIndex={0}
        >
          {/* duration label inside block */}
          {track.configuredDuration && (track.end - track.start) / totalMs > 0.18 ? (
            <span className={cn(
              "absolute inset-0 flex items-center justify-center text-[9px] font-semibold tabular-nums select-none pointer-events-none",
              tone.text
            )}>
              {track.configuredDuration}ms
            </span>
          ) : null}
        </div>
        ) : null}
      </div>
    </div>
  );
}

function InteractiveTimeline({ tracks, totalMs, updateActionConfig }) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const tickMarks = useMemo(() => buildTickMarks(totalMs), [totalMs]);
  const minorTicks = useMemo(() => buildMinorTicks(totalMs), [totalMs]);
  const pxPerMs = containerWidth > 0 ? containerWidth / totalMs : 0;

  const hasAnyDirty = tracks.some((t) => {
    const d = TRACK_DEFAULTS[t.id];
    return d && (t.start !== d.delay || (d.duration && t.configuredDuration !== d.duration));
  });

  const resetAll = useCallback(() => {
    const patch = {};
    for (const t of tracks) {
      const d = TRACK_DEFAULTS[t.id];
      if (!d) continue;
      const df = DELAY_FIELD_BY_TRACK[t.id];
      const uf = DURATION_FIELD_BY_TRACK[t.id];
      if (df) patch[df] = d.delay;
      if (uf && d.duration) patch[uf] = d.duration;
    }
    if (Object.keys(patch).length) updateActionConfig(patch);
  }, [tracks, updateActionConfig]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm select-none">
      {/* header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">时间轴编排</span>
          <span className="text-[10px] tabular-nums text-slate-400 bg-slate-100 rounded-md px-1.5 py-0.5">{totalMs}ms</span>
        </div>
        <div className="flex items-center gap-1.5">
          {hasAnyDirty ? (
            <button
              type="button"
              className="rounded-md px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              onClick={resetAll}
            >
              重置全部
            </button>
          ) : null}
          <span className="text-[10px] text-slate-400 hidden sm:inline">拖拽边缘调整时长 · 拖拽中部调整延迟</span>
        </div>
      </div>

      {/* ruler */}
      <div className="relative mx-4 mt-2.5 h-6">
        {/* minor ticks */}
        {minorTicks.map((tick) => (
          <div
            key={`ruler-minor-${tick}`}
            className="absolute bottom-0 h-2 w-px bg-slate-300/60"
            style={{ left: `${(tick / totalMs) * 100}%`, transform: "translateX(-50%)" }}
          />
        ))}
        {/* major ticks */}
        {tickMarks.map((tick) => (
          <div
            key={`ruler-${tick}`}
            className="absolute bottom-0 flex flex-col items-center"
            style={{ left: `${(tick / totalMs) * 100}%`, transform: tick === 0 ? "translateX(0)" : tick === totalMs ? "translateX(-100%)" : "translateX(-50%)" }}
          >
            <div className="h-3.5 w-px bg-slate-400" />
            <span className="mt-0.5 text-[9px] tabular-nums text-slate-500 leading-none">
              {formatTickMs(tick)}
            </span>
          </div>
        ))}
      </div>

      {/* tracks */}
      <div ref={containerRef} className="px-3 pb-3 pt-2 space-y-1">
        {tracks.length ? tracks.map((track, i) => (
          <TimelineTrackRow
            key={track.id}
            track={track}
            totalMs={totalMs}
            pxPerMs={pxPerMs}
            updateActionConfig={updateActionConfig}
            isEven={i % 2 === 0}
          />
        )) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-3 text-xs text-slate-500 text-center">
            当前动作没有开启可播放的视觉效果，在左侧配置面板中开启至少一项效果。
          </div>
        )}
      </div>
    </div>
  );
}

function SimplePreviewStage({ config, disabled, runId, comboIndex, actionId, outputs, playbackSpeed, updateActionConfig, atmosphere }) {
  const textConfig = useMemo(() => getActionTextConfig(config), [config]);
  const particleConfig = useMemo(() => getActionParticleConfig(config), [config]);
  const rippleConfig = useMemo(() => getActionRippleConfig(config), [config]);
  const audioConfig = useMemo(() => getActionAudioConfig(config), [config]);
  const animationConfig = useMemo(() => getActionAnimationConfig(config), [config]);
  const imageConfig = useMemo(() => getActionImageConfig(config), [config]);
  const timeline = useMemo(
    () => buildTimelineTracks({ textConfig, particleConfig, rippleConfig, audioConfig, animationConfig, imageConfig, config }),
    [textConfig, particleConfig, rippleConfig, audioConfig, animationConfig, imageConfig, config]
  );

  const textDelay = textConfig.textDelay || 0;
  const rippleDelay = rippleConfig.rippleDelay || 0;
  const particleDelay = particleConfig.particleDelay || 0;
  const animationDelay = animationConfig.animationDelay || 0;
  const imageDelay = imageConfig.imageDelay || 0;
  const soundDelay = audioConfig.soundDelay || 0;

  // 鼠标追踪
  const [pointer, setPointer] = useState({ x: 0, y: 0, inside: false });
  const stageRef = useRef(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const cursorEnabled = atmosphere?.mode === "creative-mouse";

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setStageSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function onPointerMove(e) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPointer({ x: e.clientX - rect.left, y: e.clientY - rect.top, inside: true });
  }

  function onPointerLeave() {
    setPointer((prev) => ({ ...prev, inside: false }));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div
        ref={stageRef}
        className="relative min-h-[300px] flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white"
        style={{
          minHeight: 320,
          backgroundColor: "#fbfcfe",
          backgroundImage: `
            radial-gradient(circle at 1px 1px, rgba(100, 116, 139, 0.18) 1px, transparent 0),
            linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(248,250,252,0.96) 100%)
          `,
          backgroundSize: "20px 20px, 100% 100%",
          backgroundPosition: "0 0, 0 0",
          cursor: cursorEnabled && pointer.inside ? "none" : undefined,
        }}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <div
          className="pointer-events-none absolute inset-x-8 bottom-8 top-20 rounded-xl border border-slate-200/80"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.24) 100%)",
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-x-5 top-5 flex items-start justify-between gap-3 text-xs text-slate-500">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 text-balance">效果舞台</div>
            <div className="mt-1 text-xs text-slate-500 text-pretty">{getPreviewTriggerSummary(config)}</div>
          </div>
          <div className="flex max-w-[55%] flex-wrap justify-end gap-1.5">
            {outputs.length ? outputs.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => {
                  document.getElementById(tag.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
              >
                {tag.label}
              </button>
            )) : (
              <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">暂无输出</span>
            )}
          </div>
        </div>

        <div className="absolute inset-x-10 bottom-12 h-4 rounded-full bg-slate-200/45" />
        <div className="absolute inset-x-8 bottom-9 h-px bg-slate-300/80" />

        <div className="absolute inset-x-8 bottom-9 top-20 flex items-center justify-center">
          <div className="relative h-0 w-0">
            <PreviewEffects
              disabled={disabled}
              config={config}
              runId={runId}
              comboIndex={comboIndex}
              actionId={actionId}
              textConfig={textConfig}
              particleConfig={particleConfig}
              rippleConfig={rippleConfig}
              animationConfig={animationConfig}
              imageConfig={imageConfig}
              playbackSpeed={playbackSpeed}
              textDelay={textDelay}
              rippleDelay={rippleDelay}
              particleDelay={particleDelay}
              animationDelay={animationDelay}
              imageDelay={imageDelay}
            />
          </div>
        </div>

        {/* 氛围动效预览层 */}
        <AtmosphereStagePreview
          atmosphere={atmosphere}
          pointerX={pointer.x}
          pointerY={pointer.y}
          isPointerInside={pointer.inside}
          stageWidth={stageSize.w}
          stageHeight={stageSize.h}
        />

        {audioConfig.sound && !disabled ? (
          <div className="absolute right-5 top-20 flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-white/95 px-2 py-1 text-xs text-slate-600 shadow-sm">
            <Volume2 className="size-3 text-emerald-700" aria-hidden="true" />
            <span className="max-w-[88px] truncate">{getPreviewSoundFile(config)}</span>
            <div className="flex items-end gap-1" aria-hidden="true">
              {[0, 1, 2, 3].map((bar) => (
                <span
                  key={`bar-${runId}-${bar}`}
                  className="block w-0.5 rounded-full bg-emerald-500/70"
                  style={{
                    height: `${7 + bar * 2}px`,
                    animation: `cursorDancePreviewBars ${scalePreviewTime(480, playbackSpeed)}ms ease-out ${scalePreviewTime(soundDelay + bar * 60, playbackSpeed)}ms 2`,
                    transformOrigin: "bottom",
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <InteractiveTimeline tracks={timeline.tracks} totalMs={timeline.totalMs} updateActionConfig={updateActionConfig} />
    </div>
  );
}

export function WorkbenchPreviewRail({ actionLabel, actionId = "leftClick", config, disabled = false, previewMode = false, updateActionConfig, atmosphere }) {
  const [runId, setRunId] = useState(0);
  const [comboIndex, setComboIndex] = useState(1);
  const [autoPlay, setAutoPlay] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const timerRef = useRef(null);
  const lastComboFireRef = useRef(0);
  const textConfig = useMemo(() => getActionTextConfig(config), [config]);
  const particleConfig = useMemo(() => getActionParticleConfig(config), [config]);
  const rippleConfig = useMemo(() => getActionRippleConfig(config), [config]);
  const audioConfig = useMemo(() => getActionAudioConfig(config), [config]);
  const animationConfig = useMemo(() => getActionAnimationConfig(config), [config]);
  const imageConfig = useMemo(() => getActionImageConfig(config), [config]);
  const outputs = useMemo(
    () => buildOutputTags({ textConfig, particleConfig, rippleConfig, audioConfig, animationConfig, imageConfig, config }),
    [textConfig, particleConfig, rippleConfig, audioConfig, animationConfig, imageConfig, config]
  );
  const loopDelay = scalePreviewTime(getPreviewLoopDelay(config), playbackSpeed);
  const comboWindowMs = scalePreviewTime(textConfig.comboWindowMs || 900, playbackSpeed);
  const displayComboIndex = textConfig.comboEnabled ? comboIndex : 1;

  const replay = useCallback(() => {
    if (disabled) return;
    const now = Date.now();
    setRunId((v) => (v + 1) % 1000000);
    setComboIndex((prev) => {
      if (now - lastComboFireRef.current <= comboWindowMs) return prev + 1;
      return 1;
    });
    lastComboFireRef.current = now;
  }, [disabled, comboWindowMs]);

  const prevConfigRef = useRef(null);

  useEffect(() => {
    if (disabled) return undefined;
    const configFingerprint = JSON.stringify(config);
    if (prevConfigRef.current === configFingerprint) return undefined;
    prevConfigRef.current = configFingerprint;
    setRunId((value) => (value + 1) % 1000000);
    return undefined;
  }, [actionLabel, config, disabled]);

  useEffect(() => {
    if (disabled || !autoPlay) return undefined;
    lastComboFireRef.current = 0;
    setComboIndex(1);

    const tick = () => {
      const now = Date.now();
      setRunId((value) => (value + 1) % 1000000);
      setComboIndex((prev) => {
        if (lastComboFireRef.current > 0 && now - lastComboFireRef.current <= comboWindowMs) return prev + 1;
        return 1;
      });
      lastComboFireRef.current = now;
    };

    timerRef.current = window.setInterval(tick, loopDelay);
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoPlay, disabled, loopDelay, comboWindowMs]);

  return (
    <div className="min-h-0 flex-1">
      <style>{PREVIEW_KEYFRAMES}</style>
      <Panel
        title="实时预览"
        icon={MousePointerClick}
        iconTone={previewMode ? "bg-sky-100 text-sky-700" : "bg-slate-950 text-white"}
        className="flex h-full min-h-0 flex-col shadow-sm"
        contentClassName="flex min-h-0 flex-1 flex-col"
        summary={previewMode ? "正在预览 AI 建议" : undefined}
        action={
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button variant="outline" size="icon" className="size-8 rounded-lg" onClick={replay} disabled={disabled} aria-label="重播预览" title="重播">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-lg"
              onClick={() => setAutoPlay((value) => !value)}
              disabled={disabled}
              aria-label={autoPlay ? "暂停自动播放" : "开启自动播放"}
              title={autoPlay ? "暂停" : "播放"}
            >
              {autoPlay ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <div className="ml-1 grid h-8 grid-cols-[auto_72px_auto] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2" aria-label="播放速度">
              <span className="text-xs font-medium text-slate-500">速度</span>
              <input
                type="range"
                min="0.25"
                max="2.5"
                step="0.05"
                value={playbackSpeed}
                disabled={disabled}
                onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
                className="h-1.5 w-full accent-slate-950"
                aria-label="调整播放速度"
              />
              <span className="w-8 text-right text-xs font-semibold tabular-nums text-slate-900">{formatPlaybackSpeed(playbackSpeed)}</span>
            </div>
          </div>
        }
      >
        <SimplePreviewStage config={config} disabled={disabled} runId={runId} comboIndex={displayComboIndex} actionId={actionId} outputs={outputs} playbackSpeed={playbackSpeed} updateActionConfig={updateActionConfig} atmosphere={atmosphere} />
      </Panel>
    </div>
  );
}
