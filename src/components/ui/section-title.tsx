import { cn } from "@/components/ui/utils";

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 text-xs font-medium text-slate-600 text-balance">{children}</div>;
}
