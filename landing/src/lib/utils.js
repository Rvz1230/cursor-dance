import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// @keep-in-sync with src/components/ui/utils.js
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
