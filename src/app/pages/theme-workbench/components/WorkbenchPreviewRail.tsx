import { useMemo, useState } from "react";
import { cn } from "@/components/ui/utils";
import { PREVIEW_KEYFRAMES } from "../lib/preview";
import {
  PANEL_META,
  getActionAnimationConfig,
  getActionAudioConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
} from "../model/workbenchSchema";
import { PreviewPlaybackControls } from "./preview-rail/PreviewPlaybackControls";
import { PreviewStage } from "./preview-rail/PreviewStage";

const BACKGROUNDS = [
  { id: "light", label: "浅" },
  { id: "dark", label: "深" },
  { id: "checker", label: "格" },
  { id: "finder", label: "访达" },
  { id: "browser", label: "网页" },
  { id: "deck", label: "演示" },
];

function buildOutputTags({ textConfig, particleConfig, rippleConfig, audioConfig, animationConfig, imageConfig, config }) {
  const tags = [];
  if (textConfig.textEnabled) tags.push({ id: "card-text", label: "飘字", icon: PANEL_META.text.icon });
  if (rippleConfig.ripple) tags.push({ id: "card-ripple", label: "波纹", icon: PANEL_META.ripple.icon });
  if (particleConfig.particle) tags.push({ id: "card-particle", label: "粒子", icon: PANEL_META.particles.icon });
  if (audioConfig.sound) tags.push({ id: "card-audio", label: "音效", icon: PANEL_META.audio.icon });
  if (animationConfig.animationEnabled) tags.push({ id: "card-animation", label: "动画", icon: PANEL_META.animation.icon });
  if (imageConfig.imageEnabled && imageConfig.imageDataUrl) tags.push({ id: "card-image", label: "贴纸", icon: PANEL_META.image.icon });
  if (config.cursorOverride && config.cursorOverride !== "跟随当前状态") tags.push({ id: "card-cursor", label: "光标", icon: PANEL_META.cursor.icon });
  return tags;
}

export function WorkbenchPreviewRail({ actionId = "leftClick", config, comparisonConfig, actionConfigsMap, disabled = false, previewMode = false, atmosphere, playback, totalMs }) {
  const [background, setBackground] = useState("light");
  const [showTrail, setShowTrail] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const textConfig = useMemo(() => getActionTextConfig(config), [config]);
  const particleConfig = useMemo(() => getActionParticleConfig(config), [config]);
  const rippleConfig = useMemo(() => getActionRippleConfig(config), [config]);
  const audioConfig = useMemo(() => getActionAudioConfig(config), [config]);
  const animationConfig = useMemo(() => getActionAnimationConfig(config), [config]);
  const imageConfig = useMemo(() => getActionImageConfig(config), [config]);
  const outputs = useMemo(
    () => buildOutputTags({ textConfig, particleConfig, rippleConfig, audioConfig, animationConfig, imageConfig, config }),
    [textConfig, particleConfig, rippleConfig, audioConfig, animationConfig, imageConfig, config],
  );

  function burst() {
    if (disabled) return;
    [0, 90, 180, 300, 440].forEach((delay) => window.setTimeout(playback.replay, delay));
  }

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <style>{PREVIEW_KEYFRAMES}</style>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2">
        <div className="flex shrink-0 items-baseline gap-2">
          <h3 className="shrink-0 text-sm font-medium text-slate-900">实时预览</h3>
          {previewMode ? <span className="truncate text-2xs text-sky-600">AI 建议</span> : null}
        </div>
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
          <div className="hidden items-center rounded-xl bg-slate-100 p-0.5 min-[900px]:flex" role="radiogroup" aria-label="预览背景">
            {BACKGROUNDS.map((item) => (
              <button key={item.id} type="button" role="radio" aria-checked={background === item.id} onClick={() => setBackground(item.id)} className={cn("h-6 rounded-lg px-1.5 text-2xs font-medium transition-colors", background === item.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900")}>{item.label}</button>
            ))}
          </div>
          <button type="button" onClick={burst} disabled={disabled} className="h-7 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40">连打</button>
          <button type="button" aria-pressed={showTrail} onClick={() => setShowTrail((value) => !value)} className={cn("h-7 rounded-lg border px-2.5 text-xs font-medium transition-colors", showTrail ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>轨迹</button>
          <button type="button" aria-pressed={compareMode} onClick={() => setCompareMode((value) => !value)} className={cn("h-7 rounded-lg border px-2.5 text-xs font-medium transition-colors", compareMode ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>A/B</button>
        </div>
      </div>

      <PreviewStage
        config={config}
        comparisonConfig={comparisonConfig}
        compareMode={compareMode}
        disabled={disabled}
        runId={playback.runId}
        comboIndex={playback.comboIndex}
        actionId={actionId}
        actionConfigsMap={actionConfigsMap}
        triggerInterval={playback.triggerInterval}
        atmosphere={atmosphere}
        background={background}
        showTrail={showTrail}
        onReplay={playback.replay}
      />

      <PreviewPlaybackControls
        autoPlay={playback.autoPlay}
        disabled={disabled}
        triggerInterval={playback.triggerInterval}
        isPlaying={playback.isPlaying}
        currentTimeMs={playback.currentTimeMs}
        totalMs={totalMs}
        playbackSpeed={playback.playbackSpeed}
        loopEnabled={playback.loopEnabled}
        onReplay={playback.replay}
        onTogglePlayback={playback.togglePlayback}
        onStepBackward={playback.stepBackward}
        onStepForward={playback.stepForward}
        onToggleLoop={playback.toggleLoop}
        onToggleAutoPlay={playback.toggleAutoPlay}
        onPlaybackSpeedChange={playback.setPlaybackSpeed}
        onTriggerIntervalChange={playback.setTriggerInterval}
      />

      <div className="flex shrink-0 items-center gap-1.5 border-t border-slate-100 px-4 py-2">
        <span className="shrink-0 whitespace-nowrap text-xs font-medium text-slate-500">本次输出</span>
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto whitespace-nowrap">
          {outputs.length ? outputs.map((tag) => {
            const Icon = tag.icon;
            return (
              <button key={tag.id} type="button" onClick={() => document.getElementById(tag.id)?.scrollIntoView({ behavior: "smooth", block: "start" })} className="inline-flex h-6 items-center gap-1.5 rounded-lg bg-slate-50 px-2 text-2xs font-medium text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-100">
                <Icon className="size-3" aria-hidden="true" />{tag.label}
              </button>
            );
          }) : <span className="text-xs text-slate-400">暂无输出</span>}
        </div>
      </div>
    </section>
  );
}
