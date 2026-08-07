import { Pause, Play, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/components/ui/utils";
import type { AppRule } from "@/shared/app-rules";
import type { RuleThemeOption } from "../context-rules/RulePrimitives";
import type { ApplicationCandidate, RuleMatchState } from "./appRulesModel";

const APP_ICON_TONES = [
  "bg-slate-900",
  "bg-sky-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-sky-700",
];

function iconTone(name: string): string {
  const hash = [...name].reduce((value, character) => value + character.charCodeAt(0), 0);
  return APP_ICON_TONES[hash % APP_ICON_TONES.length];
}

export function ApplicationIcon({
  application,
  small = false,
}: {
  application: Pick<ApplicationCandidate, "name" | "iconDataUrl">;
  small?: boolean;
}) {
  const className = cn(small ? "app-icon-sm" : "app-icon", iconTone(application.name));
  return application.iconDataUrl ? (
    <img src={application.iconDataUrl} alt="" className={cn(className, "bg-transparent object-contain")} />
  ) : (
    <span className={className} aria-hidden="true">{(application.name.trim()[0] || "A").toLocaleUpperCase()}</span>
  );
}

export function themeName(themes: RuleThemeOption[], themeId?: string): string {
  if (!themeId) return "跟随全局";
  return themes.find((theme) => theme.id === themeId)?.name || themeId;
}

export function MatchBadge({ state, coveredBy }: { state: RuleMatchState; coveredBy?: string }) {
  if (state === "active") {
    return <span className="adv-badge bg-emerald-50 text-emerald-800"><span className="size-1.5 rounded-full bg-emerald-500" />此刻命中</span>;
  }
  if (state === "shadowed") {
    return <span className="adv-badge bg-slate-100 text-slate-500">{coveredBy ? `被${coveredBy}覆盖` : "被上面的规则挡住"}</span>;
  }
  return null;
}

export function RuleMenu({
  rule,
  onToggle,
  onDelete,
  label,
}: {
  rule: AppRule;
  onToggle: () => void;
  onDelete: () => void;
  label: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="row-menu" aria-label={`${label}的更多操作`}>
          <svg className="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[184px] overflow-hidden p-1">
        <button type="button" className="row-menu-item rounded-lg" onClick={onToggle}>
          {rule.enabled === false ? <Play className="size-3.5 shrink-0" /> : <Pause className="size-3.5 shrink-0" />}
          {rule.enabled === false ? "恢复这条规则" : "暂停这条规则"}
        </button>
        <button type="button" className="row-menu-item row-menu-item-danger rounded-lg" onClick={onDelete}>
          <Trash2 className="size-3.5 shrink-0" />删除
        </button>
      </PopoverContent>
    </Popover>
  );
}
