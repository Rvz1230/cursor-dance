import { RotateCcw } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/components/ui/utils";

interface ResetCardButtonProps {
  dirty: boolean;
  onReset: () => void;
  ariaLabel?: string;
}

export function ResetCardButton({ dirty, onReset, ariaLabel = "重置该卡片到默认值" }: ResetCardButtonProps) {
  if (!dirty) return null;
  return (
    <Tooltip content={ariaLabel} side="top">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onReset();
        }}
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-lg bg-transparent text-slate-400 transition-[transform,color,background-color,box-shadow] active:scale-[0.97]",
          "hover:bg-slate-100 hover:text-slate-900",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
        )}
        aria-label={ariaLabel}
      >
        <RotateCcw className="size-3.5" aria-hidden="true" />
      </button>
    </Tooltip>
  );
}
