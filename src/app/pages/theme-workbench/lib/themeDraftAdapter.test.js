import { beforeEach, describe, expect, it, vi } from "vitest";

import { createThemeDraft } from "../model/workbenchSchema.js";
import {
  buildPreviewThemePackFromWorkbench,
  buildStoredConfigFromWorkbench,
  hydrateWorkbenchState,
} from "./themeDraftAdapter.js";

function installWindowStub(overrides = {}) {
  globalThis.window = {
    CursorDanceDefaultConfig: {},
    CursorDanceConfigRuntime: {},
    ...overrides,
  };
}

function createThemeLibraryEntry(overrides = {}) {
  return {
    id: "woodfish",
    name: "木鱼方案",
    kind: "自定义",
    summary: "数字飘字",
    description: "测试主题",
    tone: "amber",
    ...overrides,
  };
}

describe("themeDraftAdapter", () => {
  beforeEach(() => {
    installWindowStub();
  });

  it("hydrates workbench state through runtime site mode and editor aliases", () => {
    installWindowStub({
      CursorDanceConfigRuntime: {
        getSiteMode: vi.fn(() => "enabled"),
      },
    });

    const savedDraft = createThemeDraft("woodfish");
    savedDraft.actionConfigs.leftClick.textContent = "已保存";

    const state = hydrateWorkbenchState(
      {
        enabled: true,
        activeThemePackId: "woodfish",
        themePacks: [
          {
            id: "woodfish",
            name: "木鱼方案",
            kind: "custom",
            workbenchDraft: {
              actionConfigs: savedDraft.actionConfigs,
            },
          },
        ],
        siteRules: {
          byHost: {
            "example.com": { mode: "enabled" },
          },
        },
        editor: {
          lastWorkspace: "workspace",
          lastActionId: "doubleClick",
          lastCursorState: "wait",
        },
      },
      { host: "example.com" }
    );

    expect(state.workspaceId).toBe("workbench");
    expect(state.siteMode).toBe("当前启用");
    expect(state.selection).toEqual({
      themeId: "woodfish",
      actionId: "doubleClick",
      cursorStateId: "wait",
    });
    expect(state.draftsByTheme.woodfish.actionConfigs.leftClick.textContent).toBe("已保存");
  });

  it("builds preview theme packs with ordered text tags and cursor overrides", () => {
    const draft = createThemeDraft("woodfish");
    draft.actionConfigs.leftClick.textKind = "文本飘字";
    draft.actionConfigs.leftClick.textMode = "默认模式 (+1)";
    draft.actionConfigs.leftClick.textContent = "主文案";
    draft.actionConfigs.leftClick.textTags = ["备选文案", "主文案", "第三条"];
    draft.cursorModes.wait = "覆盖";
    draft.cursorStateActions.wait = "doubleClick";
    draft.cursorStateAssets.wait = {
      imageDataUrl: "data:image/png;base64,abc",
      hotspotX: 8,
      hotspotY: 12,
      size: 64,
    };

    const previewPack = buildPreviewThemePackFromWorkbench(
      { themePacks: [] },
      {
        selection: { themeId: "woodfish" },
        draftsByTheme: { woodfish: draft },
        themeLibrary: [createThemeLibraryEntry()],
      }
    );

    expect(previewPack.behavior.click.effects.text.tags).toEqual(["主文案", "备选文案", "第三条"]);
    expect(previewPack.behavior.click.effects.text.content).toBe("主文案");
    expect(previewPack.cursorStates.wait).toEqual({
      mode: "override",
      actionId: "doubleClick",
      imageDataUrl: "data:image/png;base64,abc",
      hotspotX: 8,
      hotspotY: 12,
      size: 64,
    });
  });

  it("writes stored config through runtime site-rule and normalization adapters", () => {
    const setSiteRuleMode = vi.fn((config, host, mode) => ({
      ...config,
      siteRules: {
        ...(config.siteRules || {}),
        byHost: {
          ...(config.siteRules?.byHost || {}),
          [host]: { mode },
        },
      },
    }));
    const normalizeConfig = vi.fn((config) => ({
      ...config,
      normalized: true,
    }));

    installWindowStub({
      CursorDanceConfigRuntime: {
        setSiteRuleMode,
        normalizeConfig,
      },
    });

    const draft = createThemeDraft("woodfish");
    draft.cursorModes.wait = "覆盖";
    draft.cursorStateActions.wait = "doubleClick";

    const storedConfig = buildStoredConfigFromWorkbench(
      {
        enabled: true,
        themePacks: [],
        editor: {},
      },
      {
        workspaceId: "workbench",
        siteMode: "当前禁用",
        themeLibrary: [createThemeLibraryEntry()],
        draftsByTheme: { woodfish: draft },
        selection: {
          themeId: "woodfish",
          actionId: "doubleClick",
          cursorStateId: "wait",
        },
        siteRulesByHost: {},
        ui: { enabled: false },
        site: { host: "example.com" },
      }
    );

    expect(setSiteRuleMode).toHaveBeenCalledWith(expect.any(Object), "example.com", "disabled");
    expect(normalizeConfig).toHaveBeenCalledTimes(1);
    expect(storedConfig.normalized).toBe(true);
    expect(storedConfig.editor).toMatchObject({
      lastWorkspace: "workspace",
      lastActionId: "doubleClick",
      lastCursorState: "wait",
    });
    expect(storedConfig.activeThemePackId).toBe("woodfish");
    expect(storedConfig.schemes).toEqual(storedConfig.themePacks);
    expect(storedConfig.siteRules.byHost["example.com"]).toEqual({ mode: "disabled" });
    expect(storedConfig.themePacks[0].cursorStates.wait.mode).toBe("override");
  });
});
