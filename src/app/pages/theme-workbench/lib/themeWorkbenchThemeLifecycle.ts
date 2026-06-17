import { createThemeDraft } from "../model/workbenchSchema";
import { draftFromThemePack, themePackToThemeLibraryItem } from "./extensionConfig";

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function slugifyThemeName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function buildUniqueThemeId(name, existingIds) {
  const base = slugifyThemeName(name) || "custom-theme";
  if (!existingIds.has(base)) return base;
  let index = 2;
  while (existingIds.has(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}

export function buildUniqueThemeName(name, existingNames) {
  const trimmedName = String(name || "").trim() || "自定义主题";
  if (!existingNames.has(trimmedName)) return trimmedName;
  let index = 2;
  while (existingNames.has(`${trimmedName} ${index}`)) {
    index += 1;
  }
  return `${trimmedName} ${index}`;
}

export function resolveImportedThemePack(rawValue) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    throw new Error("导入失败：JSON 需要是一个主题对象。");
  }

  const candidate = rawValue.themePack || rawValue.theme || rawValue.pack || rawValue.cursordanceTheme || rawValue;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("导入失败：没有识别到可用的主题包。");
  }

  if (!candidate.workbenchDraft && !candidate.behavior && !candidate.cursorStates) {
    throw new Error("导入失败：主题包里缺少行为配置。");
  }

  return candidate;
}

function withActionResetBaseline(draft) {
  return {
    ...draft,
    resetActionConfigs: cloneValue(draft.actionConfigs),
  };
}

export function buildCreateThemePayload({ themeLibrary, draftsByTheme }, { name, description = "", basedOnThemeId = "blank" }) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("请先填写主题名称。");
  }

  const existingIds = new Set(themeLibrary.map((item) => item.id));
  const themeId = buildUniqueThemeId(trimmedName, existingIds);
  const baseDraft =
    basedOnThemeId === "blank"
      ? createThemeDraft(themeId)
      : withActionResetBaseline(cloneValue(draftsByTheme[basedOnThemeId] || createThemeDraft(themeId)));
  const basedOnTheme = themeLibrary.find((item) => item.id === basedOnThemeId);

  return {
    theme: {
      id: themeId,
      name: trimmedName,
      kind: "自定义",
      summary: description.trim() || (basedOnThemeId === "blank" ? "从空白模板开始。" : `基于 ${basedOnTheme?.name || "当前主题"} 创建。`),
      description: description.trim(),
      tone: basedOnTheme?.tone || "amber",
    },
    draft: baseDraft,
  };
}

export function buildDuplicateThemePayload({ themeLibrary, draftsByTheme }, themeId) {
  const sourceTheme = themeLibrary.find((item) => item.id === themeId);
  const sourceDraft = draftsByTheme[themeId];
  if (!sourceTheme || !sourceDraft) {
    throw new Error("复制失败：没有找到要复制的主题。");
  }

  const existingIds = new Set(themeLibrary.map((item) => item.id));
  const existingNames = new Set(themeLibrary.map((item) => item.name));
  const nextName = buildUniqueThemeName(`${sourceTheme.name} 副本`, existingNames);
  const nextId = buildUniqueThemeId(nextName, existingIds);

  return {
    duplicatedName: nextName,
    payload: {
      theme: {
        ...sourceTheme,
        id: nextId,
        name: nextName,
        kind: "自定义",
        summary: sourceTheme.description?.trim() ? sourceTheme.description.trim() : `复制自 ${sourceTheme.name}`,
        description: sourceTheme.description || "",
      },
      draft: withActionResetBaseline(cloneValue(sourceDraft)),
    },
  };
}

export function buildDeleteThemePlan(themeLibrary, themeId) {
  const themeIndex = themeLibrary.findIndex((item) => item.id === themeId);
  if (themeIndex < 0) {
    throw new Error("删除失败：没有找到对应主题。");
  }

  const theme = themeLibrary[themeIndex];
  if (theme.kind === "内置") {
    throw new Error("内置主题不能删除，请先复制成自定义主题再编辑。");
  }
  if (themeLibrary.length <= 1) {
    throw new Error("至少保留一个主题后才能删除当前主题。");
  }

  const fallbackTheme = themeLibrary[themeIndex + 1] || themeLibrary[themeIndex - 1] || themeLibrary[0];
  return {
    themeName: theme.name,
    nextSelectedThemeId: fallbackTheme?.id || "",
  };
}

export function buildImportedThemePayload(themeLibrary, parsedValue, fileName = "") {
  const importedThemePack = resolveImportedThemePack(parsedValue);
  const fallbackName = fileName.replace(/\.[^.]+$/, "").trim();
  const resolvedName = importedThemePack.name || fallbackName || "导入主题";
  const existingIds = new Set(themeLibrary.map((item) => item.id));
  const nextId = buildUniqueThemeId(importedThemePack.id || resolvedName, existingIds);
  const nextThemePack = {
    ...cloneValue(importedThemePack),
    id: nextId,
    name: resolvedName,
    kind: importedThemePack.kind || "custom",
  };

  return {
    theme: themePackToThemeLibraryItem(nextThemePack, themeLibrary.length),
    draft: draftFromThemePack(nextThemePack),
  };
}
