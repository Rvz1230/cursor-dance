export type DesktopWindowKind = "workbench" | "overlay";

export const DESKTOP_WINDOW_KIND_ARGUMENT = "--cursordance-window-kind=";

export function desktopWindowKindArgument(kind: DesktopWindowKind): string {
  return `${DESKTOP_WINDOW_KIND_ARGUMENT}${kind}`;
}

export function resolveDesktopWindowKind(argv: readonly string[]): DesktopWindowKind | null {
  for (let index = argv.length - 1; index >= 0; index -= 1) {
    const argument = argv[index];
    if (!argument.startsWith(DESKTOP_WINDOW_KIND_ARGUMENT)) continue;
    const value = argument.slice(DESKTOP_WINDOW_KIND_ARGUMENT.length);
    return value === "workbench" || value === "overlay" ? value : null;
  }
  return null;
}
