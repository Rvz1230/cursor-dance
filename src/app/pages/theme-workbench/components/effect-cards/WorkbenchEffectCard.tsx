import { useState, type ComponentType, type ReactNode } from "react";
import { ChevronRight, Clock3 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/components/ui/utils";
import {
  EFFECT_PRESETS,
  findMatchingPreset,
  getCardChangedCount,
  getCardSettingCount,
  getCardTimeLabel,
  type EffectPreset,
} from "../../lib/effectCardModel";

interface WorkbenchEffectCardProps {
  id: string;
  cardKey: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  enabled?: boolean;
  always?: boolean;
  config: Record<string, unknown>;
  baseline?: Record<string, unknown>;
  presets?: EffectPreset[];
  onChange(patch: Record<string, unknown>): void;
  onToggle?(enabled: boolean): void;
  onReset?(): void;
  children: ReactNode;
  primary?: ReactNode;
  primaryCount?: number;
  settingCount?: number;
}

export function WorkbenchEffectCard({
  id,
  cardKey,
  title,
  icon: Icon,
  enabled = true,
  always = false,
  config,
  baseline = {},
  presets = EFFECT_PRESETS[cardKey] || [],
  onChange,
  onToggle,
  onReset,
  children,
  primary,
  primaryCount = 3,
  settingCount,
}: WorkbenchEffectCardProps) {
  const [folded, setFolded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const changedCount = getCardChangedCount(cardKey, config, baseline);
  const activePreset = findMatchingPreset(presets, config);
  const totalSettings = settingCount ?? getCardSettingCount(cardKey);
  const timeLabel = getCardTimeLabel(cardKey, config);
  const on = always || enabled;

  if (!on) {
    return (
      <section id={id} aria-label={title} data-state="closed" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-400 ring-1 ring-transparent">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-sm font-medium text-slate-900">{title}</span>
            <span className="ml-2 text-xs text-slate-500">{totalSettings} 项设置</span>
          </span>
          {onToggle ? <Switch checked={false} onCheckedChange={onToggle} aria-label={`${title}开关`} /> : null}
        </div>
      </section>
    );
  }

  return (
    <section id={id} aria-label={title} data-state={folded ? "closed" : "open"} className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-900 ring-1 ring-slate-900/15">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block shrink-0 whitespace-nowrap text-sm font-medium text-slate-900">{title}</span>
          <span className="block truncate text-2xs text-slate-500">
            {activePreset?.name || "自定义"}{changedCount ? ` · ${changedCount} 项已改` : ""} · {totalSettings} 项设置
          </span>
        </span>
        {timeLabel ? (
          <button
            type="button"
            className="inline-flex min-w-0 shrink items-center gap-1 rounded-lg bg-slate-50 px-1.5 py-0.5 text-xs font-medium tabular-nums text-slate-500 ring-1 ring-slate-200 transition-colors hover:bg-slate-100 hover:text-slate-900"
            title={`在时间轴中查看 ${title}：${timeLabel}`}
            onClick={() => (document.getElementById(`timeline-track-${cardKey}`) || document.getElementById("preview-timeline"))?.scrollIntoView({ behavior: "smooth", block: "center" })}
          >
            <Clock3 className="size-2.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{timeLabel}</span>
          </button>
        ) : null}
        {changedCount && onReset ? (
          <button type="button" onClick={onReset} className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
            重置
          </button>
        ) : null}
        <button
          type="button"
          className="grid size-6 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label={`${folded ? "展开" : "折叠"}${title}`}
          aria-expanded={!folded}
          onClick={() => setFolded((value) => !value)}
        >
          <ChevronRight className={cn("size-3.5 transition-transform", !folded && "rotate-90")} />
        </button>
        {!always && onToggle ? <Switch checked={enabled} onCheckedChange={onToggle} aria-label={`${title}开关`} /> : null}
      </div>

      {!folded ? (
        <div className={cn("space-y-3 px-3 pt-3", always ? "pb-3.5" : "pb-4")}>
          {presets.length ? (
            <div>
              <div className="mb-2 flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-600">预设</span>
                <span className="text-2xs text-slate-500">点一下填一组参数，再微调</span>
              </div>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${title}预设`}>
                {presets.map((preset) => {
                  const selected = activePreset?.name === preset.name;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onChange(preset.patch)}
                      className={cn(
                        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-2xs font-medium shadow-sm transition-colors",
                        selected
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                      )}
                    >
                      <PresetSample cardKey={cardKey} preset={preset} />
                      {preset.name}
                      {selected && changedCount ? <span className="font-normal opacity-70">·已改</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {always ? <div className="space-y-2.5 border-t border-slate-100 pt-3">{children}</div> : null}
          {primary && !always ? <div className="space-y-2.5 border-t border-slate-100 pt-3">{primary}</div> : null}
          {!always ? <div className="border-t border-slate-100 pt-2.5">
            <button
              type="button"
              aria-expanded={showAll}
              onClick={() => setShowAll((value) => !value)}
              className="flex w-full items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900"
            >
              <ChevronRight className={cn("size-3 transition-transform", showAll && "rotate-90")} />
              {primary ? `其余 ${Math.max(0, totalSettings - primaryCount)} 项` : `全部 ${totalSettings} 项设置`}
              <span className="ml-auto inline-flex items-center gap-1 text-2xs font-normal text-slate-500">
                按 <kbd className="rounded bg-slate-100 px-1 py-0.5 font-sans text-2xs">⌘K</kbd> 可直接搜字段
              </span>
            </button>
            {showAll ? <div className="mt-3 space-y-4 rounded-lg bg-slate-50/70 px-2.5 py-2.5 ring-1 ring-slate-200/70">{children}</div> : null}
          </div> : null}
        </div>
      ) : null}
    </section>
  );
}

function PresetSample({ cardKey, preset }: { cardKey: string; preset: EffectPreset }) {
  if (cardKey === "particle") {
    const count = Math.max(3, Math.min(7, Math.round(Number(preset.patch.particleCount || 12) / 4)));
    return (
      <span className="relative block h-4 w-7 shrink-0" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <i
            key={index}
            className="absolute size-1 rounded-full bg-current"
            style={{ left: `${4 + (index * 7) % 21}px`, top: `${2 + (index * 5) % 11}px` }}
          />
        ))}
      </span>
    );
  }
  if (cardKey === "ripple") {
    return <span className="relative block size-4 shrink-0 rounded-full border border-current before:absolute before:inset-1 before:rounded-full before:border before:border-current" aria-hidden="true" />;
  }
  if (cardKey === "text") {
    return <span className="inline-flex h-4 w-5 items-center justify-center text-xs font-bold leading-none" aria-hidden="true">A↑</span>;
  }
  return null;
}
