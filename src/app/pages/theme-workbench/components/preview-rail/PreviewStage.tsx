import { useEffect, useMemo, useState } from "react";
import { Volume2 } from "lucide-react";
import { cn } from "@/components/ui/utils";
import {
  getPreviewSoundFile,
  getPreviewTriggerSummary,
} from "../../lib/preview";
import { getActionAudioConfig } from "../../model/workbenchSchema";
import { AtmosphereStagePreview } from "../AtmosphereStagePreview";
import { usePreviewEngineHost } from "./usePreviewEngineHost";
import { usePreviewPointer } from "./usePreviewPointer";

export function PreviewStage({ config, comparisonConfig, compareMode, disabled, runId, comboIndex, actionId, actionConfigsMap, triggerInterval, atmosphere, background, showTrail, onReplay }) {
  const audioConfig = useMemo(() => getActionAudioConfig(config), [config]);
  const [trailPoints, setTrailPoints] = useState<Array<{ x: number; y: number }>>([]);

  useEffect(() => {
    if (!showTrail) setTrailPoints([]);
  }, [showTrail]);

  const soundDelay = typeof audioConfig.soundDelay === "number" ? audioConfig.soundDelay : 0;

  const {
    stageRef,
    pointer,
    onPointerMove,
    onPointerLeave,
  } = usePreviewPointer();
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
        className="relative min-h-[220px] flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white"
        style={{
          ...backgrounds[background],
          cursor: cursorEnabled && pointer.inside ? "none" : undefined,
        }}
        onPointerDown={onReplay}
        onPointerMove={(event) => {
          onPointerMove(event);
          if (showTrail) {
            const rect = event.currentTarget.getBoundingClientRect();
            setTrailPoints((points) => [...points, { x: event.clientX - rect.left, y: event.clientY - rect.top }].slice(-8));
          }
        }}
        onPointerLeave={onPointerLeave}
      >
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center text-center" aria-hidden="true">
          <div>
            <div className={cn("text-xs font-medium", background === "dark" || background === "deck" ? "text-slate-300" : "text-slate-500")}>在这里{getPreviewTriggerSummary(config).includes("滚") ? "滚动" : "单击"}试试</div>
            <div className={cn("mt-1 text-2xs", background === "dark" || background === "deck" ? "text-slate-400" : "text-slate-500")}>拖动下方时间轴可调整节奏</div>
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
        {showTrail ? trailPoints.map((point, index) => (
          <span key={`${point.x}-${point.y}-${index}`} className="pointer-events-none absolute size-2 rounded-full bg-slate-900" style={{ left: point.x, top: point.y, opacity: (index + 1) / trailPoints.length * 0.35 }} />
        )) : null}

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
