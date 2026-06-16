import { useEffect, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/components/ui/utils";

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function ControlSlider({
  value,
  min,
  max,
  onValueChange,
  suffix = "",
  disabled = false,
  label = "数值",
}: {
  value: number;
  min: number;
  max: number;
  onValueChange?: (values: [number]) => void;
  suffix?: string;
  disabled?: boolean;
  label?: string;
}) {
  const [isInteracting, setIsInteracting] = useState(false);
  const percent = max === min ? 0 : ((clampNumber(value, min, max) - min) / (max - min)) * 100;

  useEffect(() => {
    if (!isInteracting) return undefined;
    const stopInteracting = () => setIsInteracting(false);
    window.addEventListener("pointerup", stopInteracting);
    window.addEventListener("pointercancel", stopInteracting);
    return () => {
      window.removeEventListener("pointerup", stopInteracting);
      window.removeEventListener("pointercancel", stopInteracting);
    };
  }, [isInteracting]);

  function commitValue(nextValue: number) {
    onValueChange?.([clampNumber(nextValue, min, max)]);
  }

  return (
    <div className={cn("flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2", disabled && "opacity-50")}>
      <div
        className="relative flex-1 min-w-0 py-2"
        onPointerDown={() => {
          if (!disabled) setIsInteracting(true);
        }}
        onFocusCapture={() => {
          if (!disabled) setIsInteracting(true);
        }}
        onBlurCapture={() => setIsInteracting(false)}
      >
        <Slider className="flex-1" value={[value]} min={min} max={max} onValueChange={(next) => commitValue(next[0])} disabled={disabled} aria-label={label} />
        <div
          className={cn(
            "pointer-events-none absolute -top-7 z-10 -translate-x-1/2 rounded-lg bg-slate-950 px-2 py-1 text-xs font-semibold tabular-nums text-white shadow-lg transition-opacity",
            isInteracting ? "opacity-100" : "opacity-0"
          )}
          style={{ left: `${Math.max(5, Math.min(95, percent))}%` }}
          aria-hidden="true"
        >
          {value}{suffix}
          <span className="absolute left-1/2 top-full size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-slate-950" />
        </div>
      </div>
      <div className="relative shrink-0 inline-grid rounded-xl bg-white ring-1 ring-slate-200">
        <span className="invisible col-start-1 row-start-1 px-2 py-1.5 text-sm tabular-nums" aria-hidden="true">
          {String(value)}{suffix}
        </span>
        <div className="col-start-1 row-start-1 flex items-center gap-0.5 px-2 py-1.5">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            disabled={disabled}
            inputMode="numeric"
            aria-label={label}
            onChange={(event) => {
              const raw = event.target.value;
              if (raw === "") return;
              commitValue(Number(raw));
            }}
            onBlur={(event) => commitValue(Number(event.target.value))}
            className="w-full bg-transparent pr-0.5 text-right text-sm tabular-nums text-slate-700 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed"
          />
          {suffix ? <span className="shrink-0 text-xs font-medium text-slate-500">{suffix}</span> : null}
        </div>
      </div>
    </div>
  );
}
