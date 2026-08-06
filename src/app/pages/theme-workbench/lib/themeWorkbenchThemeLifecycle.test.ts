import { describe, expect, it } from "vitest";

import {
  buildCreateThemePayload,
  buildDeleteThemePlan,
  buildDuplicateThemePayload,
  buildImportedThemePayload,
} from "./themeWorkbenchThemeLifecycle";
import { defaultConfig } from "@/shared/config/default-config";

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

function createWorkbenchTheme(metaOverrides = {}, draft = {}) {
  return { meta: createThemeRecord(metaOverrides), draft };
}

describe("themeWorkbenchThemeLifecycle", () => {
  it("builds duplicated themes with unique id, name, and key feedback config", () => {
    const { duplicatedName, payload } = buildDuplicateThemePayload(
      [
        createWorkbenchTheme({}, {
            actionConfigs: { leftClick: { textContent: "几何" } },
            resetActionConfigs: { leftClick: { textContent: "几何默认" } },
            keyFeedbackConfig: { color: "#00FFAA", fontSize: 72 },
            resetKeyFeedbackConfig: { color: "#22CCDD", fontSize: 66 },
        }),
        createWorkbenchTheme({ id: "mono-geo-copy", name: "几何 副本" }),
      ],
      "mono-geo"
    );

    expect(duplicatedName).toBe("几何 副本 2");
    expect(payload.theme.meta.id).toBe("几何-副本-2");
    expect(payload.theme.draft.actionConfigs.leftClick.textContent).toBe("几何");
    expect(payload.theme.draft.resetActionConfigs.leftClick.textContent).toBe("几何");
    expect(payload.theme.draft.keyFeedbackConfig).toMatchObject({ color: "#00FFAA", fontSize: 72 });
    expect(payload.theme.draft.resetKeyFeedbackConfig).toMatchObject({ color: "#22CCDD", fontSize: 66 });
  });

  it("returns a delete fallback target and blocks builtin themes", () => {
    expect(
      buildDeleteThemePlan(
        [createWorkbenchTheme(), createWorkbenchTheme({ id: "drift", name: "流光" })],
        "mono-geo"
      )
    ).toEqual({
      themeName: "几何",
      nextSelectedThemeId: "drift",
    });

    expect(() =>
      buildDeleteThemePlan(
        [createWorkbenchTheme({ kind: "内置" }), createWorkbenchTheme({ id: "drift", name: "流光" })],
        "mono-geo"
      )
    ).toThrow("内置主题不能删除");
  });

  it("creates themes from blank or based-on payloads with key feedback config", () => {
    const payload = buildCreateThemePayload(
      [
        createWorkbenchTheme({}, {
            actionConfigs: { leftClick: { textContent: "几何" } },
            keyFeedbackConfig: { color: "#22CCDD", fontSize: 68 },
        }),
      ],
      { name: "新主题", basedOnThemeId: "mono-geo" }
    );

    expect(payload.theme.meta.name).toBe("新主题");
    expect(payload.theme.meta.summary).toContain("基于 几何 创建");
    expect(payload.theme.draft.actionConfigs.leftClick.textContent).toBe("几何");
    expect(payload.theme.draft.resetActionConfigs.leftClick.textContent).toBe("几何");
    expect(payload.theme.draft.keyFeedbackConfig).toMatchObject({ color: "#22CCDD", fontSize: 68 });

    const blankPayload = buildCreateThemePayload(
      [createWorkbenchTheme()],
      { name: "空白主题" }
    );
    expect(blankPayload.theme.draft.keyFeedbackConfig.enabled).toBe(true);
    expect(blankPayload.theme.draft.keyFeedbackConfig.animationStyle).toBe("bounce");
  });

  it("imports theme workbench key feedback config into the draft", () => {
    const payload = buildImportedThemePayload(
      [createWorkbenchTheme()],
      {
        format: "cursordance-theme",
        schemaVersion: 4,
        theme: {
          ...defaultConfig.themes[0],
          id: "imported-theme",
          name: "导入主题",
          kind: "custom",
          actionConfigs: {
            ...defaultConfig.themes[0].actionConfigs,
            leftClick: { ...defaultConfig.themes[0].actionConfigs.leftClick, textContent: "导入" },
          },
          keyFeedbackConfig: {
            ...defaultConfig.themes[0].keyFeedbackConfig,
            color: "#FF00AA",
            fontSize: 66,
          },
        },
      },
      "imported-theme.json"
    );

    expect(payload.theme.meta.name).toBe("导入主题");
    expect(payload.theme.draft.actionConfigs.leftClick.textContent).toBe("导入");
    expect(payload.theme.draft.keyFeedbackConfig.color).toBe("#FF00AA");
    expect(payload.theme.draft.keyFeedbackConfig.fontSize).toBe(66);
    expect(payload.theme.draft.keyFeedbackConfig.animationStyle).toBe("bounce");
    expect(payload.theme.draft.resetKeyFeedbackConfig.color).toBe("#FF00AA");
  });
});
