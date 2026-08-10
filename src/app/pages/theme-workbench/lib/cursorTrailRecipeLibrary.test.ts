import { describe, expect, it } from "vitest";
import {
  CURSOR_TRAIL_RECIPE_LIBRARY_KEY,
  listSavedCursorTrailRecipes,
  removeSavedCursorTrailRecipe,
  restoreSavedCursorTrailRecipe,
  saveCursorTrailRecipe,
} from "./cursorTrailRecipeLibrary";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}

describe("cursor trail recipe library", () => {
  it("saves named recipes and updates duplicate names in place", () => {
    const storage = createStorage();
    saveCursorTrailRecipe("花瓣", { material: "petal" }, storage, { id: "recipe-1", now: "2026-08-10T01:00:00.000Z" });
    const recipes = saveCursorTrailRecipe(" 花瓣 ", { material: "code" }, storage, { now: "2026-08-10T02:00:00.000Z" });

    expect(recipes).toHaveLength(1);
    expect(recipes[0]).toMatchObject({ id: "recipe-1", name: "花瓣", createdAt: "2026-08-10T01:00:00.000Z", updatedAt: "2026-08-10T02:00:00.000Z" });
    expect(recipes[0].trail.material).toBe("code");
  });

  it("removes and restores a saved recipe", () => {
    const storage = createStorage();
    saveCursorTrailRecipe("闪电", { material: "lightning" }, storage, { id: "recipe-2" });
    const { items, removed } = removeSavedCursorTrailRecipe("recipe-2", storage);
    expect(items).toEqual([]);
    expect(removed?.trail.material).toBe("lightning");
    expect(removed && restoreSavedCursorTrailRecipe(removed, storage)).toHaveLength(1);
  });

  it("ignores corrupt local data and requires a name", () => {
    const storage = createStorage();
    storage.setItem(CURSOR_TRAIL_RECIPE_LIBRARY_KEY, "not-json");
    expect(listSavedCursorTrailRecipes(storage)).toEqual([]);
    expect(() => saveCursorTrailRecipe("  ", {}, storage)).toThrow("请先填写配方名称。");
  });
});
