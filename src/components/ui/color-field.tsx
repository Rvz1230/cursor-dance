import { useEffect, useState } from "react";
import { Check, ChevronDown, Pipette } from "lucide-react";
import { CONTENT_PALETTE, normalizeHexColor } from "./control-data";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Slider } from "./slider";
import { cn } from "./utils";

export interface ColorFieldProps {
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  label?: string;
  palette?: readonly string[];
  opacity?: number;
  onOpacityChange?: (opacity: number) => void;
  compact?: boolean;
}

export function ColorField({
  value,
  onChange,
  disabled = false,
  label = "颜色",
  palette = CONTENT_PALETTE,
  opacity,
  onOpacityChange,
  compact = false,
}: ColorFieldProps) {
  const normalizedValue = normalizeHexColor(value) ?? CONTENT_PALETTE[0];
  const [draft, setDraft] = useState(normalizedValue);
  const [error, setError] = useState("");

  useEffect(() => { setDraft(normalizedValue); }, [normalizedValue]);

  function commitColor(nextColor: string) {
    const normalized = normalizeHexColor(nextColor);
    if (!normalized) {
      setDraft(normalizedValue);
      setError("请输入 6 位十六进制颜色值。");
      return;
    }
    setDraft(normalized);
    setError("");
    if (normalized !== normalizedValue) onChange?.(normalized);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || !onChange}
          aria-label={`${label}：${normalizedValue}`}
          className={cn(
            "items-center text-left text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            compact
              ? "flex h-6 w-auto gap-1.5 rounded-lg"
              : "grid h-9 w-full grid-cols-[auto_minmax(0,1fr)_auto] gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm hover:border-slate-300",
          )}
        >
          {compact ? palette.slice(0, 7).map((color) => (
            <span
              key={color}
              className={cn("size-6 rounded-lg border", normalizeHexColor(color) === normalizedValue ? "border-slate-950 ring-1 ring-slate-300" : "border-slate-200")}
              style={{ backgroundColor: color }}
            />
          )) : (
            <>
              <span className="size-5 rounded-md border border-slate-200" style={{ backgroundColor: normalizedValue }} />
              <span className="truncate font-mono text-sm">{normalizedValue}</span>
              <ChevronDown className="size-4 text-slate-400" aria-hidden="true" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 rounded-2xl shadow-lg">
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium text-slate-600">推荐颜色</div>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={`${label}色板`}>
              {palette.map((color) => {
                const normalizedColor = normalizeHexColor(color) ?? color;
                const selected = normalizedValue === normalizedColor;
                return (
                  <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled}
                    onClick={() => commitColor(color)}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed",
                      selected ? "border-slate-950 ring-2 ring-slate-200" : "border-slate-200 hover:border-slate-400",
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`${label} ${color}`}
                  >
                    {selected ? <Check className={cn("size-4 drop-shadow", normalizedColor === "#FFFFFF" ? "text-slate-950" : "text-white")} aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-[44px_minmax(0,1fr)_40px] gap-2">
            <input
              type="color"
              value={normalizedValue}
              disabled={disabled}
              aria-label={`选择自定义${label}`}
              onChange={(event) => commitColor(event.target.value)}
              className="h-10 w-11 cursor-pointer rounded-xl border border-slate-200 bg-white p-1 disabled:cursor-not-allowed"
            />
            <Input
              value={draft}
              disabled={disabled}
              aria-label={`输入${label}十六进制值`}
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                setDraft(event.target.value);
                setError("");
              }}
              onBlur={(event) => commitColor(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitColor(event.currentTarget.value);
                if (event.key === "Escape") {
                  setDraft(normalizedValue);
                  setError("");
                }
              }}
              className="rounded-xl bg-white font-mono"
              placeholder="#F59E0B"
            />
            <span
              className="grid size-10 place-items-center rounded-xl border border-slate-200"
              style={{ backgroundColor: normalizedValue, opacity: opacity === undefined ? 1 : opacity / 100 }}
              title="结果预览"
              aria-label={`结果预览 ${normalizedValue}${opacity === undefined ? "" : `，不透明度 ${opacity}%`}`}
            >
              <Pipette className={cn("size-4", normalizedValue === "#FFFFFF" ? "text-slate-500" : "text-white")} aria-hidden="true" />
            </span>
          </div>
          {opacity !== undefined ? (
            <Slider
              label={`${label}不透明度`}
              value={opacity}
              min={0}
              max={100}
              suffix="%"
              onChange={onOpacityChange}
              disabled={disabled}
            />
          ) : null}
          {error ? <div className="text-xs text-rose-600">{error}</div> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
