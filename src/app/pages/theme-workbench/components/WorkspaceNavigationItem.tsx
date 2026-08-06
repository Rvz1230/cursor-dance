import type { ComponentType } from "react";
import { cn } from "@/components/ui/utils";

interface WorkspaceNavigationItemProps {
  item: {
    icon: ComponentType<{ className?: string }>;
    label: string;
  };
  active?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

export function WorkspaceNavigationItem({
  item,
  active = false,
  onClick,
  compact = false,
}: WorkspaceNavigationItemProps) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        compact
          ? "inline-flex h-7 whitespace-nowrap items-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium transition-[transform,color,background-color,border-color,box-shadow] active:scale-[0.97]"
          : "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
        compact
          ? active
            ? "border-slate-950 bg-slate-950 text-white shadow-sm"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          : active
            ? "bg-slate-100 text-slate-900"
            : "text-slate-600 hover:bg-white hover:text-slate-900",
      )}
    >
      <Icon className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
      <span className={cn(compact ? "" : "font-medium")}>{item.label}</span>
    </button>
  );
}
