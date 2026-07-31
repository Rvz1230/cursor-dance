import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// @keep-in-sync with landing/src/lib/utils.js
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
