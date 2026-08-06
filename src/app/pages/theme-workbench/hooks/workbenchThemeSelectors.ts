import type { WorkbenchTheme } from "./workbenchStateTypes";

export function findWorkbenchTheme(
  themes: readonly WorkbenchTheme[],
  themeId: string,
): WorkbenchTheme | undefined {
  return themes.find((theme) => theme.meta.id === themeId);
}

export function hasWorkbenchTheme(
  themes: readonly WorkbenchTheme[],
  themeId: string,
): boolean {
  return themes.some((theme) => theme.meta.id === themeId);
}
