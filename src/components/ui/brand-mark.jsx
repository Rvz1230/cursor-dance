import { cn } from "./utils.js";

export function BrandMark({ className, size = "default" }) {
  const dimensions = size === "sm" ? "size-8" : "size-10";
  const ringClass = size === "sm" ? "size-7 border-[5px]" : "size-10 border-[6px]";
  const starClass = size === "sm" ? "h-3 w-3 right-0.5 top-1.5" : "h-3.5 w-3.5 right-1 top-2";

  return (
    <div className={cn("relative flex items-center justify-center", dimensions, className)}>
      <div className={cn("rounded-full border-r-transparent border-emerald-600", ringClass)} />
      <div className={cn("absolute text-amber-400", starClass)}>
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 0.8 9.4 5.1 13.7 6.5 9.4 7.9 8 12.2 6.6 7.9 2.3 6.5 6.6 5.1 8 0.8Z" />
        </svg>
      </div>
    </div>
  );
}
