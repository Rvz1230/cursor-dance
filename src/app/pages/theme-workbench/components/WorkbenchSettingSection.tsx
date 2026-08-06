import type { ReactNode } from "react";
import { cn } from "@/components/ui/utils";

interface WorkbenchSettingSectionProps {
  disabled?: boolean;
  children: ReactNode;
}

export function WorkbenchSettingSection({
  disabled = false,
  children,
}: WorkbenchSettingSectionProps) {
  return (
    <div className={cn("border-t border-slate-100 pt-4 first:border-t-0 first:pt-0", disabled && "opacity-50")}>
      {children}
    </div>
  );
}
