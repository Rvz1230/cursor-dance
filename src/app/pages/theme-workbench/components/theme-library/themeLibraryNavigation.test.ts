import { describe, expect, it } from "vitest";
import {
  filterThemeLibrary,
  getThemeNavigationIndex,
  getThemeRovingId,
} from "./themeLibraryNavigation";

const themes = [
  { id: "mono", name: "几何", summary: "黑白方块", kind: "内置" },
  { id: "warm", name: "Warm Click", summary: "橙色粒子", kind: "自定义" },
];

describe("themeLibraryNavigation", () => {
  it("filters theme identity fields without changing an empty result set", () => {
    expect(filterThemeLibrary(themes, " warm ").map((theme) => theme.id)).toEqual(["warm"]);
    expect(filterThemeLibrary(themes, "粒子").map((theme) => theme.id)).toEqual(["warm"]);
    expect(filterThemeLibrary(themes, "内置").map((theme) => theme.id)).toEqual(["mono"]);
    expect(filterThemeLibrary(themes, "missing")).toEqual([]);
  });

  it("keeps one stable roving target in the filtered list", () => {
    expect(getThemeRovingId(themes, "mono", "warm")).toBe("warm");
    expect(getThemeRovingId(themes, "mono", "missing")).toBe("mono");
    expect(getThemeRovingId([themes[1]], "mono", "missing")).toBe("warm");
    expect(getThemeRovingId([], "mono", "warm")).toBe("");
  });

  it("moves within list boundaries and supports Home and End", () => {
    expect(getThemeNavigationIndex(0, "ArrowUp", 2)).toBe(0);
    expect(getThemeNavigationIndex(0, "ArrowDown", 2)).toBe(1);
    expect(getThemeNavigationIndex(1, "ArrowDown", 2)).toBe(1);
    expect(getThemeNavigationIndex(1, "Home", 2)).toBe(0);
    expect(getThemeNavigationIndex(0, "End", 2)).toBe(1);
    expect(getThemeNavigationIndex(0, "ArrowDown", 0)).toBe(-1);
  });
});
