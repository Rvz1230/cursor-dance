import { cn } from "@/components/ui/utils";

export function DataPill({ children, tone = "slate", className }: { children: React.ReactNode; tone?: "slate" | "teal" | "amber" | "rose"; className?: string }) {
  const toneClass =
    tone === "teal"
      ? "bg-teal-50 text-teal-700 ring-teal-200"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : tone === "rose"
          ? "bg-rose-50 text-rose-700 ring-rose-200"
          : "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-lg px-2 py-1 text-xs font-medium ring-1", toneClass, className)}>
      {children}
    </span>
  );
}
