import { useEffect, useMemo, useRef } from "react";
import { Circle, Pause, Play, Trash2, Volume2 } from "lucide-react";
import { cn } from "@/components/ui/utils";
import {
  getPreviewSoundFile,
  getPreviewTriggerSummary,
} from "../../lib/preview";
import { getActionAudioConfig } from "../../model/workbenchSchema";
import { getActionCursorFeedbackConfig } from "@/shared/effect-core/action-config";
import { AtmosphereStagePreview } from "../AtmosphereStagePreview";
import { getCursorTrailConfig } from "@/shared/config/cursor-trail";
import {
  createCursorTrailSurface,
  type CursorTrailSurface,
} from "@/shared/effect-runtime/cursor-trail-surface";
import { usePreviewEngineHost } from "./usePreviewEngineHost";
import { usePreviewPointer } from "./usePreviewPointer";
import { useTrailPathEditor } from "./useTrailPathEditor";

export function PreviewStage({ config, comparisonConfig, compareMode, disabled, runId, comboIndex, actionId, actionConfigsMap, triggerInterval, atmosphere, background, onReplay }) {
  const audioConfig = useMemo(() => getActionAudioConfig(config), [config]);
  const trailHostRef = useRef<HTMLDivElement | null>(null);
  const trailSurfaceRef = useRef<CursorTrailSurface | null>(null);
  const trailConfig = useMemo(() => {
    const value = getCursorTrailConfig(atmosphere);
    return disabled ? { ...value, enabled: false } : value;
  }, [atmosphere, disabled]);

  useEffect(() => {
    const root = trailHostRef.current;
    if (!root) return undefined;
    const surface = createCursorTrailSurface({
      window,
      document,
      root,
      blendWithPage: true,
      respectReducedMotion: false,
      zIndex: 1,
    });
    trailSurfaceRef.current = surface;
    return () => {
      surface.destroy();
      if (trailSurfaceRef.current === surface) trailSurfaceRef.current = null;
    };
  }, []);

  useEffect(() => {
    trailSurfaceRef.current?.syncConfig(trailConfig);
  }, [trailConfig]);

  useEffect(() => {
    const feedback = getActionCursorFeedbackConfig(config);
    trailSurfaceRef.current?.setStateColor(typeof feedback.cursorGlowColor === "string" ? feedback.cursorGlowColor : null);
  }, [config]);

  const soundDelay = typeof audioConfig.soundDelay === "number" ? audioConfig.soundDelay : 0;

  const {
    stageRef,
    pointer,
    onPointerMove,
    onPointerLeave,
  } = usePreviewPointer();
  const trailEditor = useTrailPathEditor({
    enabled: trailConfig.enabled,
    stageRef,
    surfaceRef: trailSurfaceRef,
  });
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
  const comparisonConfigsMap = useMemo(() => ({
    ...(actionConfigsMap || {}),
    [actionId]: comparisonConfig || config,
  }), [actionConfigsMap, actionId, comparisonConfig, config]);
  const { effectsHostRef: comparisonHostRef } = usePreviewEngineHost({
    actionId,
    actionConfigsMap: comparisonConfigsMap,
    comboIndex,
    config: comparisonConfig || config,
    disabled: disabled || !compareMode,
    runId,
    triggerInterval,
  });

  const backgrounds = {
    light: { backgroundColor: "#ffffff", backgroundImage: "linear-gradient(180deg,#fff,#f8fafc)" },
    dark: { backgroundColor: "#0f172a", backgroundImage: "linear-gradient(135deg,#1e293b,#020617)" },
    checker: { backgroundColor: "#fff", backgroundImage: "linear-gradient(45deg,#eef2f6 25%,transparent 25%,transparent 75%,#eef2f6 75%),linear-gradient(45deg,#eef2f6 25%,transparent 25%,transparent 75%,#eef2f6 75%)", backgroundSize: "16px 16px", backgroundPosition: "0 0,8px 8px" },
    finder: { backgroundColor: "#f6f7f9", backgroundImage: "linear-gradient(180deg,#fff 0 26px,transparent 26px),repeating-linear-gradient(180deg,transparent 0 34px,#e8ebef 34px 35px),linear-gradient(90deg,#eceff3 0 128px,transparent 128px)" },
    browser: { backgroundColor: "#fff", backgroundImage: "linear-gradient(180deg,#f1f3f6 0 30px,transparent 30px),repeating-linear-gradient(180deg,transparent 0 12px,#e6e9ee 12px 14px)", backgroundSize: "100% 100%,62% 100%", backgroundPosition: "0 0,19% 44px", backgroundRepeat: "no-repeat" },
    deck: { backgroundColor: "#0f172a", backgroundImage: "linear-gradient(120deg,#1e293b 0%,#0f172a 60%),linear-gradient(90deg,#334155 0 46%,transparent 46%)", backgroundSize: "100% 100%,60% 10px", backgroundPosition: "0 0,20% 34%", backgroundRepeat: "no-repeat" },
  } as const;

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pt-3">
      <div
        ref={stageRef}
        data-testid="trail-preview-stage"
        className="relative min-h-[240px] flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white"
        style={{
          ...backgrounds[background],
          cursor: cursorEnabled && pointer.inside ? "none" : undefined,
        }}
        onPointerDown={(event) => {
          trailSurfaceRef.current?.press();
          if (!trailEditor.handlePointerDown(event)) onReplay();
        }}
        onPointerMove={(event) => {
          onPointerMove(event);
          if (trailEditor.handlePointerMove(event)) return;
          const rect = event.currentTarget.getBoundingClientRect();
          trailSurfaceRef.current?.move(event.clientX - rect.left, event.clientY - rect.top);
        }}
        onPointerUp={trailEditor.finishRecording}
        onPointerCancel={trailEditor.finishRecording}
        onPointerLeave={() => {
          onPointerLeave();
          if (trailEditor.mode !== "recording" && trailEditor.mode !== "playing") trailSurfaceRef.current?.leave();
        }}
      >
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-center" aria-hidden="true">
          <div>
            <div className={cn("text-xs font-medium", background === "dark" || background === "deck" ? "text-slate-300" : "text-slate-500")}>在这里{getPreviewTriggerSummary(config).includes("滚") ? "滚动" : "单击"}试试</div>
            <div className={cn("mt-1 text-2xs", background === "dark" || background === "deck" ? "text-slate-400" : "text-slate-500")}>或拖下面的播放头逐帧检视</div>
          </div>
        </div>

        {/* 引擎效果挂载点。translateZ(0) 创造 transform 上下文，
            让引擎里 .cd-effect 的 position:fixed 改以本节点为 containing block，
            坐标系直接落到 host 局部，不会污染 Workbench 其他区域。 */}
        <div
          ref={effectsHostRef}
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ transform: "translateZ(0)" }}
          aria-hidden="true"
        />
        <div ref={comparisonHostRef} className="pointer-events-none absolute inset-0 overflow-hidden opacity-35 grayscale" style={{ transform: "translateZ(0)" }} aria-hidden="true" />
        {compareMode ? <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-lg bg-slate-900 px-2 py-1 text-xs font-medium text-white">灰色叠层 = 当前主题初始值</div> : null}
        <div ref={trailHostRef} className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true" />

        {trailConfig.enabled ? (
          <TrailPathEditorOverlay editor={trailEditor} />
        ) : null}

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
    </div>
  );
}

function TrailPathEditorOverlay({ editor }) {
  const hasPath = editor.path.length >= 2;
  const status = {
    idle: "录一段路径，调参时自动循环",
    armed: "按住预览区并画出轨迹",
    recording: `正在录制 · ${editor.path.length} 点`,
    playing: "循环播放中",
    paused: "路径已暂停",
  }[editor.mode];

  return (
    <>
      {hasPath ? (
        <svg className="pointer-events-none absolute inset-0 z-10 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <polyline
            points={editor.path.map((point) => `${point.x * 100},${point.y * 100}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.55"
            strokeDasharray="1.5 1.5"
            vectorEffect="non-scaling-stroke"
            className={cn("text-slate-500 transition-opacity", editor.mode === "playing" ? "opacity-20" : "opacity-45")}
          />
        </svg>
      ) : null}
      <div
        data-trail-editor-state={editor.mode}
        className="absolute left-3 top-3 z-30 flex max-w-[calc(100%-24px)] items-center gap-1.5 rounded-xl border border-white/70 bg-white/90 p-1.5 shadow-sm backdrop-blur"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-pressed={editor.mode === "armed" || editor.mode === "recording"}
          onClick={editor.armRecording}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
            editor.mode === "armed" || editor.mode === "recording"
              ? "bg-rose-600 text-white"
              : "bg-slate-950 text-white hover:bg-slate-800",
          )}
        >
          <Circle className={cn("size-3", editor.mode === "recording" && "fill-current")} aria-hidden="true" />
          {hasPath ? "重录" : "录制路径"}
        </button>
        <button
          type="button"
          disabled={!hasPath}
          aria-label={editor.mode === "playing" ? "暂停轨迹循环" : "播放轨迹循环"}
          onClick={editor.togglePlayback}
          className="grid size-7 place-items-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
        >
          {editor.mode === "playing" ? <Pause className="size-3" aria-hidden="true" /> : <Play className="size-3" aria-hidden="true" />}
        </button>
        <button
          type="button"
          disabled={!hasPath && editor.mode !== "armed"}
          aria-label="清除录制路径"
          onClick={editor.clearPath}
          className="grid size-7 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Trash2 className="size-3" aria-hidden="true" />
        </button>
        <span className="min-w-0 truncate px-1 text-2xs text-slate-500">{status}</span>
      </div>
    </>
  );
}
