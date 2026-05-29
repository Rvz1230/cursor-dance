import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { createThemeDraft } from "../model/workbenchSchema.js";
import {
  buildPreviewThemePackFromWorkbench,
  buildStoredConfigFromWorkbench,
  buildStoredThemePackFromWorkbench,
  hydrateWorkbenchState,
} from "./themeDraftAdapter.js";
import { buildThemeExportPayload } from "./extensionStorage.js";

const textSemanticsSource = readFileSync(new URL("../../../../../public/config-runtime/text-semantics.js", import.meta.url), "utf8");
const actionConfigSource = readFileSync(new URL("../../../../../public/config-runtime/action-config.js", import.meta.url), "utf8");
const publicConfigSource = readFileSync(new URL("../../../../../public/config.js", import.meta.url), "utf8");

function installWindowStub(overrides = {}) {
  globalThis.window = {
    CursorDanceDefaultConfig: {},
    CursorDanceConfigRuntime: {},
    CursorDanceConfigHelpers: {},
    ...overrides,
  };
}

function installPublicConfigRuntime() {
  installWindowStub();
  new Function(textSemanticsSource)();
  new Function(actionConfigSource)();
  new Function(publicConfigSource)();
  return {
    defaultConfig: window.CursorDanceDefaultConfig,
    runtime: window.CursorDanceConfigRuntime,
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

  it("hydrates workbench state with siteRules array", () => {
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
        siteRules: [
          { id: "r1", pattern: { type: "exact", value: "example.com" }, action: "disable" },
        ],
        editor: {
          lastWorkspace: "workspace",
          lastActionId: "doubleClick",
          lastCursorState: "wait",
        },
      },
      { host: "example.com" }
    );

    expect(state.workspaceId).toBe("workbench");
    expect(state.siteRules).toEqual([
      { id: "r1", pattern: { type: "exact", value: "example.com" }, action: "disable" },
    ]);
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

    expect(previewPack.workbenchDraft.actionConfigs.leftClick.textTags).toEqual(["备选文案", "主文案", "第三条"]);
    expect(previewPack.workbenchDraft.actionConfigs.leftClick.textContent).toBe("主文案");
    expect(previewPack.cursorStates.wait).toEqual({
      mode: "override",
      actionId: "doubleClick",
      imageDataUrl: "data:image/png;base64,abc",
      hotspotX: 8,
      hotspotY: 12,
      size: 64,
    });
  });

  it("writes stored config with siteRules array", () => {
    const normalizeConfig = vi.fn((config) => ({
      ...config,
      normalized: true,
    }));

    installWindowStub({
      CursorDanceConfigRuntime: {
        normalizeConfig,
      },
    });

    const draft = createThemeDraft("woodfish");
    draft.cursorModes.wait = "覆盖";
    draft.cursorStateActions.wait = "doubleClick";

    const siteRules = [
      { id: "r1", pattern: { type: "exact", value: "example.com" }, action: "disable" },
    ];

    const storedConfig = buildStoredConfigFromWorkbench(
      {
        enabled: true,
        themePacks: [],
        editor: {},
      },
      {
        workspaceId: "workbench",
        siteRules,
        themeLibrary: [createThemeLibraryEntry()],
        draftsByTheme: { woodfish: draft },
        selection: {
          themeId: "woodfish",
          actionId: "doubleClick",
          cursorStateId: "wait",
        },
        ui: { enabled: false },
        site: { host: "example.com" },
      }
    );

    expect(normalizeConfig).toHaveBeenCalledTimes(1);
    expect(storedConfig.normalized).toBe(true);
    expect(storedConfig.editor).toMatchObject({
      lastWorkspace: "workspace",
      lastActionId: "doubleClick",
      lastCursorState: "wait",
    });
    expect(storedConfig.activeThemePackId).toBe("woodfish");
    expect(storedConfig.schemes).toEqual(storedConfig.themePacks);
    expect(storedConfig.siteRules).toEqual(siteRules);
    expect(storedConfig.themePacks[0].cursorStates.wait.mode).toBe("override");
  });

  it("preserves woodfish number semantics across themePack to draft to stored themePack", () => {
    const { defaultConfig, runtime } = installPublicConfigRuntime();
    const state = hydrateWorkbenchState(defaultConfig, { host: "example.com" });
    const draft = state.draftsByTheme.woodfish.actionConfigs.leftClick;

    expect(draft.textKind).toBe("数字飘字");
    expect(draft.textMode).toBe("默认模式 (+1)");
    expect(draft.comboEnabled).toBe(true);
    expect(draft.textTags).toEqual(["功德 +1", "继续点击", "已触发"]);

    const storedConfig = buildStoredConfigFromWorkbench(defaultConfig, state);
    const storedThemePack = storedConfig.themePacks.find((item) => item.id === "woodfish");

    expect(storedThemePack.workbenchDraft.actionConfigs.leftClick).toMatchObject({
      textKind: "数字飘字",
      textMode: "默认模式 (+1)",
      comboEnabled: true,
    });
    expect(storedThemePack.workbenchDraft.actionConfigs.leftClick.textTags).toEqual(["功德 +1", "继续点击", "已触发"]);
    expect(runtime.getActionTextConfig(draft).textKind).toBe("数字飘字");
  });

  it("round-trips custom text tags with stable primary-text ordering", () => {
    const { defaultConfig, runtime } = installPublicConfigRuntime();
    const customConfig = runtime.normalizeConfig({
      ...defaultConfig,
      activeThemePackId: "woodfish",
      themePacks: [
        {
          id: "woodfish",
          workbenchDraft: {
            actionConfigs: {
              leftClick: {
                textKind: "文本飘字",
                textEnabled: true,
                textContent: "第一条",
                textTags: ["第二条", "第一条", "第三条"],
                textTagPlayMode: "按顺序显示",
                comboEnabled: false,
              },
            },
          },
        },
      ],
    }, defaultConfig);

    const state = hydrateWorkbenchState(customConfig, { host: "example.com" });
    const draft = state.draftsByTheme.woodfish.actionConfigs.leftClick;

    expect(draft.textKind).toBe("文本飘字");
    expect(draft.textContent).toBe("第一条");
    expect(draft.textTags).toEqual(["第二条", "第一条", "第三条"]);

    const storedConfig = buildStoredConfigFromWorkbench(customConfig, state);
    const storedThemePack = storedConfig.themePacks.find((item) => item.id === "woodfish");

    expect(storedThemePack.workbenchDraft.actionConfigs.leftClick.textContent).toBe("第一条");
    expect(storedThemePack.workbenchDraft.actionConfigs.leftClick.textTags).toEqual(["第二条", "第一条", "第三条"]);
  });

  it("builds preview overlays without mutating persisted config semantics", () => {
    const { defaultConfig } = installPublicConfigRuntime();
    const state = hydrateWorkbenchState(defaultConfig, { host: "example.com" });
    const originalContent = defaultConfig.themePacks.find((item) => item.id === "woodfish")
      .workbenchDraft.actionConfigs.leftClick.textContent;

    state.draftsByTheme.woodfish.actionConfigs.leftClick.textKind = "文本飘字";
    state.draftsByTheme.woodfish.actionConfigs.leftClick.textContent = "预览文案";
    state.draftsByTheme.woodfish.actionConfigs.leftClick.textTags = ["预览文案", "备用文案"];

    const previewThemePack = buildPreviewThemePackFromWorkbench(defaultConfig, state);

    expect(previewThemePack.workbenchDraft.actionConfigs.leftClick.textContent).toBe("预览文案");
    expect(previewThemePack.workbenchDraft.actionConfigs.leftClick.textTags).toEqual(["预览文案", "备用文案"]);
    expect(defaultConfig.themePacks.find((item) => item.id === "woodfish")
      .workbenchDraft.actionConfigs.leftClick.textContent).toBe(originalContent);
  });

  it("stores all action config fields in workbench draft", () => {
    const { defaultConfig } = installPublicConfigRuntime();
    const state = hydrateWorkbenchState(defaultConfig, { host: "example.com" });

    state.draftsByTheme.woodfish.actionConfigs.leftClick.textEasing = "弹性";
    state.draftsByTheme.woodfish.actionConfigs.leftClick.sound = true;
    state.draftsByTheme.woodfish.actionConfigs.leftClick.cursorOverride = "木鱼（增强态）";

    const storedConfig = buildStoredConfigFromWorkbench(defaultConfig, state);
    const storedLeftClickDraft = storedConfig.themePacks.find((item) => item.id === "woodfish").workbenchDraft.actionConfigs.leftClick;

    expect(storedLeftClickDraft).toMatchObject({
      textEasing: "弹性",
      sound: true,
      cursorOverride: "木鱼（增强态）",
      triggerTiming: "抬起时",
      triggerZone: "当前页面可点击区域",
    });
    expect(storedLeftClickDraft).toHaveProperty("textKind", "数字飘字");
    expect(storedLeftClickDraft).toHaveProperty("textEnabled", true);
    expect(storedLeftClickDraft).toHaveProperty("ripple", true);
    expect(storedLeftClickDraft).toHaveProperty("particle", true);
    expect(storedLeftClickDraft).toHaveProperty("holdMs", 0);
  });

  it("rehydrates left-click config from workbench draft", () => {
    const { defaultConfig } = installPublicConfigRuntime();
    const state = hydrateWorkbenchState(defaultConfig, { host: "example.com" });
    state.draftsByTheme.woodfish.actionConfigs.leftClick.textEasing = "弹性";

    const storedConfig = buildStoredConfigFromWorkbench(defaultConfig, state);
    const rehydratedState = hydrateWorkbenchState(storedConfig, { host: "example.com" });
    const leftClickConfig = rehydratedState.draftsByTheme.woodfish.actionConfigs.leftClick;

    expect(leftClickConfig.textKind).toBe("数字飘字");
    expect(leftClickConfig.textEnabled).toBe(true);
    expect(leftClickConfig.ripple).toBe(true);
    expect(leftClickConfig.particle).toBe(true);
    expect(leftClickConfig.holdMs).toBe(0);
    expect(leftClickConfig.textEasing).toBe("弹性");
    expect(leftClickConfig.sound).toBe(true);
    expect(leftClickConfig.triggerTiming).toBe("抬起时");
  });

  it("builds export payloads around the current stored theme pack shape", () => {
    const { defaultConfig } = installPublicConfigRuntime();
    const state = hydrateWorkbenchState(defaultConfig, { host: "example.com" });
    state.draftsByTheme.woodfish.actionConfigs.leftClick.textKind = "文本飘字";
    state.draftsByTheme.woodfish.actionConfigs.leftClick.textContent = "导出测试";

    const themePack = buildStoredThemePackFromWorkbench(defaultConfig, state, "woodfish");
    const payload = buildThemeExportPayload(themePack);

    expect(payload.format).toBe("cursordance-theme-pack");
    expect(payload.version).toBe(1);
    expect(payload.themePack.id).toBe("woodfish");
    expect(payload.themePack.workbenchDraft.actionConfigs.leftClick.textContent).toBe("导出测试");
    expect(payload.themePack.workbenchDraft.actionConfigs.leftClick).toHaveProperty("textKind", "文本飘字");
  });

  it("stores and rehydrates image effect fields through workbench drafts", () => {
    const { defaultConfig } = installPublicConfigRuntime();
    const state = hydrateWorkbenchState(defaultConfig, { host: "example.com" });
    state.draftsByTheme.woodfish.actionConfigs.leftClick.imageEnabled = true;
    state.draftsByTheme.woodfish.actionConfigs.leftClick.imageDataUrl = "data:image/svg+xml;utf8,%3Csvg/%3E";
    state.draftsByTheme.woodfish.actionConfigs.leftClick.imageSize = 72;
    state.draftsByTheme.woodfish.actionConfigs.leftClick.imageDuration = 960;

    const storedConfig = buildStoredConfigFromWorkbench(defaultConfig, state);
    const storedDraft = storedConfig.themePacks.find((item) => item.id === "woodfish").workbenchDraft.actionConfigs.leftClick;

    expect(storedDraft).toMatchObject({
      imageEnabled: true,
      imageDataUrl: "data:image/svg+xml;utf8,%3Csvg/%3E",
      imageSize: 72,
      imageDuration: 960,
    });

    const rehydratedState = hydrateWorkbenchState(storedConfig, { host: "example.com" });
    expect(rehydratedState.draftsByTheme.woodfish.actionConfigs.leftClick).toMatchObject({
      imageEnabled: true,
      imageDataUrl: "data:image/svg+xml;utf8,%3Csvg/%3E",
      imageSize: 72,
      imageDuration: 960,
    });
  });

  it("round-trips site rules through hydrate → modify → buildStoredConfig → rehydrate", () => {
    const { defaultConfig } = installPublicConfigRuntime();

    // Start with no site rules
    const state1 = hydrateWorkbenchState(defaultConfig, { host: "example.com" });
    expect(state1.siteRules).toEqual([]);

    // Add a disable rule for example.com
    const state2 = {
      ...state1,
      siteRules: [
        { id: "r1", pattern: { type: "exact", value: "example.com" }, action: "disable" },
      ],
    };
    const config2 = buildStoredConfigFromWorkbench(defaultConfig, state2);
    expect(config2.siteRules).toEqual([
      { id: "r1", pattern: { type: "exact", value: "example.com" }, action: "disable", enabled: true },
    ]);

    // Rehydrate and verify
    const state3 = hydrateWorkbenchState(config2, { host: "example.com" });
    expect(state3.siteRules).toEqual([
      { id: "r1", pattern: { type: "exact", value: "example.com" }, action: "disable", enabled: true },
    ]);

    // Add another rule with a theme binding
    const state4 = {
      ...state3,
      siteRules: [
        { id: "r1", pattern: { type: "exact", value: "example.com" }, action: "disable" },
        { id: "r2", pattern: { type: "glob", value: "*.google.com" }, action: { enable: true, theme: "petal" } },
      ],
    };
    const config4 = buildStoredConfigFromWorkbench(config2, state4);
    expect(config4.siteRules).toHaveLength(2);
    expect(config4.siteRules[1]).toEqual({ id: "r2", pattern: { type: "glob", value: "*.google.com" }, action: { enable: true, theme: "petal" }, enabled: true });

    // Remove rules — back to empty
    const state5 = {
      ...state4,
      siteRules: [],
    };
    const config5 = buildStoredConfigFromWorkbench(config4, state5);
    expect(config5.siteRules).toEqual([]);

    // Rehydrate after removal
    const state6 = hydrateWorkbenchState(config5, { host: "example.com" });
    expect(state6.siteRules).toEqual([]);
  });

  it("stores and rehydrates animation effect fields through workbench drafts", () => {
    const { defaultConfig } = installPublicConfigRuntime();
    const state = hydrateWorkbenchState(defaultConfig, { host: "example.com" });
    state.draftsByTheme.woodfish.actionConfigs.leftClick.animationEnabled = true;
    state.draftsByTheme.woodfish.actionConfigs.leftClick.animationStyle = "弹跳徽记";
    state.draftsByTheme.woodfish.actionConfigs.leftClick.animationDuration = 880;
    state.draftsByTheme.woodfish.actionConfigs.leftClick.animationScale = 136;

    const storedConfig = buildStoredConfigFromWorkbench(defaultConfig, state);
    const storedDraft = storedConfig.themePacks.find((item) => item.id === "woodfish").workbenchDraft.actionConfigs.leftClick;

    expect(storedDraft).toMatchObject({
      animationEnabled: true,
      animationStyle: "弹跳徽记",
      animationDuration: 880,
      animationScale: 136,
    });

    const rehydratedState = hydrateWorkbenchState(storedConfig, { host: "example.com" });
    expect(rehydratedState.draftsByTheme.woodfish.actionConfigs.leftClick).toMatchObject({
      animationEnabled: true,
      animationStyle: "弹跳徽记",
      animationDuration: 880,
      animationScale: 136,
    });
  });
});
