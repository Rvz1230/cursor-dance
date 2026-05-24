import { useEffect, useMemo, useState } from "react";
import { MousePointerClick, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { cn } from "@/components/ui/utils.js";
import {
  PREVIEW_KEYFRAMES,
  buildParticleSpecs,
  buildRippleSpecs,
  getAnimationEasingCss,
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
} from "../lib/preview.js";
import {
  getActionAnimationConfig,
  getActionAudioConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
} from "../model/workbenchSchema.js";
import { Panel, PreviewBadge } from "./WorkbenchControls.jsx";

function scalePreviewTime(value, playbackSpeed) {
  return Math.max(1, Math.round(value / playbackSpeed));
}

function formatPlaybackSpeed(value) {
  return `${Number(value).toFixed(value % 1 === 0 ? 0 : 1)}x`;
}

function buildOutputNames({ textConfig, particleConfig, rippleConfig, audioConfig, animationConfig, imageConfig, config }) {
  const outputs = [];
  if (textConfig.textEnabled) outputs.push("飘字");
  if (rippleConfig.ripple) outputs.push("波纹");
  if (particleConfig.particle) outputs.push("粒子");
  if (audioConfig.sound) outputs.push("音效");
  if (animationConfig.animationEnabled) outputs.push("动画");
  if (imageConfig.imageEnabled && imageConfig.imageDataUrl) outputs.push("贴纸");
  if (config.cursorOverride && config.cursorOverride !== "跟随当前状态") outputs.push("光标");
  return outputs;
}

function PreviewEffects({
  disabledBySite,
  config,
  runId,
  textConfig,
  particleConfig,
  rippleConfig,
  animationConfig,
  imageConfig,
  playbackSpeed,
}) {
  const accentText = getPreviewText(config, runId);
  const particles = useMemo(() => buildParticleSpecs(config, runId), [config, runId]);
  const ripples = useMemo(() => buildRippleSpecs(config), [config]);
  const animationStyle = getPreviewAnimationStyle(config);
  const imageStyle = getPreviewImageStyle(config);

  if (disabledBySite) return null;

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
                borderColor: ripple.filled ? "transparent" : hexToRgba("#34D399", ripple.opacity),
                background: ripple.filled
                  ? `radial-gradient(circle, ${hexToRgba("#6EE7B7", ripple.opacity * 0.34)} 0%, ${hexToRgba("#34D399", ripple.opacity * 0.16)} 56%, ${hexToRgba("#34D399", 0)} 100%)`
                  : "transparent",
                boxShadow: ripple.filled ? `0 0 0 1px ${hexToRgba("#34D399", ripple.opacity * 0.22)} inset` : undefined,
                animation: `cursorDancePreviewRipple ${scalePreviewTime(rippleConfig.rippleDuration, playbackSpeed)}ms ${getAnimationEasingCss(rippleConfig.rippleEasing)} ${scalePreviewTime(ripple.delay, playbackSpeed)}ms forwards`,
              }}
            />
          ))
        : null}

      {particleConfig.particle
        ? particles.map((particle, index) => {
            const shape = getParticleStyleProps(config, index, particle.size);
            return (
              <div
                key={`particle-${runId}-${index}`}
                className="absolute left-1/2 top-1/2"
                style={{
                  width: `${shape.width}px`,
                  height: `${shape.height}px`,
                  borderRadius: shape.borderRadius,
                  backgroundColor: getParticleTint(config, index),
                  boxShadow: shape.boxShadow,
                  "--particle-x": `${particle.x}px`,
                  "--particle-y": `${particle.y}px`,
                  animation: `cursorDancePreviewParticle ${scalePreviewTime(particleConfig.particleDuration, playbackSpeed)}ms ease-out ${scalePreviewTime(particle.delay, playbackSpeed)}ms forwards`,
                  transform: `rotate(${shape.rotation}deg)`,
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
              color: hexToRgba(textConfig.textColor, textConfig.textOpacity / 100),
              fontFamily: getTextFontFamilyValue(textConfig.textFontFamily),
              fontSize: `${textConfig.fontSize}px`,
              fontWeight: getTextWeightValue(textConfig.textWeight),
              textShadow: getTextShadowValue(config),
              WebkitTextStroke: textConfig.textOutlineWidth ? `${textConfig.textOutlineWidth}px ${hexToRgba("#FFFFFF", 0.82)}` : undefined,
              animation: `cursorDancePreviewFloat ${scalePreviewTime(textConfig.textDuration, playbackSpeed)}ms ${getAnimationEasingCss(textConfig.textEasing)} forwards`,
            }}
          >
            {accentText}
          </div>
        </div>
      ) : null}

      {animationConfig.animationEnabled ? (
        <div
          key={`animation-${runId}`}
          className="absolute left-1/2 top-1/2 rounded-full border border-emerald-300/70 bg-emerald-100/60"
          style={{
            ...animationStyle,
            animation: `cursorDancePreviewAnimation ${scalePreviewTime(animationConfig.animationDuration, playbackSpeed)}ms ${getAnimationEasingCss(animationConfig.animationEasing)} forwards`,
          }}
        />
      ) : null}

      {imageConfig.imageEnabled && imageConfig.imageDataUrl ? (
        <div
          key={`image-${runId}`}
          className="absolute left-1/2 top-1/2"
          style={{
            ...imageStyle,
            animation: `cursorDancePreviewImage ${scalePreviewTime(imageConfig.imageDuration, playbackSpeed)}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
          }}
        >
          <img
            src={imageConfig.imageDataUrl}
            alt="贴纸预览"
            className="block h-full w-full object-contain drop-shadow-[0_12px_24px_rgba(15,23,42,0.16)]"
          />
        </div>
      ) : null}
    </>
  );
}

function buildTimelineTracks({ textConfig, particleConfig, rippleConfig, audioConfig, animationConfig, imageConfig, config }) {
  const tracks = [];
  const ripples = rippleConfig.ripple ? buildRippleSpecs(config) : [];
  const rippleEnd = ripples.reduce((max, ripple) => Math.max(max, ripple.delay + rippleConfig.rippleDuration), 0);
  const particleEnd = particleConfig.particle ? particleConfig.particleDuration + Math.min(520, Math.max(0, particleConfig.particleCount - 1) * 26) : 0;

  if (textConfig.textEnabled) tracks.push({ id: "text", label: "飘字", tone: "rose", start: 0, end: textConfig.textDuration, markers: [{ label: "出现", at: 0 }, { label: "峰值", at: Math.round(textConfig.textDuration * 0.18) }, { label: "淡出", at: textConfig.textDuration }] });
  if (rippleConfig.ripple) tracks.push({ id: "ripple", label: "波纹", tone: "teal", start: 0, end: rippleEnd, markers: [{ label: "扩散", at: 0 }, { label: "最大", at: rippleEnd }] });
  if (particleConfig.particle) tracks.push({ id: "particle", label: "粒子", tone: "amber", start: 0, end: particleEnd, markers: [{ label: "喷发", at: 0 }, { label: "散开", at: Math.round(particleEnd * 0.55) }] });
  if (animationConfig.animationEnabled) tracks.push({ id: "animation", label: "动画", tone: "sky", start: 0, end: animationConfig.animationDuration, markers: [{ label: "入场", at: 0 }, { label: "收束", at: animationConfig.animationDuration }] });
  if (imageConfig.imageEnabled && imageConfig.imageDataUrl) tracks.push({ id: "image", label: "贴纸", tone: "violet", start: 0, end: imageConfig.imageDuration, markers: [{ label: "弹出", at: 0 }, { label: "离场", at: imageConfig.imageDuration }] });
  if (audioConfig.sound) tracks.push({ id: "audio", label: "音效", tone: "slate", start: 0, end: 120, markers: [{ label: "播放", at: 0 }] });
  if (config.cursorOverride && config.cursorOverride !== "跟随当前状态") tracks.push({ id: "cursor", label: "光标", tone: "indigo", start: 0, end: Math.max(900, textConfig.textDuration, rippleEnd, particleEnd), markers: [{ label: "切换", at: 0 }] });

  const totalMs = Math.max(820, ...tracks.map((track) => track.end));
  return { tracks, totalMs: Math.ceil(totalMs / 100) * 100 };
}

function getTimelineTone(tone) {
  if (tone === "rose") return "bg-rose-400 text-rose-700";
  if (tone === "teal") return "bg-teal-400 text-teal-700";
  if (tone === "amber") return "bg-amber-400 text-amber-700";
  if (tone === "sky") return "bg-sky-400 text-sky-700";
  if (tone === "violet") return "bg-violet-400 text-violet-700";
  if (tone === "indigo") return "bg-indigo-400 text-indigo-700";
  return "bg-slate-400 text-slate-700";
}

function PreviewTimeline({ tracks, totalMs, playbackSpeed }) {
  const ticks = [0, Math.round(totalMs * 0.25), Math.round(totalMs * 0.5), Math.round(totalMs * 0.75), totalMs];

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white/85 px-3 py-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
        <span>动画时间轴</span>
        <span>{formatPlaybackSpeed(playbackSpeed)} 播放 · 原始 {totalMs}ms</span>
      </div>
      <div className="relative mb-3 h-5">
        <div className="absolute inset-x-0 top-2 h-px bg-slate-200" />
        {ticks.map((tick) => (
          <div key={tick} className="absolute top-0 text-xs text-slate-500" style={{ left: `${(tick / totalMs) * 100}%`, transform: tick === 0 ? "none" : "translateX(-50%)" }}>
            <span className="block h-2 w-px bg-slate-300" />
            <span className="mt-1 block">{tick}ms</span>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {tracks.length ? tracks.map((track) => {
          const toneClass = getTimelineTone(track.tone);
          const left = `${(track.start / totalMs) * 100}%`;
          const width = `${Math.max(1.5, ((track.end - track.start) / totalMs) * 100)}%`;
          return (
            <div key={track.id} className="grid grid-cols-[42px_minmax(0,1fr)] items-center gap-2">
              <div className={cn("text-xs font-semibold", toneClass.split(" ")[1])}>{track.label}</div>
              <div className="relative h-6 rounded-full bg-slate-100">
                <div className={cn("absolute top-1 h-4 rounded-full opacity-80", toneClass.split(" ")[0])} style={{ left, width }} />
                {track.markers.map((marker) => (
                  <span
                    key={`${track.id}-${marker.label}`}
                    className={cn("absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm", toneClass.split(" ")[0])}
                    style={{ left: `${(marker.at / totalMs) * 100}%` }}
                    title={`${track.label} · ${marker.label} · ${marker.at}ms`}
                  />
                ))}
              </div>
            </div>
          );
        }) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            当前动作没有开启可播放的视觉效果，在左侧配置面板中开启至少一项效果。
          </div>
        )}
      </div>
    </div>
  );
}

function SimplePreviewStage({ config, siteMode, runId, outputs, playbackSpeed }) {
  const disabledBySite = siteMode === "当前禁用";
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
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
        }}
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
            {outputs.length ? outputs.map((output) => (
              <span key={output} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600">
                {output}
              </span>
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
              disabledBySite={disabledBySite}
              config={config}
              runId={runId}
              textConfig={textConfig}
              particleConfig={particleConfig}
              rippleConfig={rippleConfig}
              animationConfig={animationConfig}
              imageConfig={imageConfig}
              playbackSpeed={playbackSpeed}
            />
          </div>
        </div>

        {audioConfig.sound && !disabledBySite ? (
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
                    animation: `cursorDancePreviewBars ${scalePreviewTime(480, playbackSpeed)}ms ease-out ${scalePreviewTime(bar * 60, playbackSpeed)}ms 2`,
                    transformOrigin: "bottom",
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <PreviewTimeline tracks={timeline.tracks} totalMs={timeline.totalMs} playbackSpeed={playbackSpeed} />
    </div>
  );
}

export function WorkbenchPreviewRail({ actionLabel, config, siteMode, previewMode = false }) {
  const disabledBySite = siteMode === "当前禁用";
  const [runId, setRunId] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const textConfig = useMemo(() => getActionTextConfig(config), [config]);
  const particleConfig = useMemo(() => getActionParticleConfig(config), [config]);
  const rippleConfig = useMemo(() => getActionRippleConfig(config), [config]);
  const audioConfig = useMemo(() => getActionAudioConfig(config), [config]);
  const animationConfig = useMemo(() => getActionAnimationConfig(config), [config]);
  const imageConfig = useMemo(() => getActionImageConfig(config), [config]);
  const outputs = useMemo(
    () => buildOutputNames({ textConfig, particleConfig, rippleConfig, audioConfig, animationConfig, imageConfig, config }),
    [textConfig, particleConfig, rippleConfig, audioConfig, animationConfig, imageConfig, config]
  );
  const loopDelay = scalePreviewTime(getPreviewLoopDelay(config), playbackSpeed);

  function replay() {
    if (disabledBySite) return;
    setRunId((value) => value + 1);
  }

  useEffect(() => {
    if (disabledBySite) return undefined;
    setRunId((value) => value + 1);
    return undefined;
  }, [actionLabel, config, disabledBySite]);

  useEffect(() => {
    if (disabledBySite || !autoPlay) return undefined;
    const timer = window.setInterval(() => {
      setRunId((value) => value + 1);
    }, loopDelay);
    return () => window.clearInterval(timer);
  }, [autoPlay, disabledBySite, loopDelay]);

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
            <Button variant="outline" size="icon" className="size-8 rounded-lg" onClick={replay} disabled={disabledBySite} aria-label="重播预览" title="重播">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-lg"
              onClick={() => setAutoPlay((value) => !value)}
              disabled={disabledBySite}
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
                disabled={disabledBySite}
                onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
                className="h-1.5 w-full accent-slate-950"
                aria-label="调整播放速度"
              />
              <span className="w-8 text-right text-xs font-semibold tabular-nums text-slate-900">{formatPlaybackSpeed(playbackSpeed)}</span>
            </div>
          </div>
        }
      >
        <SimplePreviewStage config={config} siteMode={siteMode} runId={runId} outputs={outputs} playbackSpeed={playbackSpeed} />
      </Panel>
    </div>
  );
}
