import { useState } from "react";
import { Bell, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Slider } from "@/components/ui/slider.jsx";
import { cn } from "@/components/ui/utils.js";
import { toneClasses } from "../model/workbenchSchema.js";

export function Panel({ title, action, icon: Icon, iconTone = "bg-slate-200 text-slate-700", children, className }) {
  return (
    <section className={cn("overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm", className)}>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5">
        <div className="flex items-center gap-3">
          {Icon ? (
            <div className={cn("flex size-9 items-center justify-center rounded-2xl", iconTone)}>
              <Icon className="h-4 w-4" />
            </div>
          ) : null}
          <h3 className="text-sm font-semibold text-slate-900 text-balance">{title}</h3>
        </div>
        {action}
      </div>
      <div className="px-4 py-3.5">{children}</div>
    </section>
  );
}

export function SectionTitle({ children }) {
  return <div className="mb-3 text-xs font-medium uppercase text-slate-500">{children}</div>;
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

export function SmallSelect({ value, options, onChange }) {
  const disabled = !onChange;
  const selectOptions = options?.length ? options : [value];
  return (
    <select
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      disabled={disabled}
      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm shadow-slate-100/60 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {selectOptions.map((item) => {
        const optionValue = typeof item === "string" ? item : item.value;
        const optionLabel = typeof item === "string" ? item : item.label;
        return (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        );
      })}
    </select>
  );
}

export function FieldRow({ label, hint, control }) {
  return (
    <div className="grid gap-1.5 border-b border-slate-100 py-3 last:border-b-0 md:grid-cols-[116px_minmax(0,1fr)] md:items-center md:gap-4">
      <div>
        <div className="text-sm font-medium text-slate-800">{label}</div>
        {hint ? <div className="mt-0.5 text-[11px] leading-4 text-slate-500">{hint}</div> : null}
      </div>
      <div>{control}</div>
    </div>
  );
}

export function ControlSlider({ value, min, max, onValueChange, suffix = "", width = "w-14", disabled = false }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5", disabled && "opacity-50")}>
      <Slider className="flex-1" value={[value]} min={min} max={max} onValueChange={onValueChange} disabled={disabled} />
      <span className={cn("rounded-full bg-white px-2.5 py-1 text-right text-sm font-medium tabular-nums text-slate-700", width)}>
        {value}
        {suffix}
      </span>
    </div>
  );
}

export function ColorOptions({ value, onChange, disabled = false }) {
  const colors = ["#B45309", "#0F766E", "#0284C7", "#7C3AED", "#BE185D"];
  return (
    <div className={cn("flex flex-wrap gap-2", disabled && "opacity-50")}>
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          disabled={disabled}
          onClick={() => onChange(color)}
          className={cn(
            "flex size-9 items-center justify-center rounded-xl border transition-transform disabled:cursor-not-allowed",
            value === color ? "border-slate-900 ring-2 ring-slate-200" : "border-slate-200 hover:scale-[1.03]"
          )}
          style={{ backgroundColor: color }}
          aria-label={`选择颜色 ${color}`}
        >
          {value === color ? <span className="h-2.5 w-2.5 rounded-full bg-white/95" /> : null}
        </button>
      ))}
    </div>
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
        <Button variant="outline" className="rounded-2xl px-4" onClick={addTag} disabled={disabled}>
          <Plus className="mr-2 h-4 w-4" />
          添加
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

export function ThemeCard({ theme, selected, onClick }) {
  const tones = toneClasses(theme.tone);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-[24px] border px-4 py-4 text-left transition-colors",
        selected ? "border-slate-900 bg-white shadow-sm" : "border-slate-200/80 bg-white/72 hover:border-slate-300 hover:bg-white"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl", selected ? "bg-slate-900 text-white" : tones.icon)}>
          <Bell className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold text-slate-900">{theme.name}</div>
            <DataPill tone={theme.kind === "内置" ? "teal" : "amber"}>{theme.kind}</DataPill>
            {selected ? <span className="h-2.5 w-2.5 rounded-full bg-slate-900" aria-hidden="true" /> : null}
          </div>
          <div className={cn("mt-2 text-sm text-pretty", selected ? "text-slate-700" : "text-slate-600")}>{theme.summary}</div>
        </div>
      </div>
    </button>
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
