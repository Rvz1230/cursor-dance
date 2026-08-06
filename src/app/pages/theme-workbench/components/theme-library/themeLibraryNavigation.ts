export interface ThemeLibrarySearchItem {
  id: string;
  name: string;
  summary?: string;
  kind?: string;
}

export function filterThemeLibrary<T extends ThemeLibrarySearchItem>(themes: T[], query: string): T[] {
  const keyword = query.trim().toLocaleLowerCase();
  if (!keyword) return themes;

  return themes.filter((theme) =>
    [theme.name, theme.summary, theme.kind]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase().includes(keyword)),
  );
}

export function getThemeRovingId(
  themes: ThemeLibrarySearchItem[],
  selectedThemeId: string,
  focusedThemeId: string,
): string {
  if (themes.some((theme) => theme.id === focusedThemeId)) return focusedThemeId;
  if (themes.some((theme) => theme.id === selectedThemeId)) return selectedThemeId;
  return themes[0]?.id ?? "";
}

export function getThemeNavigationIndex(currentIndex: number, key: string, itemCount: number): number {
  if (itemCount <= 0) return -1;
  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;
  if (key === "ArrowDown") return Math.min(currentIndex + 1, itemCount - 1);
  if (key === "ArrowUp") return Math.max(currentIndex - 1, 0);
  return currentIndex;
}
