import { describe, expect, it } from "vitest";
import {
  buildCursorTrailRecipe,
  CURSOR_TRAIL_RECIPE_FORMAT,
  parseCursorTrailRecipe,
  serializeCursorTrailRecipe,
} from "./cursor-trail-recipe";

describe("cursor trail recipes", () => {
  it("round-trips an independent normalized trail config", () => {
    const text = serializeCursorTrailRecipe({
      enabled: true,
      material: "petal",
      randomSeed: 8128,
      settleResponse: 31,
      flickResponse: 62,
      stopResponse: 83,
      circleResponse: 44,
    });
    const config = parseCursorTrailRecipe(text);

    expect(config).toMatchObject({
      enabled: true,
      material: "petal",
      randomSeed: 8128,
      settleResponse: 31,
      flickResponse: 62,
      stopResponse: 83,
      circleResponse: 44,
    });
    expect(JSON.parse(text)).toMatchObject({ format: CURSOR_TRAIL_RECIPE_FORMAT, version: 1 });
  });

  it("keeps export metadata outside the trail config", () => {
    const recipe = buildCursorTrailRecipe({ material: "code" }, "2026-08-10T00:00:00.000Z");
    expect(recipe.exportedAt).toBe("2026-08-10T00:00:00.000Z");
    expect(recipe.trail.material).toBe("code");
    expect("exportedAt" in recipe.trail).toBe(false);
  });

  it("rejects arbitrary JSON instead of silently applying defaults", () => {
    expect(() => parseCursorTrailRecipe("{}"))
      .toThrow("文件不是受支持的 CursorDance 拖尾配方。");
    expect(() => parseCursorTrailRecipe("{"))
      .toThrow("拖尾配方不是合法的 JSON。");
  });
});
