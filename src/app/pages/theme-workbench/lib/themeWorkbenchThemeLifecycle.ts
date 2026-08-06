import { createThemeDraft } from "../model/workbenchSchema";
import { draftFromThemePack, themePackToThemeLibraryItem } from "./workbenchConfig";
import { validateCursorDanceConfigV4 } from "@/shared/config-schema-v4";

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

function buildUniqueThemeId(name, existingIds) {
  const base = slugifyThemeName(name) || "custom-theme";
  if (!existingIds.has(base)) return base;
  let index = 2;
  while (existingIds.has(`${base}-${index}`)) {
    index += 1;
  }
  return `${base}-${index}`;
}

function buildUniqueThemeName(name, existingNames) {
  const trimmedName = String(name || "").trim() || "自定义主题";
  if (!existingNames.has(trimmedName)) return trimmedName;
  let index = 2;
  while (existingNames.has(`${trimmedName} ${index}`)) {
    index += 1;
  }
  return `${trimmedName} ${index}`;
}

function resolveImportedThemePack(rawValue) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    throw new Error("导入失败：JSON 需要是一个主题对象。");
  }

  if (rawValue.format !== "cursordance-theme" || rawValue.schemaVersion !== 4) {
    throw new Error("导入失败：只支持 CursorDance v4 主题文件。");
  }
  const candidate = rawValue.theme;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    throw new Error("导入失败：文件中没有 v4 主题。");
  }
  const validation = validateCursorDanceConfigV4({
    schemaVersion: 4,
    enabled: true,
    activeThemeId: candidate.id,
    themes: [candidate],
    contextRules: [],
    performance: { maxActiveEffects: 48 },
  });
  if (validation.ok === false) {
    throw new Error(`导入失败：v4 主题不完整（${validation.issues[0]?.path || "theme"}）。`);
  }
  return validation.value.themes[0];
}

function withActionResetBaseline(draft) {
  return {
    ...draft,
    resetActionConfigs: cloneValue(draft.actionConfigs),
  };
}

export function buildCreateThemePayload(themes, { name, description = "", basedOnThemeId = "blank" }) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("请先填写主题名称。");
  }

  const existingIds = new Set(themes.map((item) => item.meta.id));
  const themeId = buildUniqueThemeId(trimmedName, existingIds);
  const baseDraft =
    basedOnThemeId === "blank"
      ? createThemeDraft(themeId)
      : withActionResetBaseline(cloneValue(themes.find((item) => item.meta.id === basedOnThemeId)?.draft || createThemeDraft(themeId)));
  const basedOnTheme = themes.find((item) => item.meta.id === basedOnThemeId)?.meta;

  return {
    theme: {
      meta: {
        id: themeId,
        name: trimmedName,
        kind: "自定义",
        summary: description.trim() || (basedOnThemeId === "blank" ? "从空白模板开始。" : `基于 ${basedOnTheme?.name || "当前主题"} 创建。`),
        description: description.trim(),
        tone: basedOnTheme?.tone || "amber",
      },
      draft: baseDraft,
    },
  };
}

export function buildDuplicateThemePayload(themes, themeId) {
  const sourceTheme = themes.find((item) => item.meta.id === themeId);
  if (!sourceTheme) {
    throw new Error("复制失败：没有找到要复制的主题。");
  }

  const existingIds = new Set(themes.map((item) => item.meta.id));
  const existingNames = new Set(themes.map((item) => item.meta.name));
  const nextName = buildUniqueThemeName(`${sourceTheme.meta.name} 副本`, existingNames);
  const nextId = buildUniqueThemeId(nextName, existingIds);

  return {
    duplicatedName: nextName,
    payload: {
      theme: {
        meta: {
          ...sourceTheme.meta,
          id: nextId,
          name: nextName,
          kind: "自定义",
          summary: sourceTheme.meta.description?.trim() ? sourceTheme.meta.description.trim() : `复制自 ${sourceTheme.meta.name}`,
          description: sourceTheme.meta.description || "",
        },
        draft: withActionResetBaseline(cloneValue(sourceTheme.draft)),
      },
    },
  };
}

export function buildDeleteThemePlan(themes, themeId) {
  const themeIndex = themes.findIndex((item) => item.meta.id === themeId);
  if (themeIndex < 0) {
    throw new Error("删除失败：没有找到对应主题。");
  }

  const theme = themes[themeIndex];
  if (theme.meta.kind === "内置") {
    throw new Error("内置主题不能删除，请先复制成自定义主题再编辑。");
  }
  if (themes.length <= 1) {
    throw new Error("至少保留一个主题后才能删除当前主题。");
  }

  const fallbackTheme = themes[themeIndex + 1] || themes[themeIndex - 1] || themes[0];
  return {
    themeName: theme.meta.name,
    nextSelectedThemeId: fallbackTheme?.meta.id || "",
  };
}

export function buildImportedThemePayload(themes, parsedValue, fileName = "") {
  const importedThemePack = resolveImportedThemePack(parsedValue);
  const fallbackName = fileName.replace(/\.[^.]+$/, "").trim();
  const resolvedName = importedThemePack.name || fallbackName || "导入主题";
  const existingIds = new Set(themes.map((item) => item.meta.id));
  const nextId = buildUniqueThemeId(importedThemePack.id || resolvedName, existingIds);
  const nextThemePack = {
    ...cloneValue(importedThemePack),
    id: nextId,
    name: resolvedName,
    kind: importedThemePack.kind || "custom",
  };

  return {
    theme: {
      meta: themePackToThemeLibraryItem(nextThemePack, themes.length),
      draft: draftFromThemePack(nextThemePack),
    },
  };
}
