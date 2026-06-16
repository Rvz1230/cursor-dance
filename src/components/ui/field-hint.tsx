import { HelpCircle } from "lucide-react";
import { cn } from "./utils";
import { Tooltip } from "./tooltip";

export function FieldHint({ content, className }) {
  if (!content) return null;
  return (
    <Tooltip content={content}>
      <HelpCircle className={cn("size-3.5 shrink-0 text-slate-400", className)} />
    </Tooltip>
  );
}
