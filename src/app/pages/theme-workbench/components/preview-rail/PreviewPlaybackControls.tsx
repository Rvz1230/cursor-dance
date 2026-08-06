import { Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/components/ui/utils";

const INTERVAL_PRESETS = [
  { label: "慢速", value: 2400 },
  { label: "标准", value: 1200 },
  { label: "快速", value: 600 },
];

function formatTriggerInterval(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;
}

interface PreviewPlaybackControlsProps {
  autoPlay: boolean;
  disabled: boolean;
  triggerInterval: number;
  onReplay: () => void;
  onToggleAutoPlay: () => void;
  onTriggerIntervalChange: (value: number) => void;
}

export function PreviewPlaybackControls({
  autoPlay,
  disabled,
  triggerInterval,
  onReplay,
  onToggleAutoPlay,
  onTriggerIntervalChange,
}: PreviewPlaybackControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Button variant="outline" size="icon" className="size-8 rounded-lg" onClick={onReplay} disabled={disabled} aria-label="重播预览" title="重播">
        <RotateCcw className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="size-8 rounded-lg"
        onClick={onToggleAutoPlay}
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
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
              )}
              onClick={() => onTriggerIntervalChange(preset.value)}
              disabled={disabled}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <Slider
          className="w-20"
          label="调整循环间隔"
          min={200}
          max={5000}
          step={50}
          value={triggerInterval}
          disabled={disabled}
          onChange={onTriggerIntervalChange}
          showInput={false}
        />
        <span className="w-8 text-right text-xs font-semibold tabular-nums text-slate-900">{formatTriggerInterval(triggerInterval)}</span>
      </div>
    </div>
  );
}
