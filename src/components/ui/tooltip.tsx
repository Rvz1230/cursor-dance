import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "./utils";

export function TooltipProvider({ children, delayDuration = 300 }) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export function Tooltip({ children, content, side = "top", className }) {
  if (!content) return children;
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-50 max-w-[260px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600 shadow-lg animate-in fade-in-0 zoom-in-95",
            className
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-white drop-shadow-sm" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
