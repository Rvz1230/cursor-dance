/** @platform shared — 分段控件。形态见 docs/ui-spec/library/components.html。 */

import type { ReactNode } from "react";
import { cn } from "./utils";

interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** 不可用时必须给理由：一个点了没反应又不解释的段是最让人困惑的控件。 */
  disabledReason?: string;
}

interface SegmentedProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** 撑满一行并均分（用于两三个等重选项）。 */
  fill?: boolean;
  /** 整个控件不可用（所属效果被关掉时）。与单项的 disabledReason 是两个层级。 */
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
}

/**
 * 用原生 button 而非 Tabs：Tabs 语义上绑定「一组面板」，
 * 而这里绝大多数用途只是在切一个值（入场边、显示模式、启用/关闭）。
 * 真正的多页签容器仍然用 Tabs。
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  fill = false,
  disabled = false,
  ariaLabel,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1",
        fill && "flex w-full",
        disabled && "opacity-50",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        const itemDisabled = disabled || Boolean(option.disabledReason);
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={itemDisabled}
            title={option.disabledReason}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-7 items-center rounded-lg px-3 text-xs font-medium transition-colors",
              fill && "flex-1 justify-center",
              itemDisabled
                ? cn("cursor-not-allowed", active ? "bg-slate-300 text-white" : "text-slate-300")
                : active
                  ? "bg-slate-950 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
