import { cn } from "@/components/ui/utils";

interface WorkbenchActionTabProps {
  item: {
    id: string;
    label: string;
    hint?: string;
  };
  active?: boolean;
  effectCount?: number;
  onClick?: () => void;
}

export function WorkbenchActionTab({ item, active = false, effectCount = 0, onClick }: WorkbenchActionTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 min-w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 text-xs font-medium shadow-sm transition-[transform,color,background-color,border-color,box-shadow] active:scale-[0.97]",
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
      )}
    >
      {item.label}
      {effectCount ? (
        <span className={cn(
          "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums",
          active ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700",
        )}>
          {effectCount}
        </span>
      ) : (
        <span className="text-xs font-normal opacity-50">未配置</span>
      )}
    </button>
  );
}
