import type { AriaRole, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "./utils";

const toneMap = {
  success: {
    icon: CheckCircle2,
    className: "border-emerald-100 bg-emerald-50 text-emerald-800",
    iconClassName: "text-emerald-500",
  },
  error: {
    icon: XCircle,
    className: "border-rose-100 bg-rose-50 text-rose-700",
    iconClassName: "text-rose-500",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-amber-100 bg-amber-50 text-amber-800",
    iconClassName: "text-amber-500",
  },
  info: {
    icon: Info,
    className: "border-sky-100 bg-sky-50 text-sky-700",
    iconClassName: "text-sky-500",
  },
  neutral: {
    icon: Info,
    className: "border-slate-100 bg-slate-50 text-slate-500",
    iconClassName: "text-slate-400",
  },
};

interface InlineStatusProps {
  children: ReactNode;
  tone?: keyof typeof toneMap;
  className?: string;
  showIcon?: boolean;
  role?: AriaRole;
}

export function InlineStatus({ children, tone = "info", className, showIcon = true, role = "status" }: InlineStatusProps) {
  const meta = toneMap[tone] || toneMap.info;
  const Icon = meta.icon;

  return (
    <div
      role={role}
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-5 text-pretty",
        meta.className,
        className,
      )}
    >
      {showIcon ? <Icon className={cn("mt-0.5 size-3.5 shrink-0", meta.iconClassName)} aria-hidden="true" /> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
