import { cn } from "@/components/ui/utils";

interface WorkbenchActionTabProps {
  item: {
    id: string;
    label: string;
    hint?: string;
  };
  active?: boolean;
  onClick?: () => void;
}

export function WorkbenchActionTab({ item, active = false, onClick }: WorkbenchActionTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-w-fit rounded-xl border px-3 py-1.5 text-xs font-medium transition-[transform,color,background-color,border-color,box-shadow] active:scale-[0.97]",
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
      )}
    >
      {item.label}
    </button>
  );
}
