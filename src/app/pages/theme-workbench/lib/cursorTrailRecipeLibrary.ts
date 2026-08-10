import { normalizeCursorTrailConfig, type CursorTrailConfig } from "@/shared/config/cursor-trail";

export const CURSOR_TRAIL_RECIPE_LIBRARY_KEY = "cursordance.cursorTrailRecipes";
const MAX_SAVED_RECIPES = 50;

type RecipeStorage = Pick<Storage, "getItem" | "setItem">;

export interface SavedCursorTrailRecipe {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly trail: CursorTrailConfig;
}

interface SaveRecipeOptions {
  id?: string;
  now?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function defaultStorage(): RecipeStorage {
  return window.localStorage;
}

function createRecipeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `trail-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function writeLibrary(items: readonly SavedCursorTrailRecipe[], storage: RecipeStorage): SavedCursorTrailRecipe[] {
  const next = items.slice(0, MAX_SAVED_RECIPES);
  storage.setItem(CURSOR_TRAIL_RECIPE_LIBRARY_KEY, JSON.stringify(next));
  return next;
}

export function listSavedCursorTrailRecipes(storage: RecipeStorage = defaultStorage()): SavedCursorTrailRecipe[] {
  try {
    const raw = storage.getItem(CURSOR_TRAIL_RECIPE_LIBRARY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!isRecord(item)
        || typeof item.id !== "string"
        || typeof item.name !== "string"
        || typeof item.createdAt !== "string"
        || typeof item.updatedAt !== "string"
        || !isRecord(item.trail)) return [];
      return [{
        id: item.id,
        name: item.name,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        trail: normalizeCursorTrailConfig(item.trail),
      }];
    }).slice(0, MAX_SAVED_RECIPES);
  } catch {
    return [];
  }
}

export function saveCursorTrailRecipe(
  name: string,
  value: unknown,
  storage: RecipeStorage = defaultStorage(),
  options: SaveRecipeOptions = {},
): SavedCursorTrailRecipe[] {
  const trimmedName = name.trim().slice(0, 60);
  if (!trimmedName) throw new Error("请先填写配方名称。");
  const current = listSavedCursorTrailRecipes(storage);
  const existing = current.find((item) => item.name.toLocaleLowerCase() === trimmedName.toLocaleLowerCase());
  const timestamp = options.now ?? new Date().toISOString();
  const saved: SavedCursorTrailRecipe = {
    id: existing?.id ?? options.id ?? createRecipeId(),
    name: trimmedName,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    trail: normalizeCursorTrailConfig(value),
  };
  return writeLibrary([saved, ...current.filter((item) => item.id !== saved.id)], storage);
}

export function removeSavedCursorTrailRecipe(
  id: string,
  storage: RecipeStorage = defaultStorage(),
): { items: SavedCursorTrailRecipe[]; removed: SavedCursorTrailRecipe | null } {
  const current = listSavedCursorTrailRecipes(storage);
  const removed = current.find((item) => item.id === id) ?? null;
  return { items: writeLibrary(current.filter((item) => item.id !== id), storage), removed };
}

export function restoreSavedCursorTrailRecipe(
  item: SavedCursorTrailRecipe,
  storage: RecipeStorage = defaultStorage(),
): SavedCursorTrailRecipe[] {
  const current = listSavedCursorTrailRecipes(storage);
  return writeLibrary([item, ...current.filter((entry) => entry.id !== item.id)], storage);
}
