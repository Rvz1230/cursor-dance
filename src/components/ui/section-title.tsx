import { cn } from "@/components/ui/utils";

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 text-sm font-semibold text-slate-900 text-balance">{children}</div>;
}
