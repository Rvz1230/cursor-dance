/** @platform shared — used by both extension and desktop */

const PLATFORM = typeof window !== "undefined" && "cursorDanceApp" in window
  ? "desktop" as const
  : "extension" as const;

export const isDesktop = () => PLATFORM === "desktop";
export const isExtension = () => PLATFORM === "extension";
