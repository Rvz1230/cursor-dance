import { describe, expect, it } from "vitest";

import {
  buildCreateThemePayload,
  buildDeleteThemePlan,
  buildDuplicateThemePayload,
} from "./themeWorkbenchThemeLifecycle";

function createThemeRecord(overrides = {}) {
  return {
    id: "mono-geo",
    name: "几何",
    kind: "自定义",
    summary: "默认摘要",
    description: "默认说明",
    tone: "slate",
    ...overrides,
  };
}

describe("themeWorkbenchThemeLifecycle", () => {
  it("builds duplicated themes with unique id and name", () => {
    const { duplicatedName, payload } = buildDuplicateThemePayload(
      {
        themeLibrary: [createThemeRecord(), createThemeRecord({ id: "mono-geo-copy", name: "几何 副本" })],
        draftsByTheme: {
          "mono-geo": {
            actionConfigs: { leftClick: { textContent: "几何" } },
          },
        },
      },
      "mono-geo"
    );

    expect(duplicatedName).toBe("几何 副本 2");
    expect(payload.theme.id).toBe("几何-副本-2");
    expect(payload.draft.actionConfigs.leftClick.textContent).toBe("几何");
  });

  it("returns a delete fallback target and blocks builtin themes", () => {
    expect(
      buildDeleteThemePlan(
        [createThemeRecord(), createThemeRecord({ id: "drift", name: "流光" })],
        "mono-geo"
      )
    ).toEqual({
      themeName: "几何",
      nextSelectedThemeId: "drift",
    });

    expect(() =>
      buildDeleteThemePlan(
        [createThemeRecord({ kind: "内置" }), createThemeRecord({ id: "drift", name: "流光" })],
        "mono-geo"
      )
    ).toThrow("内置主题不能删除");
  });

  it("creates themes from blank or based-on payloads", () => {
    const payload = buildCreateThemePayload(
      {
        themeLibrary: [createThemeRecord()],
        draftsByTheme: {
          "mono-geo": {
            actionConfigs: { leftClick: { textContent: "几何" } },
          },
        },
      },
      { name: "新主题", basedOnThemeId: "mono-geo" }
    );

    expect(payload.theme.name).toBe("新主题");
    expect(payload.theme.summary).toContain("基于 几何 创建");
    expect(payload.draft.actionConfigs.leftClick.textContent).toBe("几何");
  });
});
