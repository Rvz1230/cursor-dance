import { useMemo, useState, type ReactNode } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, Search } from "lucide-react";
import { FONTS, SHAPE_PATH, getBezierOvershoot, getEasingPoints, type BezierPoints, type ShapeName } from "./control-data";
import { cn } from "./utils";

type SelectOption<T extends string = string> = T | {
  readonly value: T;
  readonly label: string;
  readonly description?: string;
  readonly group?: string;
  readonly preview?: ReactNode;
  readonly side?: ReactNode;
};

interface NormalizedSelectOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  group?: string;
  preview?: ReactNode;
  side?: ReactNode;
}

export interface SelectProps<T extends string> {
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange?: (value: T) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  searchable?: boolean;
  label?: string;
  "aria-label"?: string;
}

function EasingPreview({ points }: { points: BezierPoints }) {
  const [x1, y1, x2, y2] = points;
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        d={`M2 22 C ${2 + x1 * 20} ${22 - y1 * 20}, ${2 + x2 * 20} ${22 - y2 * 20}, 22 2`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

const SHAPE_ALIASES: Partial<Record<string, ShapeName>> = {
  点状粒子: "圆点",
  圆点: "圆点",
  方块: "方块",
  星光: "星形",
  星形: "星形",
  钻石: "钻石",
};

function normalizeOption<T extends string>(option: SelectOption<T>): NormalizedSelectOption<T> {
  if (typeof option !== "string") return option;
  const easingPoints = getEasingPoints(option);
  if (easingPoints) {
    const overshoot = getBezierOvershoot(easingPoints);
    return {
      value: option,
      label: option,
      description: overshoot > 0 ? `过冲 ${overshoot.toFixed(1)}%` : undefined,
      preview: <EasingPreview points={easingPoints} />,
    };
  }
  const font = FONTS.find((candidate) => candidate.value === option);
  if (font) {
    return {
      value: option,
      label: option,
      group: font.group,
      side: <span style={{ fontFamily: font.stack }}>Nice! 123</span>,
    };
  }
  const shapeName = SHAPE_ALIASES[option];
  if (shapeName) {
    return {
      value: option,
      label: option,
      preview: <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SHAPE_PATH[shapeName] }} />,
    };
  }
  return { value: option, label: option };
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = "请选择",
  className,
  searchable,
  label,
  "aria-label": ariaLabel,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const normalizedOptions = useMemo(() => options.map(normalizeOption), [options]);
  const showSearch = searchable ?? normalizedOptions.length > 8;
  const visibleOptions = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return normalizedOptions;
    return normalizedOptions.filter((option) => (
      `${option.label} ${option.value} ${option.description ?? ""} ${option.group ?? ""}`
        .toLocaleLowerCase()
        .includes(needle)
    ));
  }, [normalizedOptions, query]);
  const selectedOption = normalizedOptions.find((option) => option.value === value);
  const groups = visibleOptions.reduce<Array<{ label?: string; options: NormalizedSelectOption<T>[] }>>((result, option) => {
    const current = result[result.length - 1];
    if (!current || current.label !== option.group) result.push({ label: option.group, options: [option] });
    else current.options.push(option);
    return result;
  }, []);

  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={(nextValue) => onChange?.(nextValue as T)}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
      open={open}
      disabled={disabled || !onChange}
    >
      <SelectPrimitive.Trigger
        className={cn(
          "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-700 shadow-sm outline-none transition-colors hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        aria-label={ariaLabel || label || placeholder}
        title={selectedOption?.label ?? String(value || placeholder)}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {selectedOption?.preview ? <span className="size-5 shrink-0">{selectedOption.preview}</span> : null}
          <span className="min-w-0 flex-1 truncate whitespace-nowrap">{selectedOption?.label || value || placeholder}</span>
          {selectedOption?.side ? <span className="hidden shrink-0 text-xs text-slate-400 sm:block">{selectedOption.side}</span> : null}
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          {showSearch ? (
            <div className="relative m-1 mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
                placeholder="筛选选项"
                aria-label={`筛选${ariaLabel || label || "选项"}`}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-sm text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              />
            </div>
          ) : null}
          <SelectPrimitive.Viewport className="max-h-72 overflow-y-auto">
            {groups.map((group, groupIndex) => (
              <SelectPrimitive.Group key={`${group.label ?? "default"}-${groupIndex}`}>
                {group.label ? (
                  <SelectPrimitive.Label className="px-3 pb-1 pt-2 text-2xs font-semibold text-slate-400">
                    {group.label}
                  </SelectPrimitive.Label>
                ) : null}
                {group.options.map((option) => (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    className="relative flex min-h-10 cursor-default select-none items-center gap-2 rounded-lg py-2 pl-8 pr-3 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100 data-[highlighted]:text-slate-950 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                    title={option.description || option.label}
                  >
                    <SelectPrimitive.ItemIndicator className="absolute left-2.5 inline-flex items-center">
                      <Check className="size-4" aria-hidden="true" />
                    </SelectPrimitive.ItemIndicator>
                    {option.preview ? <span className="size-5 shrink-0">{option.preview}</span> : null}
                    <span className="min-w-0 flex-1">
                      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                      {option.description ? <span className="mt-0.5 block truncate text-2xs text-slate-400">{option.description}</span> : null}
                    </span>
                    {option.side ? <span className="shrink-0 text-xs text-slate-400">{option.side}</span> : null}
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.Group>
            ))}
            {visibleOptions.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-slate-400">没有匹配项</div>
            ) : null}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
