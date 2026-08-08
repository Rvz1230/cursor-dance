import { cn } from "./utils";
import logoUrl from "../../../extension/logo.svg?url";

export function BrandMark({ className, size = "default" }: { className?: string; size?: "default" | "sm" }) {
  const dimensions = size === "sm" ? "size-8" : "size-10";

  return (
    <div className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-full", dimensions, className)}>
      <img src={logoUrl} alt="CursorDance" className="size-full object-contain" />
    </div>
  );
}
