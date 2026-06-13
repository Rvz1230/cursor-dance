import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/components/ui/utils";

export function ColorOptions({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const colors = ["#B45309", "#0F766E", "#0284C7", "#7C3AED", "#BE185D"];
  const normalizedValue = /^#[0-9a-f]{6}$/i.test(value || "") ? value.toUpperCase() : "#B45309";
  const [draft, setDraft] = useState(normalizedValue);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(normalizedValue);
  }, [normalizedValue]);

  function commitColor(nextColor: string) {
    const normalized = nextColor.trim().startsWith("#") ? nextColor.trim() : `#${nextColor.trim()}`;
    if (!/^#[0-9a-f]{6}$/i.test(normalized)) {
      setDraft(value || normalizedValue);
      setError("请输入 6 位十六进制颜色值。");
      return;
    }
    const upper = normalized.toUpperCase();
    setDraft(upper);
    setError("");
    onChange?.(upper);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="grid h-9 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-800 shadow-sm transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="size-5 rounded-md border border-slate-200" style={{ backgroundColor: normalizedValue }} />
          <span className="truncate font-mono text-sm uppercase">{normalizedValue}</span>
          <ChevronDown className="size-4 text-slate-400" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium text-slate-500">推荐颜色</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  disabled={disabled}
                  onClick={() => commitColor(color)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-xl border transition-colors disabled:cursor-not-allowed",
                    value?.toUpperCase() === color ? "border-slate-900 ring-2 ring-slate-200" : "border-slate-200 hover:border-slate-300"
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`选择颜色 ${color}`}
                >
                  {value?.toUpperCase() === color ? <Check className="size-4 text-white drop-shadow" aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-2">
            <input
              type="color"
              value={normalizedValue}
              disabled={disabled}
              aria-label="选择自定义飘字颜色"
              onChange={(event) => commitColor(event.target.value)}
              className="h-10 w-11 cursor-pointer rounded-xl border border-slate-200 bg-white p-1 disabled:cursor-not-allowed"
            />
            <Input
              value={draft}
              disabled={disabled}
              aria-label="输入飘字颜色十六进制值"
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                setDraft(event.target.value);
                setError("");
              }}
              onBlur={(event) => commitColor(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitColor(event.currentTarget.value);
              }}
              className="rounded-xl bg-white font-mono uppercase"
              placeholder="#B45309"
            />
          </div>
          {error ? <div className="text-xs text-rose-600">{error}</div> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
