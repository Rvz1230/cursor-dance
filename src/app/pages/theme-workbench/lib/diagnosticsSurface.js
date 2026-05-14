export const MAX_DIAGNOSTIC_ENTRIES = 80;

export function appendDiagnosticEntry(entries, entry, maxEntries = MAX_DIAGNOSTIC_ENTRIES) {
  const currentEntries = Array.isArray(entries) ? entries : [];
  if (!entry || typeof entry !== "object") {
    return currentEntries.slice(-maxEntries);
  }
  return [...currentEntries, entry].slice(-maxEntries);
}

export function summarizeLivePreviewConfig(config, selectedThemeId) {
  if (!config) {
    return {
      status: "inactive",
      label: "当前没有检测到未保存预览。",
      activeThemeId: "",
      themeCount: 0,
    };
  }

  const activeThemeId = config.activeThemePackId || config.activeSchemeId || "";
  const themeCount = Array.isArray(config.themePacks) ? config.themePacks.length : 0;

  if (activeThemeId && activeThemeId === selectedThemeId) {
    return {
      status: "current",
      label: "当前主题存在未保存预览覆盖。",
      activeThemeId,
      themeCount,
    };
  }

  if (activeThemeId) {
    return {
      status: "other",
      label: `检测到主题 ${activeThemeId} 的未保存预览覆盖。`,
      activeThemeId,
      themeCount,
    };
  }

  return {
    status: "unknown",
    label: "检测到未保存预览，但没有明确的主题标识。",
    activeThemeId: "",
    themeCount,
  };
}
