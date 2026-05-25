import { cn } from "./utils.js";

export function BrandMark({ className, size = "default" }) {
  const dimensions = size === "sm" ? "size-8" : "size-10";

  return (
    <div className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-full", dimensions, className)}>
      <img src="logo.svg" alt="CursorDance" className="size-full object-contain" />
    </div>
  );
}
