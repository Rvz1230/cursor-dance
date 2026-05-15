import { useEffect, useState } from "react";
import { Check, ChevronDown, Copy, Download, MousePointer2, Plus, Trash2, Wand2, X } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion.jsx";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.jsx";
import { Slider } from "@/components/ui/slider.jsx";
import { Select } from "@/components/ui/select.jsx";
import { cn } from "@/components/ui/utils.js";
import { toneClasses } from "../model/workbenchSchema.js";

export function Panel({
  title,
  action,
  icon: Icon,
  iconTone = "bg-slate-200 text-slate-700",
  children,
  className,
  contentClassName,
  collapsible = false,
  defaultOpen = true,
  summary,
  enabled,
}) {
  const header = (
    <div className="flex min-w-0 items-center gap-3">
      {Icon ? (
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", iconTone)}>
          <Icon className="size-4" />
        </div>
      ) : null}
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-slate-900 text-balance">{title}</h3>
        </div>
        {summary ? <div className="mt-0.5 truncate text-xs text-slate-500 text-pretty">{summary}</div> : null}
      </div>
    </div>
  );

  if (collapsible) {
    return (
      <Accordion key={defaultOpen ? "open" : "closed"} type="single" collapsible defaultValue={defaultOpen ? "content" : undefined} className={className}>
        <AccordionItem value="content" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <AccordionTrigger className="group flex min-w-0 flex-1 items-center justify-between gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2">
              {header}
              <ChevronDown className="size-4 shrink-0 text-slate-400 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
            </AccordionTrigger>
            {action ? <div className="ml-3 shrink-0">{action}</div> : null}
          </div>
          <AccordionContent className="px-4 py-3.5">{children}</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }

  return (
    <section className={cn("overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
      <div className="flex flex-wrap items-start gap-3 border-b border-slate-200 px-4 py-3.5">
        <div className="min-w-0 flex-1">{header}</div>
        {action ? <div className="flex max-w-full shrink-0 items-center">{action}</div> : null}
      </div>
      <div className={cn("px-4 py-3.5", contentClassName)}>{children}</div>
    </section>
  );
}

export function SectionTitle({ children }) {
  return <div className="mb-3 text-sm font-semibold text-slate-900 text-balance">{children}</div>;
}

export function DataPill({ children, tone = "slate" }) {
  const toneClass =
    tone === "teal"
      ? "bg-teal-50 text-teal-700 ring-teal-200"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : tone === "rose"
          ? "bg-rose-50 text-rose-700 ring-rose-200"
          : "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1", toneClass)}>
      {children}
    </span>
  );
}

export function SmallSelect({ value, options, onChange, label }) {
  const disabled = !onChange;
  return <Select value={value} options={options} onValueChange={onChange} disabled={disabled} aria-label={label || "选择配置项"} />;
}

export function FieldRow({ label, hint, control }) {
  return (
    <div className="grid gap-1.5 border-b border-slate-100 py-3 last:border-b-0 md:grid-cols-[116px_minmax(0,1fr)] md:items-center md:gap-4">
      <div>
        <div className="text-sm font-medium text-slate-800">{label}</div>
      </div>
      <div>{control}</div>
    </div>
  );
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function WorkbenchAccordionPanel(props) {
  return <Panel collapsible {...props} />;
}

export function ControlSlider({ value, min, max, onValueChange, suffix = "", disabled = false, label = "数值" }) {
  function commitValue(nextValue) {
    onValueChange?.([clampNumber(nextValue, min, max)]);
  }

  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)_88px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5", disabled && "opacity-50")}>
      <Slider className="flex-1" value={[value]} min={min} max={max} onValueChange={(next) => commitValue(next[0])} disabled={disabled} aria-label={label} />
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center rounded-xl bg-white px-2.5 py-1.5 ring-1 ring-slate-200">
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
          className="min-w-0 bg-transparent text-right text-sm font-semibold tabular-nums text-slate-800 outline-none disabled:cursor-not-allowed"
        />
        {suffix ? <span className="ml-0.5 shrink-0 text-xs font-medium text-slate-500">{suffix}</span> : null}
      </div>
    </div>
  );
}

export function ColorOptions({ value, onChange, disabled = false }) {
  const colors = ["#B45309", "#0F766E", "#0284C7", "#7C3AED", "#BE185D"];
  const normalizedValue = /^#[0-9a-f]{6}$/i.test(value || "") ? value.toUpperCase() : "#B45309";
  const [draft, setDraft] = useState(normalizedValue);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(normalizedValue);
  }, [normalizedValue]);

  function commitColor(nextColor) {
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
          className="grid h-10 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-800 shadow-sm shadow-slate-100/60 transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                    "flex size-9 items-center justify-center rounded-xl border transition-transform disabled:cursor-not-allowed",
                    value?.toUpperCase() === color ? "border-slate-900 ring-2 ring-slate-200" : "border-slate-200 hover:scale-[1.03]"
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

export function TextTagEditor({ tags, onChange, disabled = false }) {
  const [draft, setDraft] = useState("");

  function addTag() {
    const next = draft.trim();
    if (!next) return;
    if (tags.includes(next)) {
      setDraft("");
      return;
    }
    onChange([...tags, next]);
    setDraft("");
  }

  function removeTag(tag) {
    onChange(tags.filter((item) => item !== tag));
  }

  return (
    <div className="space-y-3">
      <div className={cn("flex flex-wrap gap-2", disabled && "opacity-50")}>
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
            <span>{tag}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeTag(tag)}
              aria-label={`删除标签 ${tag}`}
              className="rounded-full p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        {tags.length === 0 ? <div className="text-sm text-slate-500">还没有标签，先添加一个文本内容。</div> : null}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTag();
            }
          }}
          placeholder="输入一个文本标签，例如：已命中"
          className="rounded-2xl bg-white"
        />
        <Button
          variant="outline"
          size="icon"
          className="shrink-0 rounded-2xl"
          onClick={addTag}
          disabled={disabled}
          aria-label="添加标签"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function SettingSection({ disabled = false, children }) {
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3", disabled && "bg-slate-50 opacity-55")}>
      {children}
    </div>
  );
}

export function ThemeCard({ theme, selected, onClick, onDuplicate, onExport, onDelete, canDelete = true }) {
  const tones = toneClasses(theme.tone);
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-white/80 transition-colors",
        selected ? "border-emerald-200 bg-emerald-50/55 shadow-sm" : "border-slate-200/80 hover:border-slate-300 hover:bg-white"
      )}
    >
      {selected ? <div className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-emerald-600" aria-hidden="true" /> : null}
      <button type="button" onClick={onClick} className="w-full px-3.5 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2">
        <div className="flex items-start gap-3">
          <div className={cn("mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl", selected ? "bg-white text-emerald-700 ring-1 ring-emerald-200" : tones.icon)}>
            <Wand2 className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-semibold text-slate-900">{theme.name}</div>
              <DataPill tone={theme.kind === "内置" ? "teal" : "amber"}>{theme.kind}</DataPill>
              {selected ? <Check className="size-4 shrink-0 text-emerald-700" aria-label="当前选中" /> : null}
            </div>
            <div className={cn("mt-1.5 text-sm text-pretty", selected ? "text-slate-700" : "text-slate-600")}>{theme.summary}</div>
          </div>
        </div>
      </button>
      <div className={cn("grid grid-cols-3 gap-1.5 px-3.5 pb-3 transition-opacity", selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100")}>
        <Button variant="outline" className="h-8 rounded-xl px-2 text-xs" onClick={onDuplicate}>
          <Copy className="mr-1.5 size-3.5" />
          复制
        </Button>
        <Button variant="outline" className="h-8 rounded-xl px-2 text-xs" onClick={onExport}>
          <Download className="mr-1.5 size-3.5" />
          导出
        </Button>
        <Button
          variant="ghost"
          className="h-8 rounded-xl px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:text-slate-400"
          onClick={onDelete}
          disabled={!canDelete}
        >
          <Trash2 className="mr-1.5 size-3.5" />
          删除
        </Button>
      </div>
    </div>
  );
}

export function NativeCursorPreview({ size = 48 }) {
  return (
    <div className="relative" style={{ width: `${size}px`, height: `${size}px` }} aria-label="系统原生鼠标指针预览">
      <MousePointer2 className="absolute left-1 top-1 size-[70%] -rotate-12 fill-white text-slate-950 drop-shadow-sm" />
      <span className="absolute left-[38%] top-[40%] size-2 rounded-full bg-emerald-500 ring-2 ring-white" aria-hidden="true" />
    </div>
  );
}

export function WorkspaceItem({ item, active, onClick, compact = false }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        compact
          ? "inline-flex whitespace-nowrap items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors"
          : "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors",
        compact
          ? active
            ? "border-slate-950 bg-slate-950 text-white shadow-sm"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          : active
            ? "bg-emerald-50 text-emerald-800"
            : "text-slate-600 hover:bg-white hover:text-slate-900"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="font-medium">{item.label}</span>
    </button>
  );
}

export function ActionTab({ item, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-w-fit rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      )}
    >
      {item.label}
    </button>
  );
}

export function PreviewBadge({ children, tone = "slate" }) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-white text-slate-600";
  return <span className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", toneClass)}>{children}</span>;
}
