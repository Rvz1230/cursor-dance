import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { NumberField } from "./number-field";
import { useFieldSliderScrub } from "./field-row";
import { cn } from "./utils";

export function clampSliderValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function snapSliderValue(
  value: number,
  min: number,
  max: number,
  step: number,
  ticks: readonly number[] = [],
  snapToTicks = false,
  disableSnap = false,
): number {
  const stepText = String(step).toLowerCase();
  const decimalPlaces = stepText.includes("e-")
    ? Number(stepText.split("e-")[1])
    : (stepText.split(".")[1]?.length ?? 0);
  const stepped = Number((Math.round(value / step) * step).toFixed(Math.min(12, decimalPlaces)));
  if (!snapToTicks || disableSnap) return clampSliderValue(stepped, min, max);
  const threshold = (max - min) * 0.03;
  const tick = ticks.find((candidate) => Math.abs(candidate - stepped) <= threshold);
  return clampSliderValue(tick ?? stepped, min, max);
}

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange?: (value: number) => void;
  onPreview?: (value: number) => void;
  defaultValue?: number;
  ticks?: readonly number[];
  snapToTicks?: boolean;
  bipolar?: boolean;
  suffix?: string;
  disabled?: boolean;
  label: string;
  className?: string;
  showInput?: boolean;
  compact?: boolean;
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  onPreview,
  defaultValue,
  ticks = [],
  snapToTicks = false,
  bipolar = false,
  suffix = "",
  disabled = false,
  label,
  className,
  showInput = true,
  compact = false,
}: SliderProps) {
  const [draftValue, setDraftValue] = useState(() => clampSliderValue(value, min, max));
  const [isInteracting, setIsInteracting] = useState(false);
  const draftRef = useRef(draftValue);
  const altPressedRef = useRef(false);
  const enabled = !disabled && Boolean(onChange);

  useEffect(() => {
    if (isInteracting) return;
    const nextValue = clampSliderValue(value, min, max);
    draftRef.current = nextValue;
    setDraftValue(nextValue);
  }, [isInteracting, max, min, value]);

  function preview(nextValue: number, disableSnap = altPressedRef.current) {
    const next = snapSliderValue(nextValue, min, max, step, ticks, snapToTicks, disableSnap);
    draftRef.current = next;
    setDraftValue(next);
    onPreview?.(next);
    return next;
  }

  function commit(nextValue = draftRef.current) {
    const next = preview(nextValue);
    setIsInteracting(false);
    if (next !== value) onChange?.(next);
  }

  useFieldSliderScrub(enabled ? (event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startValue = draftRef.current;
    setIsInteracting(true);
    const move = (moveEvent: PointerEvent) => {
      altPressedRef.current = moveEvent.altKey;
      preview(startValue + Math.round((moveEvent.clientX - startX) / 2) * step, moveEvent.altKey);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      commit();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  } : null);

  const percent = max === min ? 0 : ((draftValue - min) / (max - min)) * 100;
  const zeroPercent = max === min ? 0 : ((clampSliderValue(0, min, max) - min) / (max - min)) * 100;
  const fillStyle = bipolar
    ? { left: `${Math.min(zeroPercent, percent)}%`, width: `${Math.abs(percent - zeroPercent)}%` }
    : { left: "0%", width: `${percent}%` };
  const defaultPercent = defaultValue === undefined || max === min
    ? null
    : ((clampSliderValue(defaultValue, min, max) - min) / (max - min)) * 100;
  const dirty = defaultValue !== undefined && draftValue !== defaultValue;
  const tickPercents = useMemo(
    () => ticks.map((tick) => (max === min ? 0 : ((clampSliderValue(tick, min, max) - min) / (max - min)) * 100)),
    [max, min, ticks],
  );

  function handleShiftArrow(event: KeyboardEvent<HTMLSpanElement>) {
    const direction = {
      ArrowLeft: -1,
      ArrowDown: -1,
      ArrowRight: 1,
      ArrowUp: 1,
    }[event.key];
    if (!direction || !event.shiftKey || !enabled) return;
    event.preventDefault();
    commit(draftRef.current + direction * step * 10);
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-2", disabled && "opacity-60", className)}>
      <div
        className={cn("relative min-w-0 flex-1", compact ? "py-0" : "py-3")}
        onPointerDownCapture={(event: ReactPointerEvent<HTMLDivElement>) => {
          if (!enabled) return;
          altPressedRef.current = event.altKey;
          setIsInteracting(true);
        }}
        onPointerMoveCapture={(event) => { altPressedRef.current = event.altKey; }}
      >
        <SliderPrimitive.Root
          className="relative flex h-5 w-full touch-none select-none items-center"
          value={[draftValue]}
          min={min}
          max={max}
          step={step}
          disabled={!enabled}
          onValueChange={(values) => preview(values[0])}
          onValueCommit={(values) => commit(values[0])}
          aria-label={label}
        >
          <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-visible rounded-full bg-slate-200">
            <span className="absolute inset-y-0 rounded-full bg-slate-900" style={fillStyle} />
            {tickPercents.map((tickPercent, index) => (
              <span
                key={`${ticks[index]}-${index}`}
                className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400"
                style={{ left: `${tickPercent}%` }}
                aria-hidden="true"
              />
            ))}
          </SliderPrimitive.Track>
          {defaultPercent !== null ? (
            <span
              className="pointer-events-none absolute bottom-0 size-0 -translate-x-1/2 border-x-4 border-b-0 border-t-4 border-x-transparent border-t-slate-300"
              style={{ left: `${defaultPercent}%` }}
              aria-hidden="true"
            />
          ) : null}
          <SliderPrimitive.Thumb
            className="group relative block size-4 rounded-full border-2 border-slate-900 bg-white shadow-sm ring-2 ring-white transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-300 disabled:cursor-not-allowed"
            aria-label={label}
            onKeyDown={handleShiftArrow}
            onDoubleClick={(event) => {
              if (!enabled || defaultValue === undefined) return;
              event.stopPropagation();
              commit(defaultValue);
            }}
          >
            <span
              className={cn(
                "pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded-lg bg-slate-950 px-2 py-1 text-xs font-semibold tabular-nums text-white shadow-lg transition-opacity",
                isInteracting ? "opacity-100" : "opacity-0",
              )}
              aria-hidden="true"
            >
              {draftValue}{suffix}
              <span className="absolute left-1/2 top-full size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-slate-950" />
            </span>
          </SliderPrimitive.Thumb>
        </SliderPrimitive.Root>
      </div>
      {dirty ? <span className="size-1.5 shrink-0 rounded-full bg-amber-500" title="已偏离默认值" aria-label="已偏离默认值" /> : null}
      {showInput ? (
        <NumberField
          value={draftValue}
          min={min}
          max={max}
          step={step}
          unit={suffix}
          disabled={!enabled}
          ariaLabel={label}
          onChange={commit}
          compact={compact}
        />
      ) : null}
    </div>
  );
}
