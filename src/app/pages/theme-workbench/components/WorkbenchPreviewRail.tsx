import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MousePointerClick, Pause, Play, RotateCcw, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import {
  PREVIEW_KEYFRAMES,
  getPreviewSoundFile,
  getPreviewTriggerSummary,
} from "../lib/preview";
import { useTimelineDrag } from "../lib/useTimelineDrag";
import {
  DELAY_FIELD_BY_TRACK,
  DURATION_FIELD_BY_TRACK,
  TRACK_DEFAULTS,
  buildMinorTicks,
  buildTickMarks,
  buildTimelineKeyboardPatch,
  buildTimelineModel,
  formatTickMs,
} from "../lib/timelineModel";
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
import { createEffectEngine, type EngineConstants, type EngineState } from "@/desktop/renderer/engine/entry";
import { defaultKeyFeedbackConfig } from "@/desktop/renderer/engine/key-feedback-types";
import {
  getActionAnimationConfig as engineGetActionAnimationConfig,
  getActionAudioConfig as engineGetActionAudioConfig,
  getActionCursorFeedbackConfig as engineGetActionCursorFeedbackConfig,
  getActionImageConfig as engineGetActionImageConfig,
  getActionParticleConfig as engineGetActionParticleConfig,
  getActionRippleConfig as engineGetActionRippleConfig,
  getActionTextConfig as engineGetActionTextConfig,
  getActionTriggerConfig as engineGetActionTriggerConfig,
} from "@/desktop/renderer/engine/action-config";

function formatTriggerInterval(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;
}

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

function getTimelineTone(tone) {
  if (tone === "rose") return { bg: "bg-rose-200", text: "text-rose-600", dot: "bg-rose-500", border: "border-rose-300/60", gradient: "from-rose-200/90 to-rose-300/80" };
  if (tone === "teal") return { bg: "bg-teal-200", text: "text-teal-600", dot: "bg-teal-500", border: "border-teal-300/60", gradient: "from-teal-200/90 to-teal-300/80" };
  if (tone === "amber") return { bg: "bg-amber-200", text: "text-amber-600", dot: "bg-amber-500", border: "border-amber-300/60", gradient: "from-amber-200/90 to-amber-300/80" };
  if (tone === "sky") return { bg: "bg-sky-200", text: "text-sky-600", dot: "bg-sky-500", border: "border-sky-300/60", gradient: "from-sky-200/90 to-sky-300/80" };
  if (tone === "violet") return { bg: "bg-violet-200", text: "text-violet-600", dot: "bg-violet-500", border: "border-violet-300/60", gradient: "from-violet-200/90 to-violet-300/80" };
  return { bg: "bg-slate-200", text: "text-slate-600", dot: "bg-slate-500", border: "border-slate-300/60", gradient: "from-slate-200/90 to-slate-300/80" };
}

const INTERVAL_PRESETS = [
  { label: "慢速", value: 2400 },
  { label: "标准", value: 1200 },
  { label: "快速", value: 600 },
];

function TrackHandle({ side, track, totalMs, pxPerMs, editableDuration, updateActionConfig, onGhostChange }) {
  const isLeft = side === "left";
  const delayField = DELAY_FIELD_BY_TRACK[track.id];
  const durationField = DURATION_FIELD_BY_TRACK[track.id];
  const minEditableDuration = editableDuration <= 0 ? 0 : 40;

  const commitRef = useRef(null);
  commitRef.current = useCallback(
    (deltaMs) => {
      if (isLeft && delayField) {
        const newDelay = Math.max(0, track.start + deltaMs);
        const patch = { [delayField]: newDelay };
        if (durationField) {
          patch[durationField] = Math.max(minEditableDuration, editableDuration - deltaMs);
        }
        updateActionConfig(patch);
      } else if (!isLeft && durationField) {
        updateActionConfig({ [durationField]: Math.max(minEditableDuration, editableDuration + deltaMs) });
      }
    },
    [editableDuration, isLeft, delayField, durationField, minEditableDuration, track.start, updateActionConfig]
  );

  const onGhostChangeRef = useRef(null);
  onGhostChangeRef.current = onGhostChange;

  const { isDragging, tooltipMs, handlers } = useTimelineDrag({
    mode: isLeft ? "resize-left" : "resize-right",
    pxPerMs,
    snapMs: 20,
    minMs: isLeft ? -track.start : -(editableDuration - minEditableDuration),
    maxMs: isLeft ? editableDuration - minEditableDuration : Infinity,
    onChange: (deltaMs) => onGhostChangeRef.current?.(deltaMs),
    onCommit: (deltaMs) => commitRef.current?.(deltaMs),
  });

  const posPct = `${(isLeft ? track.start : track.start + editableDuration) / totalMs * 100}%`;

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
          className="absolute -top-8 z-30 -translate-x-1/2 rounded-lg bg-slate-900 px-2 py-0.5 text-2xs font-semibold tabular-nums text-white shadow-lg pointer-events-none whitespace-nowrap"
          style={{ left: posPct }}
        >
          {isLeft
            ? `${Math.max(0, track.start + tooltipMs)}ms`
            : `${track.start + editableDuration + tooltipMs}ms`}
        </div>
      ) : null}
    </>
  );
}

function TimelineTrackRow({ track, totalMs, pxPerMs, updateActionConfig, isEven, disabled }) {
  const [ghost, setGhost] = useState(null);
  const visualDuration = track.end - track.start;
  const editableDuration = track.configuredDuration ?? visualDuration;
  const tailDuration = Math.max(0, visualDuration - editableDuration);
  const ghostDelta = ghost?.deltaMs ?? 0;
  const ghostStart = ghost?.mode === "move" || ghost?.mode === "resize-left"
    ? Math.max(0, track.start + ghostDelta)
    : track.start;
  const ghostEditableDuration = ghost?.mode === "resize-left"
    ? Math.max(editableDuration <= 0 ? 0 : 40, editableDuration - ghostDelta)
    : ghost?.mode === "resize-right"
      ? Math.max(editableDuration <= 0 ? 0 : 40, editableDuration + ghostDelta)
      : editableDuration;
  const ghostEnd = ghost?.mode === "move" ? track.end + ghostDelta : ghostStart + ghostEditableDuration + tailDuration;
  const leftPct = `${(ghostStart / totalMs) * 100}%`;
  const widthPct = `${Math.max(0.5, ((ghostEnd - ghostStart) / totalMs) * 100)}%`;
  const tone = getTimelineTone(track.tone);
  const delayField = DELAY_FIELD_BY_TRACK[track.id];
  const minorTicks = useMemo(() => buildMinorTicks(totalMs), [totalMs]);

  const commitRef = useRef(null);
  commitRef.current = useCallback(
    (deltaMs) => {
      if (disabled || !delayField) return;
      const newDelay = Math.max(0, track.start + deltaMs);
      updateActionConfig({ [delayField]: newDelay });
    },
    [delayField, disabled, track.start, updateActionConfig]
  );

  const { isDragging: isMoving, tooltipMs, handlers: moveHandlers } = useTimelineDrag({
    mode: "move",
    pxPerMs: disabled ? 0 : pxPerMs,
    snapMs: 20,
    minMs: -track.start,
    onChange: (deltaMs) => setGhost(deltaMs === null ? null : { mode: "move", deltaMs }),
    onCommit: (deltaMs) => commitRef.current?.(deltaMs),
  });

  const defaults = TRACK_DEFAULTS[track.id];
  const isDirty = defaults && (track.start !== defaults.delay || (defaults.duration && track.configuredDuration !== defaults.duration));
  const valueText = `${track.label} 延迟 ${ghostStart}ms${track.configuredDuration ? `，时长 ${Math.round(ghostEnd - ghostStart)}ms` : ""}`;

  const onKeyDown = useCallback(
    (event) => {
      if (disabled) return;
      const patch = buildTimelineKeyboardPatch({
        track,
        key: event.key,
        shiftKey: event.shiftKey,
        maxDelay: Math.max(0, totalMs - (ghostEnd - ghostStart)),
      });
      if (!patch) return;
      event.preventDefault();
      updateActionConfig(patch);
    },
    [disabled, ghostEnd, ghostStart, totalMs, track, updateActionConfig]
  );

  return (
    <div className={cn(
      "group relative grid grid-cols-[42px_minmax(0,1fr)] items-center gap-2.5 py-1 -mx-1 px-1 rounded-lg transition-colors duration-150",
      isMoving ? "bg-slate-100" : isEven ? "bg-slate-50/60 hover:bg-slate-100/80" : "bg-white hover:bg-slate-50"
    )}>
      <div className="flex items-center gap-1.5">
        <span className={cn("size-1.5 rounded-full shrink-0", tone.dot)} />
        <span className={cn("text-2xs font-semibold select-none truncate", tone.text)}>{track.label}</span>
        {isDirty ? (
          <button
            type="button"
            className="hidden group-hover:flex size-4 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 hover:text-slate-700 transition-colors shrink-0"
            title="重置延迟和时长"
            aria-label={`重置${track.label}延迟和时长`}
            onClick={(e) => {
              if (disabled) return;
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
          <TrackHandle
            side="left"
            track={track}
            totalMs={totalMs}
            pxPerMs={disabled ? 0 : pxPerMs}
            editableDuration={editableDuration}
            updateActionConfig={updateActionConfig}
            onGhostChange={(deltaMs) => setGhost(deltaMs === null ? null : { mode: "resize-left", deltaMs })}
          />
        ) : null}

        {/* right resize handle — only if track has a duration field */}
        {DURATION_FIELD_BY_TRACK[track.id] ? (
          <TrackHandle
            side="right"
            track={track}
            totalMs={totalMs}
            pxPerMs={disabled ? 0 : pxPerMs}
            editableDuration={editableDuration}
            updateActionConfig={updateActionConfig}
            onGhostChange={(deltaMs) => setGhost(deltaMs === null ? null : { mode: "resize-right", deltaMs })}
          />
        ) : null}

        {/* main block (draggable middle) — only if track has a delay field */}
        {DELAY_FIELD_BY_TRACK[track.id] ? (
        <div
          className={cn(
            "absolute top-1/2 h-5 -translate-y-1/2 rounded-md transition-[filter,box-shadow,transform] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-slate-900/60 focus-visible:ring-offset-2",
            "bg-gradient-to-b border shadow-sm",
            tone.gradient, tone.border,
            isMoving
              ? "shadow-md ring-1 ring-slate-400/50 cursor-grabbing z-10 brightness-95 scale-y-110"
              : "cursor-grab group-hover:shadow-md group-hover:brightness-105"
          )}
          style={{ left: leftPct, width: widthPct }}
          {...moveHandlers}
          role="slider"
          aria-label={`${track.label} 时间块`}
          aria-valuemin={0}
          aria-valuemax={totalMs}
          aria-valuenow={ghostStart}
          aria-valuetext={valueText}
          onKeyDown={onKeyDown}
          tabIndex={0}
        >
          {/* duration label inside block */}
          {track.configuredDuration && (ghostEnd - ghostStart) / totalMs > 0.18 ? (
            <span className={cn(
              "absolute inset-0 flex items-center justify-center text-2xs font-semibold tabular-nums select-none pointer-events-none",
              tone.text
            )}>
              {Math.round(ghostEnd - ghostStart)}ms
            </span>
          ) : null}
        </div>
        ) : null}
        {isMoving && tooltipMs !== null ? (
          <div
            className="absolute -top-6 z-30 rounded-lg bg-slate-900 px-2 py-0.5 text-2xs font-semibold tabular-nums text-white shadow-lg pointer-events-none whitespace-nowrap"
            style={{ left: leftPct }}
          >
            {ghostStart}ms
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InteractiveTimeline({ tracks, totalMs, disabled, canEditEmptyState, updateActionConfig, runId }) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [playheadKey, setPlayheadKey] = useState(0);
  const [isPlayheadRunning, setIsPlayheadRunning] = useState(false);
  const tickMarks = useMemo(() => buildTickMarks(totalMs), [totalMs]);
  const minorTicks = useMemo(() => buildMinorTicks(totalMs), [totalMs]);
  const pxPerMs = containerWidth > 0 ? containerWidth / totalMs : 0;

  useEffect(() => {
    setPlayheadKey((value) => value + 1);
    setIsPlayheadRunning(false);
    const frame = requestAnimationFrame(() => setIsPlayheadRunning(true));
    return () => cancelAnimationFrame(frame);
  }, [runId]);

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
          <span className="text-2xs tabular-nums text-slate-400 bg-slate-100 rounded-md px-1.5 py-0.5">总长 {formatTickMs(totalMs)}</span>
          <span className="hidden rounded-md bg-slate-50 px-1.5 py-0.5 text-2xs font-medium text-slate-400 sm:inline">Snap 20ms</span>
        </div>
        <div className="flex items-center gap-1.5">
          {hasAnyDirty ? (
            <button
              type="button"
              className="rounded-md px-2 py-0.5 text-2xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              onClick={resetAll}
            >
              重置全部
            </button>
          ) : null}
          <span className="text-2xs text-slate-400 hidden sm:inline">拖拽边缘调整时长 · 拖拽中部调整延迟</span>
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
            <span className="mt-0.5 text-2xs tabular-nums text-slate-500 leading-none">
              {formatTickMs(tick)}
            </span>
          </div>
        ))}
      </div>

      {/* tracks */}
      <div ref={containerRef} className="relative px-3 pb-3 pt-2 space-y-1">
        {tracks.length ? (
          <div
            key={playheadKey}
            className="pointer-events-none absolute bottom-3 top-2 z-20 w-px bg-slate-900/70 motion-reduce:hidden"
            style={{
              left: "12px",
              transform: `translateX(${isPlayheadRunning ? containerWidth : 0}px)`,
              transition: isPlayheadRunning ? `transform ${totalMs}ms linear` : "none",
            }}
            aria-hidden="true"
          >
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-md bg-slate-900 px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-white shadow-sm">
              {formatTickMs(totalMs)}
            </span>
          </div>
        ) : null}
        {tracks.length ? tracks.map((track, i) => (
          <TimelineTrackRow
            key={track.id}
            track={track}
            totalMs={totalMs}
            pxPerMs={pxPerMs}
            updateActionConfig={updateActionConfig}
            isEven={i % 2 === 0}
            disabled={disabled}
          />
        )) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-center">
            <div className="text-xs font-medium text-slate-700 text-balance">当前动作还没有可播放的视觉效果</div>
            <div className="mt-1 text-2xs text-slate-500 text-pretty">先在左侧开启一个基础反馈，再回到时间轴微调节奏。</div>
            {canEditEmptyState ? (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                <Button variant="outline" size="sm" className="h-7 rounded-lg px-2.5 text-2xs font-semibold" disabled={disabled} onClick={() => updateActionConfig({ ripple: true })}>
                  开启波纹
                </Button>
                <Button variant="outline" size="sm" className="h-7 rounded-lg px-2.5 text-2xs font-semibold" disabled={disabled} onClick={() => updateActionConfig({ particle: true })}>
                  开启粒子
                </Button>
                <Button variant="outline" size="sm" className="h-7 rounded-lg px-2.5 text-2xs font-semibold" disabled={disabled} onClick={() => updateActionConfig({ textEnabled: true })}>
                  开启飘字
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function SimplePreviewStage({ config, disabled, runId, comboIndex, actionId, actionConfigsMap, outputs, triggerInterval, previewMode, updateActionConfig, atmosphere }) {
  const textConfig = useMemo(() => getActionTextConfig(config), [config]);
  const particleConfig = useMemo(() => getActionParticleConfig(config), [config]);
  const rippleConfig = useMemo(() => getActionRippleConfig(config), [config]);
  const audioConfig = useMemo(() => getActionAudioConfig(config), [config]);
  const animationConfig = useMemo(() => getActionAnimationConfig(config), [config]);
  const imageConfig = useMemo(() => getActionImageConfig(config), [config]);
  const timeline = useMemo(() => buildTimelineModel(config), [config]);

  const soundDelay = audioConfig.soundDelay || 0;

  // 鼠标追踪
  const [pointer, setPointer] = useState({ x: 0, y: 0, inside: false });
  const stageRef = useRef(null);
  const effectsHostRef = useRef(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const cursorEnabled = atmosphere?.mode === "creative-mouse";

  // 引擎实例与最新 config / actionId 引用 ——
  //   引擎在 mount 时建一次，runId 变化时 triggerHandlers.previewAt 重新触发；
  //   config 通过 ref 共享，避免每次配置变化重建引擎（重建会丢 audioContext / orbital 缓存）。
  const configRef = useRef(config);
  configRef.current = config;
  const actionIdRef = useRef(actionId);
  actionIdRef.current = actionId;
  const actionConfigsMapRef = useRef(actionConfigsMap);
  actionConfigsMapRef.current = actionConfigsMap;
  const engineRef = useRef(null);
  const doubleClickIdleTimeoutRef = useRef<number | null>(null);

  // ── 预览模拟状态 ──
  const [simState, setSimState] = useState<
    | { type: "idle" }
    | { type: "longPress-holding"; startedAt: number; thresholdMs: number }
    | { type: "doubleClick-waiting" }
  >({ type: "idle" });
  const [lpProgress, setLpProgress] = useState(0);

  useEffect(() => {
    const host = effectsHostRef.current;
    if (!host) return undefined;
    // 每个预览面板实例用唯一 ROOT_ID / STYLE_ID，避免和潜在的多实例 / overlay 渲染串。
    const uid = Math.random().toString(36).slice(2, 8);
    const constants: EngineConstants = {
      ROOT_ID: `cursordance-preview-root-${uid}`,
      STYLE_ID: `cursordance-preview-style-${uid}`,
      HIDE_CURSOR_CLASS: `cd-preview-hide-${uid}`,
    };
    const engineState: EngineState = { activeEffects: 0, ready: true };
    // 最简内存版 ConfigStore：把 props.config 当唯一 actionConfig 回放，
    // isCurrentSiteEnabled / matchesTriggerZone 恒 true，绕开 site / hover / target 校验。
    const previewScheme = { id: "preview" };
    const configStore = {
      getActionTriggerConfig: engineGetActionTriggerConfig,
      getActionTextConfig: engineGetActionTextConfig,
      getActionRippleConfig: engineGetActionRippleConfig,
      getActionParticleConfig: engineGetActionParticleConfig,
      getActionAnimationConfig: engineGetActionAnimationConfig,
      getActionImageConfig: engineGetActionImageConfig,
      getActionAudioConfig: engineGetActionAudioConfig,
      // 预览端遮蔽 "切换到 pointer"，否则引擎会改写 document.body.style.cursor，
      // 造成预览面板触发后整个 Workbench cursor 短暂被污染。
      getActionCursorFeedbackConfig: (actionConfig) => {
        const feedback = engineGetActionCursorFeedbackConfig(actionConfig);
        if (feedback.cursorOverride === "切换到 pointer") {
          return { ...feedback, cursorOverride: "跟随当前状态" };
        }
        return feedback;
      },
      getMaxActiveEffects: () => 200,
      getKeyFeedbackConfig: () => defaultKeyFeedbackConfig,
      getConfig: () => ({ schemes: [previewScheme], activeSchemeId: previewScheme.id }),
      getActiveScheme: () => previewScheme,
      isCurrentSiteEnabled: () => true,
      getActionConfig: (_scheme, actionId) => {
        const map = actionConfigsMapRef.current;
        if (map && map[actionId]) return map[actionId];
        return configRef.current;
      },
      getCursorStateBinding: (_scheme, _stateId, sourceActionId) => ({ actionId: sourceActionId, cursorStateId: "" }),
      resolveCursorStateId: () => "",
      matchesTriggerZone: (_target, _zone, _event, opts) => {
        // 预览 doubleClick 时不应触发 longPress
        if (opts?.actionId === "longPress" && actionIdRef.current !== "longPress") return false;
        return true;
      },
    };
    const engine = createEffectEngine({
      window,
      document,
      constants,
      state: engineState,
      configStore,
    });
    // 把效果根节点改挂到 stage 内的 host div，并把 fixed 后代退化为相对 host 定位。
    // ensureRoot 创建的 div 默认 position:fixed; inset:0; 这里覆盖为 absolute / 全填 host。
    const root = engine.visualEffects.ensureRoot();
    if (root.parentElement !== host) host.appendChild(root);
    root.style.position = "absolute";
    root.style.inset = "0";
    // host 自己是 transform 上下文（translateZ(0)），让 .cd-effect 的 position:fixed 在
    // 现代浏览器里改以 host 为 containing block —— 坐标系即变成 host 局部坐标。
    engineRef.current = { engine, state: engineState, root };
    return () => {
      try { engine.cursorOverlay.clearStateCursorOverlay(); } catch {}
      try { engine.visualEffects.clearOrbitalParticles(); } catch {}
      // close 异步返回 Promise，吞错即可（unmount 阶段对 fail-safe 不敏感）
      try { engineState.audioContext?.close().catch(() => {}); } catch {}
      if (doubleClickIdleTimeoutRef.current !== null) {
        window.clearTimeout(doubleClickIdleTimeoutRef.current);
        doubleClickIdleTimeoutRef.current = null;
      }
      if (root.parentElement) root.parentElement.removeChild(root);
      // STYLE_ID 用唯一前缀挂在 document.head，一并清理
      const style = document.getElementById(constants.STYLE_ID);
      if (style?.parentElement) style.parentElement.removeChild(style);
      engineRef.current = null;
    };
  }, []);

  // runId 变化 → 在 host 中心触发一次效果。disabled 时跳过（保持原 PreviewEffects 语义）。
  useEffect(() => {
    if (disabled) return;
    const handle = engineRef.current;
    const host = effectsHostRef.current;
    if (!handle || !host) return;
    const rect = host.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const cx = Math.round(rect.width / 2);
    const cy = Math.round(rect.height / 2);
    const aid = actionIdRef.current;

    if (doubleClickIdleTimeoutRef.current !== null) {
      window.clearTimeout(doubleClickIdleTimeoutRef.current);
      doubleClickIdleTimeoutRef.current = null;
    }

    // 模拟多步动作时更新视觉状态
    if (aid === "longPress") {
      const holdMs = config.holdMs || 420;
      setSimState({ type: "longPress-holding", startedAt: Date.now(), thresholdMs: holdMs });
      setLpProgress(0);
    } else if (aid === "doubleClick") {
      setSimState({ type: "doubleClick-waiting" });
      doubleClickIdleTimeoutRef.current = window.setTimeout(() => {
        setSimState({ type: "idle" });
        doubleClickIdleTimeoutRef.current = null;
      }, 300);
    } else {
      setSimState({ type: "idle" });
    }

    handle.engine.triggerHandlers.previewAt(cx, cy, undefined, undefined, aid);
    // triggerInterval 仅在 buildTimelineTracks / 触发频率里使用，这里依赖 runId 即可。
    void triggerInterval;
    void comboIndex;
  }, [runId, disabled, comboIndex, triggerInterval, config.holdMs]);

  // longPress 进度环 rAF 驱动
  useEffect(() => {
    if (simState.type !== "longPress-holding") {
      setLpProgress(0);
      return;
    }
    let raf: number;
    const animate = () => {
      const elapsed = Date.now() - simState.startedAt;
      const pct = Math.min(100, (elapsed / simState.thresholdMs) * 100);
      setLpProgress(pct);
      if (pct < 100) raf = requestAnimationFrame(animate);
      else setSimState({ type: "idle" });
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [simState]);

  // actionId 切换时重置引擎状态机
  useEffect(() => {
    const handle = engineRef.current;
    if (!handle) return;
    handle.state.lastLeftPointerDownAt = 0;
    handle.state.lastLeftPointerUpAt = 0;
    if (handle.state.longPressState?.timeoutId !== undefined) {
      window.clearTimeout(handle.state.longPressState.timeoutId);
    }
    if (doubleClickIdleTimeoutRef.current !== null) {
      window.clearTimeout(doubleClickIdleTimeoutRef.current);
      doubleClickIdleTimeoutRef.current = null;
    }
    handle.state.longPressState = null;
    setSimState({ type: "idle" });
  }, [actionId]);

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
        {simState.type === "longPress-holding" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="size-12 rounded-full border-2 border-slate-300"
              style={{
                background: `conic-gradient(#7C3AED ${lpProgress}%, transparent ${lpProgress}%)`,
              }}
            />
          </div>
        )}
        {simState.type === "doubleClick-waiting" && (
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
                    animation: `cursorDancePreviewBars ${480}ms ease-out ${soundDelay + bar * 60}ms 2`,
                    transformOrigin: "bottom",
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <InteractiveTimeline tracks={timeline.tracks} totalMs={timeline.totalMs} disabled={disabled} canEditEmptyState={!previewMode && !disabled} updateActionConfig={updateActionConfig} runId={runId} />
    </div>
  );
}

export function WorkbenchPreviewRail({ actionLabel, actionId = "leftClick", config, actionConfigsMap, disabled = false, previewMode = false, updateActionConfig, atmosphere }) {
  const [runId, setRunId] = useState(0);
  const [comboIndex, setComboIndex] = useState(1);
  const [autoPlay, setAutoPlay] = useState(true);
  const [triggerInterval, setTriggerInterval] = useState(1200);
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
  const comboWindowMs = textConfig.comboWindowMs || 900;
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

    // 多步动作模拟耗时长，自动播放间隔需要下限
    const simOverhead = actionId === "longPress"
      ? (config.holdMs || 420) + 400
      : actionId === "doubleClick"
        ? (config.holdMs || 320) + 400
        : 0;
    const effectiveInterval = Math.max(triggerInterval, simOverhead);

    const tick = () => {
      const now = Date.now();
      setRunId((value) => (value + 1) % 1000000);
      setComboIndex((prev) => {
        if (lastComboFireRef.current > 0 && now - lastComboFireRef.current <= comboWindowMs) return prev + 1;
        return 1;
      });
      lastComboFireRef.current = now;
    };

    timerRef.current = window.setInterval(tick, effectiveInterval);
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [autoPlay, disabled, triggerInterval, comboWindowMs, actionId, config.holdMs]);

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
            <div className="ml-1 flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2" aria-label="循环间隔">
              <span className="text-xs font-medium text-slate-500">循环间隔</span>
              <div className="hidden items-center gap-1 xl:flex">
                {INTERVAL_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className={cn(
                      "rounded-md px-1.5 py-0.5 text-2xs font-semibold transition-colors",
                      triggerInterval === preset.value
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    )}
                    onClick={() => setTriggerInterval(preset.value)}
                    disabled={disabled}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={200}
                max={5000}
                step={50}
                value={triggerInterval}
                disabled={disabled}
                onChange={(event) => setTriggerInterval(Number(event.target.value))}
                className="h-1.5 w-20 accent-slate-950"
                aria-label="调整循环间隔"
              />
              <span className="w-8 text-right text-xs font-semibold tabular-nums text-slate-900">{formatTriggerInterval(triggerInterval)}</span>
            </div>
          </div>
        }
      >
        <SimplePreviewStage config={config} disabled={disabled} runId={runId} comboIndex={displayComboIndex} actionId={actionId} actionConfigsMap={actionConfigsMap} outputs={outputs} triggerInterval={triggerInterval} previewMode={previewMode} updateActionConfig={updateActionConfig} atmosphere={atmosphere} />
      </Panel>
    </div>
  );
}
