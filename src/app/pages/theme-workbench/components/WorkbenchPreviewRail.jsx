import { useEffect, useMemo, useState } from "react";
import { Bell, RotateCcw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { Switch } from "@/components/ui/switch.jsx";
import { cn } from "@/components/ui/utils.js";
import {
  PREVIEW_KEYFRAMES,
  buildRippleSpecs,
  buildParticleSpecs,
  getAnimationEasingCss,
  getParticleStyleProps,
  getParticleTint,
  getPreviewText,
  getTextShadowValue,
  getTextWeightValue,
  hexToRgba,
} from "../lib/preview.js";
import { Panel, PreviewBadge } from "./WorkbenchControls.jsx";

function CursorPreview({ actionLabel, config, siteMode }) {
  const disabledBySite = siteMode === "当前禁用";
  const [runId, setRunId] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const accentText = getPreviewText(config, runId);
  const particleSpecs = useMemo(() => buildParticleSpecs(config, runId), [config, runId]);
  const rippleSpecs = useMemo(() => buildRippleSpecs(config), [config]);
  const loopDelay =
    Math.max(
      config.textEnabled ? config.textDuration : 0,
      config.particle ? config.particleDuration : 0,
      config.ripple ? config.rippleDuration : 0,
      config.sound ? 880 : 0,
      1400
    ) + 900;

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
    <div className="space-y-3">
      <style>{PREVIEW_KEYFRAMES}</style>

      <div className="rounded-[18px] border border-slate-200 bg-slate-50/85 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <div className="truncate text-sm font-semibold text-slate-900">{actionLabel} 效果模拟</div>
            <div className="truncate text-xs text-slate-500">
              {config.triggerTiming} · {config.triggerZone}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PreviewBadge tone={disabledBySite ? "amber" : "emerald"}>{siteMode}</PreviewBadge>
            <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">
              <span>自动播放</span>
              <Switch checked={autoPlay && !disabledBySite} disabled={disabledBySite} onCheckedChange={setAutoPlay} aria-label="自动播放开关" />
            </label>
            <Button variant="outline" className="h-8 rounded-2xl px-2.5" onClick={replay} disabled={disabledBySite}>
              <RotateCcw className="mr-2 h-4 w-4" />
              重播
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-[22px] border border-slate-200 bg-white p-2.5">
        <div
          className="relative h-[228px] overflow-hidden rounded-[18px] border border-slate-200 bg-white"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.28) 1px, transparent 0), linear-gradient(180deg, rgba(248,250,252,0.84), rgba(241,245,249,0.94))",
            backgroundSize: "18px 18px, 100% 100%",
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.12),rgba(241,245,249,0.32)_70%)]" />

          <div className="absolute inset-x-8 bottom-9 h-4 rounded-full bg-slate-200/60" />
          <div className="absolute inset-x-6 bottom-6 h-px bg-slate-300/70" />

          <div className="absolute left-1/2 top-[56%] h-0 w-0">
            {config.ripple && !disabledBySite ? (
              rippleSpecs.map((ripple, index) => (
                <div
                  key={`ripple-${runId}-${index}`}
                  className="absolute left-1/2 top-1/2 rounded-full border"
                  style={{
                    width: `${ripple.size}px`,
                    height: `${ripple.size}px`,
                    borderWidth: ripple.filled ? 0 : `${config.rippleLineWidth}px`,
                    borderColor: ripple.filled ? "transparent" : hexToRgba("#34D399", ripple.opacity),
                    background: ripple.filled
                      ? `radial-gradient(circle, ${hexToRgba("#6EE7B7", ripple.opacity * 0.34)} 0%, ${hexToRgba("#34D399", ripple.opacity * 0.16)} 56%, ${hexToRgba("#34D399", 0)} 100%)`
                      : "transparent",
                    boxShadow: ripple.filled ? `0 0 0 1px ${hexToRgba("#34D399", ripple.opacity * 0.22)} inset` : undefined,
                    animation: `cursorDancePreviewRipple ${config.rippleDuration}ms ${getAnimationEasingCss(config.rippleEasing)} ${ripple.delay}ms forwards`,
                  }}
                />
              ))
            ) : null}

            {config.particle && !disabledBySite
              ? particleSpecs.map((particle, index) => {
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
                      animation: `cursorDancePreviewParticle ${config.particleDuration}ms ${config.particleStyle === "火花" ? "cubic-bezier(0.22, 1, 0.36, 1)" : "ease-out"} ${particle.delay}ms forwards`,
                      transform: `rotate(${shape.rotation}deg)`,
                    }}
                  />
                  );
                })
              : null}

            {config.textEnabled && !disabledBySite ? (
              <div
                className="absolute left-1/2 top-1/2"
                style={{ marginLeft: `${config.textOffsetX}px`, marginTop: `${config.textOffsetY}px` }}
              >
                <div
                  key={`text-${runId}`}
                  className="whitespace-nowrap text-center tabular-nums"
                  style={{
                    color: hexToRgba(config.textColor, config.textOpacity / 100),
                    fontSize: `${config.fontSize}px`,
                    fontWeight: getTextWeightValue(config.textWeight),
                    textShadow: getTextShadowValue(config),
                    WebkitTextStroke: config.textOutlineWidth ? `${config.textOutlineWidth}px ${hexToRgba("#FFFFFF", 0.82)}` : undefined,
                    animation: `cursorDancePreviewFloat ${config.textDuration}ms ${getAnimationEasingCss(config.textEasing)} forwards`,
                  }}
                >
                  {accentText}
                </div>
              </div>
            ) : null}

            <div
              key={`target-${runId}`}
              className="absolute left-1/2 top-1/2"
              style={{
                transform: "translate3d(-50%, -50%, 0)",
                animation: disabledBySite ? undefined : "cursorDancePreviewPulse 180ms ease-out 1",
              }}
            >
              <div
                className="relative flex items-center justify-center rounded-full border border-amber-300 bg-amber-50 shadow-sm"
                style={{ width: `${config.cursorSize}px`, height: `${config.cursorSize}px` }}
              >
                <Bell className="h-5 w-5 text-amber-700" />
                <div className="absolute inset-2 rounded-full border border-amber-200/80" />
              </div>
            </div>
          </div>

          {config.sound && !disabledBySite ? (
            <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full border border-slate-200 bg-white/94 px-2.5 py-1.5 text-[11px] text-slate-500 shadow-sm">
              <span className="max-w-[96px] truncate">{config.soundFile}</span>
              <div className="flex items-end gap-1">
                {[0, 1, 2, 3].map((bar) => (
                  <span
                    key={`bar-${runId}-${bar}`}
                    className="block w-1.5 rounded-full bg-rose-300/90"
                    style={{
                      height: `${8 + bar * 3}px`,
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

      <div className={cn("px-1 text-xs", disabledBySite ? "text-amber-700" : "text-slate-500")}>
        {disabledBySite
          ? "当前站点已禁用。"
          : autoPlay
            ? "按当前参数自动重播。"
            : "自动播放已关闭。"}
      </div>
    </div>
  );
}

export function WorkbenchPreviewRail({ actionLabel, config, siteMode }) {
  return (
    <div className="min-h-0">
      <Panel title="实时预览" icon={Wand2} iconTone="bg-slate-900 text-white" className="shadow-sm">
        <CursorPreview actionLabel={actionLabel} config={config} siteMode={siteMode} />
      </Panel>
    </div>
  );
}
