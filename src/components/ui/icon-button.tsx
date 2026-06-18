import React from "react";
import { Tooltip } from "./tooltip";
import { cn } from "./utils";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tooltip?: string;
  side?: "top" | "right" | "bottom" | "left";
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, tooltip, side = "top", className, children, ...props }, ref) => {
    const button = (
      <button
        type="button"
        ref={ref}
        aria-label={label}
        className={cn(
          "inline-flex items-center justify-center rounded-xl text-slate-500 transition-[transform,color,background-color,border-color,box-shadow,opacity] hover:bg-slate-100 hover:text-slate-900 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );

    return tooltip ? (
      <Tooltip content={tooltip} side={side}>
        {button}
      </Tooltip>
    ) : button;
  },
);
IconButton.displayName = "IconButton";
