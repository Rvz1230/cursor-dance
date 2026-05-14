import { describe, expect, it } from "vitest";

import {
  buildCreateThemePayload,
  buildDeleteThemePlan,
  buildDuplicateThemePayload,
} from "./themeWorkbenchThemeLifecycle.js";

function createThemeRecord(overrides = {}) {
  return {
    id: "woodfish",
    name: "木鱼方案",
    kind: "自定义",
    summary: "默认摘要",
    description: "默认说明",
    tone: "amber",
    ...overrides,
  };
}

describe("themeWorkbenchThemeLifecycle", () => {
  it("builds duplicated themes with unique id and name", () => {
    const { duplicatedName, payload } = buildDuplicateThemePayload(
      {
        themeLibrary: [createThemeRecord(), createThemeRecord({ id: "woodfish-copy", name: "木鱼方案 副本" })],
        draftsByTheme: {
          woodfish: {
            actionConfigs: { leftClick: { textContent: "功德 +1" } },
          },
        },
      },
      "woodfish"
    );

    expect(duplicatedName).toBe("木鱼方案 副本 2");
    expect(payload.theme.id).toBe("木鱼方案-副本-2");
    expect(payload.draft.actionConfigs.leftClick.textContent).toBe("功德 +1");
  });

  it("returns a delete fallback target and blocks builtin themes", () => {
    expect(
      buildDeleteThemePlan(
        [createThemeRecord(), createThemeRecord({ id: "petal", name: "花瓣流光" })],
        "woodfish"
      )
    ).toEqual({
      themeName: "木鱼方案",
      nextSelectedThemeId: "petal",
    });

    expect(() =>
      buildDeleteThemePlan(
        [createThemeRecord({ kind: "内置" }), createThemeRecord({ id: "petal", name: "花瓣流光" })],
        "woodfish"
      )
    ).toThrow("内置主题不能删除");
  });

  it("creates themes from blank or based-on payloads", () => {
    const payload = buildCreateThemePayload(
      {
        themeLibrary: [createThemeRecord()],
        draftsByTheme: {
          woodfish: {
            actionConfigs: { leftClick: { textContent: "功德 +1" } },
          },
        },
      },
      { name: "新主题", basedOnThemeId: "woodfish" }
    );

    expect(payload.theme.name).toBe("新主题");
    expect(payload.theme.summary).toContain("基于 木鱼方案 创建");
    expect(payload.draft.actionConfigs.leftClick.textContent).toBe("功德 +1");
  });
});
