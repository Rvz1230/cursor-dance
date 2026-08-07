import { Pause, Play, Radio, Repeat2, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { cn } from "@/components/ui/utils";

const INTERVAL_PRESETS = [
  { label: "慢", value: 2400 },
  { label: "标准", value: 1200 },
  { label: "快", value: 600 },
];

interface PreviewPlaybackControlsProps {
  autoPlay: boolean;
  disabled: boolean;
  triggerInterval: number;
  isPlaying: boolean;
  currentTimeMs: number;
  totalMs: number;
  playbackSpeed: number;
  loopEnabled: boolean;
  onReplay(): void;
  onTogglePlayback(): void;
  onStepBackward(): void;
  onStepForward(): void;
  onToggleLoop(): void;
  onToggleAutoPlay(): void;
  onPlaybackSpeedChange(value: number): void;
  onTriggerIntervalChange(value: number): void;
}

export function PreviewPlaybackControls(props: PreviewPlaybackControlsProps) {
  const iconButton = "grid size-7 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40";
  return (
    <div className="z-10 flex shrink-0 items-center gap-2 border-t border-slate-100 bg-white px-4 py-2 [&>*]:shrink-0">
      <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button type="button" className={iconButton} disabled={props.disabled} onClick={props.onTogglePlayback} aria-label={props.isPlaying ? "暂停" : "播放"}>
          {props.isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>
        <button type="button" className={iconButton} disabled={props.disabled} onClick={props.onStepBackward} aria-label="后退一帧"><SkipBack className="size-3.5" /></button>
        <button type="button" className={iconButton} disabled={props.disabled} onClick={props.onStepForward} aria-label="前进一帧"><SkipForward className="size-3.5" /></button>
        <button type="button" className={iconButton} disabled={props.disabled} onClick={props.onReplay} aria-label="重播"><RotateCcw className="size-3.5" /></button>
      </div>

      <div className="hidden items-center rounded-xl bg-slate-100 p-0.5 xl:flex" role="radiogroup" aria-label="播放倍速">
        {[1, 0.5, 0.25].map((speed) => (
          <button
            key={speed}
            type="button"
            role="radio"
            aria-checked={props.playbackSpeed === speed}
            onClick={() => props.onPlaybackSpeedChange(speed)}
            className={cn("h-6 rounded-lg px-2 text-2xs font-medium transition-colors", props.playbackSpeed === speed ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
          >
            {speed}×
          </button>
        ))}
      </div>
      <select
        value={props.playbackSpeed}
        onChange={(event) => props.onPlaybackSpeedChange(Number(event.target.value))}
        aria-label="播放倍速"
        className="h-7 w-[72px] rounded-lg border border-slate-200 bg-white px-1.5 text-xs font-medium text-slate-600 outline-none xl:hidden"
      >
        <option value={1}>1×</option>
        <option value={0.5}>0.5×</option>
        <option value={0.25}>0.25×</option>
      </select>

      <button type="button" className={cn("inline-flex h-7 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium", props.loopEnabled ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 text-slate-600")} aria-pressed={props.loopEnabled} onClick={props.onToggleLoop} title="循环区间">
        <Repeat2 className="size-3.5" /><span className="hidden 2xl:inline">循环区间</span>
      </button>
      <button type="button" className={cn("inline-flex h-7 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium", props.autoPlay ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 text-slate-600")} aria-pressed={props.autoPlay} onClick={props.onToggleAutoPlay} title="自动重播">
        <Radio className="size-3.5" /><span className="hidden 2xl:inline">自动重播</span>
      </button>
      {props.autoPlay ? (
        <div className="hidden items-center rounded-xl bg-slate-100 p-0.5 2xl:flex" role="radiogroup" aria-label="自动重播间隔">
          {INTERVAL_PRESETS.map((preset) => (
            <button key={preset.value} type="button" role="radio" aria-checked={props.triggerInterval === preset.value} onClick={() => props.onTriggerIntervalChange(preset.value)} className={cn("h-6 rounded-lg px-2 text-2xs font-medium", props.triggerInterval === preset.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>{preset.label}</button>
          ))}
        </div>
      ) : null}
      <span className="ml-auto inline-flex h-7 items-center gap-1 rounded-xl bg-slate-50 px-2.5 text-xs font-semibold tabular-nums text-slate-700 ring-1 ring-slate-200">
        <span>{Math.round(props.currentTimeMs)}</span><span className="text-slate-400">/</span><span>{props.totalMs}</span><span className="font-normal text-slate-500">ms</span>
      </span>
    </div>
  );
}
