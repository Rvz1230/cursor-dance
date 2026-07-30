import { useMemo, useRef, useState } from "react";
import { MousePointerClick, Volume2 } from "lucide-react";
import {
  PREVIEW_KEYFRAMES,
  getPreviewSoundFile,
  getPreviewTriggerSummary,
} from "../lib/preview";
import { buildTimelineModel } from "../lib/timelineModel";
import {
  PANEL_META,
  getActionAnimationConfig,
  getActionAudioConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
} from "../model/workbenchSchema";
import { Panel } from "./WorkbenchControls";
import { AtmosphereStagePreview } from "./AtmosphereStagePreview";
import { PreviewPlaybackControls } from "./preview-rail/PreviewPlaybackControls";
import { PreviewTimeline } from "./preview-rail/PreviewTimeline";
import { usePreviewEngineHost } from "./preview-rail/usePreviewEngineHost";
import { usePreviewPlayback } from "./preview-rail/usePreviewPlayback";

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

function SimplePreviewStage({ config, disabled, runId, comboIndex, actionId, actionConfigsMap, outputs, triggerInterval, previewMode, updateActionConfig, atmosphere }) {
  const audioConfig = useMemo(() => getActionAudioConfig(config), [config]);
  const timeline = useMemo(() => buildTimelineModel(config), [config]);

  const soundDelay = audioConfig.soundDelay || 0;

  // 鼠标追踪
  const [pointer, setPointer] = useState({ x: 0, y: 0, inside: false });
  const stageRef = useRef(null);
  const cursorEnabled = atmosphere?.mode === "creative-mouse";
  const {
    effectsHostRef,
    simulationState,
    longPressProgress,
  } = usePreviewEngineHost({
    actionId,
    actionConfigsMap,
    comboIndex,
    config,
    disabled,
    runId,
    triggerInterval,
  });

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
            <div className="text-sm font-medium text-slate-900 text-balance">效果舞台</div>
            <div className="mt-1 text-xs text-slate-500 text-pretty">{getPreviewTriggerSummary(config)}</div>
          </div>
          <div className="flex max-w-[55%] flex-wrap justify-end gap-1.5">
            {outputs.length ? outputs.map((tag) => {
              const Icon = tag.icon;
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    document.getElementById(tag.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                >
                  {Icon ? <Icon className="size-3 text-slate-500" aria-hidden="true" /> : null}
                  <span>{tag.label}</span>
                </button>
              );
            }) : (
              <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">暂无输出</span>
            )}
          </div>
        </div>

        <div className="absolute inset-x-10 bottom-12 h-4 rounded-full bg-slate-200/45" />
        <div className="absolute inset-x-8 bottom-9 h-px bg-slate-300/80" />
        <div className="pointer-events-none absolute inset-x-8 bottom-9 top-20 z-10 flex items-center justify-center" aria-hidden="true">
          <span className="absolute size-12 rounded-full border border-slate-300/70 opacity-60 motion-safe:animate-[cursorDancePreviewPulse_1200ms_ease-out_infinite]" />
          <span className="size-2.5 rounded-full border border-white bg-slate-900 shadow-sm" />
        </div>

        {/* 引擎效果挂载点。translateZ(0) 创造 transform 上下文，
            让引擎里 .cd-effect 的 position:fixed 改以本节点为 containing block，
            坐标系直接落到 host 局部，不会污染 Workbench 其他区域。 */}
        <div
          ref={effectsHostRef}
          className="pointer-events-none absolute inset-x-8 bottom-9 top-20 overflow-hidden"
          style={{ transform: "translateZ(0)" }}
          aria-hidden="true"
        />

        {/* 模拟指示器 */}
        {simulationState.type === "longPress-holding" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="size-12 rounded-full border-2 border-slate-300"
              style={{
                background: `conic-gradient(#7C3AED ${longPressProgress}%, transparent ${longPressProgress}%)`,
              }}
            />
          </div>
        )}
        {simulationState.type === "doubleClick-waiting" && (
          <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-teal-500 shadow-sm shadow-teal-300" />
            <span className="size-2.5 rounded-full bg-slate-300" />
          </div>
        )}

        {/* 氛围动效预览层 */}
        <AtmosphereStagePreview
          atmosphere={atmosphere}
          pointerX={pointer.x}
          pointerY={pointer.y}
          isPointerInside={pointer.inside}
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
                    animation: `cursorDancePreviewBars ${480}ms ease-out ${soundDelay + bar * 60}ms 2`,
                    transformOrigin: "bottom",
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <PreviewTimeline tracks={timeline.tracks} totalMs={timeline.totalMs} disabled={disabled} canEditEmptyState={!previewMode && !disabled} updateActionConfig={updateActionConfig} runId={runId} />
    </div>
  );
}

export function WorkbenchPreviewRail({ actionId = "leftClick", config, actionConfigsMap, disabled = false, previewMode = false, updateActionConfig, atmosphere }) {
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
  const comboWindowMs = textConfig.comboWindowMs || 900;
  const {
    runId,
    comboIndex,
    autoPlay,
    triggerInterval,
    replay,
    toggleAutoPlay,
    setTriggerInterval,
  } = usePreviewPlayback({
    actionId,
    config,
    comboEnabled: textConfig.comboEnabled,
    comboWindowMs,
    disabled,
  });

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
          <PreviewPlaybackControls
            autoPlay={autoPlay}
            disabled={disabled}
            triggerInterval={triggerInterval}
            onReplay={replay}
            onToggleAutoPlay={toggleAutoPlay}
            onTriggerIntervalChange={setTriggerInterval}
          />
        }
      >
        <SimplePreviewStage config={config} disabled={disabled} runId={runId} comboIndex={comboIndex} actionId={actionId} actionConfigsMap={actionConfigsMap} outputs={outputs} triggerInterval={triggerInterval} previewMode={previewMode} updateActionConfig={updateActionConfig} atmosphere={atmosphere} />
      </Panel>
    </div>
  );
}
