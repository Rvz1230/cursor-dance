import { useEffect, useMemo, useState } from "react";
import { MousePointerClick, Pause, Play, RotateCcw, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
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
                animation: `cursorDancePreviewRipple ${rippleConfig.rippleDuration}ms ${getAnimationEasingCss(rippleConfig.rippleEasing)} ${ripple.delay}ms forwards`,
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
                  animation: `cursorDancePreviewParticle ${particleConfig.particleDuration}ms ease-out ${particle.delay}ms forwards`,
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
              fontSize: `${textConfig.fontSize}px`,
              fontWeight: getTextWeightValue(textConfig.textWeight),
              textShadow: getTextShadowValue(config),
              WebkitTextStroke: textConfig.textOutlineWidth ? `${textConfig.textOutlineWidth}px ${hexToRgba("#FFFFFF", 0.82)}` : undefined,
              animation: `cursorDancePreviewFloat ${textConfig.textDuration}ms ${getAnimationEasingCss(textConfig.textEasing)} forwards`,
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
            animation: `cursorDancePreviewAnimation ${animationConfig.animationDuration}ms ${getAnimationEasingCss(animationConfig.animationEasing)} forwards`,
          }}
        />
      ) : null}

      {imageConfig.imageEnabled && imageConfig.imageDataUrl ? (
        <div
          key={`image-${runId}`}
          className="absolute left-1/2 top-1/2"
          style={{
            ...imageStyle,
            animation: `cursorDancePreviewImage ${imageConfig.imageDuration}ms cubic-bezier(0.22, 1, 0.36, 1) forwards`,
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

function SimplePreviewStage({ config, siteMode, runId, outputs }) {
  const disabledBySite = siteMode === "当前禁用";
  const textConfig = useMemo(() => getActionTextConfig(config), [config]);
  const particleConfig = useMemo(() => getActionParticleConfig(config), [config]);
  const rippleConfig = useMemo(() => getActionRippleConfig(config), [config]);
  const audioConfig = useMemo(() => getActionAudioConfig(config), [config]);
  const animationConfig = useMemo(() => getActionAnimationConfig(config), [config]);
  const imageConfig = useMemo(() => getActionImageConfig(config), [config]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="relative flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white"
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
            />
          </div>
        </div>

        {audioConfig.sound && !disabledBySite ? (
          <div className="absolute right-5 top-20 flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-white/95 px-2 py-1 text-[10px] text-slate-600 shadow-sm">
            <Volume2 className="size-3 text-emerald-700" aria-hidden="true" />
            <span className="max-w-[88px] truncate">{getPreviewSoundFile(config)}</span>
            <div className="flex items-end gap-1" aria-hidden="true">
              {[0, 1, 2, 3].map((bar) => (
                <span
                  key={`bar-${runId}-${bar}`}
                  className="block w-0.5 rounded-full bg-emerald-500/70"
                  style={{
                    height: `${7 + bar * 2}px`,
                    animation: `cursorDancePreviewBars 480ms ease-out ${bar * 60}ms 2`,
                    transformOrigin: "bottom",
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function WorkbenchPreviewRail({ actionLabel, config, siteMode, previewMode = false }) {
  const disabledBySite = siteMode === "当前禁用";
  const [runId, setRunId] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
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
  const loopDelay = getPreviewLoopDelay(config);

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
        summary={previewMode ? `正在预览 AI 建议 · ${actionLabel}` : `${actionLabel} · ${getPreviewTriggerSummary(config)}`}
        action={
          <div className="flex items-center justify-end gap-1.5">
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
          </div>
        }
      >
        <SimplePreviewStage config={config} siteMode={siteMode} runId={runId} outputs={outputs} />
      </Panel>
    </div>
  );
}
