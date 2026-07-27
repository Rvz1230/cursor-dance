import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { createThemeDraft } from "../model/workbenchSchema";
import {
  buildPreviewThemePackFromWorkbench,
  buildStoredConfigFromWorkbench,
  buildStoredThemePackFromWorkbench,
  hydrateWorkbenchState,
} from "./themeDraftAdapter";
import { buildThemeExportPayload } from "./extensionStorage";

const textSemanticsSource = readFileSync(new URL("../../../../../extension/config-runtime/text-semantics.js", import.meta.url), "utf8");
const actionConfigSource = readFileSync(new URL("../../../../../extension/config-runtime/action-config.js", import.meta.url), "utf8");
const publicConfigSource = readFileSync(new URL("../../../../../extension/config.js", import.meta.url), "utf8");

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
    id: "mono-geo",
    name: "几何",
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
    const savedDraft = createThemeDraft("mono-geo");
    savedDraft.actionConfigs.leftClick.textContent = "已保存";

    const state = hydrateWorkbenchState(
      {
        enabled: true,
        activeThemePackId: "mono-geo",
        themePacks: [
          {
            id: "mono-geo",
            name: "几何",
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
      themeId: "mono-geo",
      actionId: "doubleClick",
      cursorStateId: "busy",
    });
    expect(state.draftsByTheme["mono-geo"].actionConfigs.leftClick.textContent).toBe("已保存");
    expect(state.draftsByTheme["mono-geo"].resetActionConfigs.leftClick.textContent).toBe("+1");
  });

  it("hydrates key feedback config from theme workbench draft", () => {
    const state = hydrateWorkbenchState(
      {
        enabled: true,
        activeThemePackId: "mono-geo",
        themePacks: [
          {
            id: "mono-geo",
            name: "几何",
            kind: "custom",
            workbenchDraft: {
              keyFeedbackConfig: {
                color: "#00FFAA",
                fontSize: 72,
              },
            },
          },
        ],
        siteRules: [],
        editor: {},
      },
      { host: "example.com" }
    );

    expect(state.draftsByTheme["mono-geo"].keyFeedbackConfig.color).toBe("#00FFAA");
    expect(state.draftsByTheme["mono-geo"].keyFeedbackConfig.fontSize).toBe(72);
    expect(state.draftsByTheme["mono-geo"].keyFeedbackConfig.animationStyle).toBe("bounce");
  });

  it("migrates legacy root key feedback config into every theme without a theme draft config", () => {
    const state = hydrateWorkbenchState(
      {
        enabled: true,
        activeThemePackId: "mono-geo",
        keyFeedbackConfig: {
          color: "#FF00AA",
          fontSize: 64,
        },
        themePacks: [
          {
            id: "mono-geo",
            name: "几何",
            kind: "custom",
            workbenchDraft: {},
          },
          {
            id: "drift",
            name: "流光",
            kind: "custom",
            workbenchDraft: {},
          },
        ],
        siteRules: [],
        editor: {},
      },
      { host: "example.com" }
    );

    expect(state.draftsByTheme["mono-geo"].keyFeedbackConfig.color).toBe("#FF00AA");
    expect(state.draftsByTheme["drift"].keyFeedbackConfig.color).toBe("#FF00AA");
    expect(state.draftsByTheme["drift"].resetKeyFeedbackConfig.fontSize).toBe(64);
  });

  it("uses imported custom theme action configs as the reset baseline when no explicit baseline exists", () => {
    const state = hydrateWorkbenchState(
      {
        enabled: true,
        activeThemePackId: "custom-import",
        themePacks: [
          {
            id: "custom-import",
            name: "导入主题",
            kind: "custom",
            workbenchDraft: {
              actionConfigs: {
                leftClick: {
                  textContent: "导入默认",
                  particleCount: 33,
                },
              },
            },
          },
        ],
        siteRules: [],
        editor: {},
      },
      { host: "example.com" }
    );

    expect(state.draftsByTheme["custom-import"].actionConfigs.leftClick.textContent).toBe("导入默认");
    expect(state.draftsByTheme["custom-import"].resetActionConfigs.leftClick.textContent).toBe("导入默认");
    expect(state.draftsByTheme["custom-import"].resetActionConfigs.leftClick.particleCount).toBe(33);
  });

  it("builds preview theme packs with ordered text tags and cursor overrides", () => {
    const draft = createThemeDraft("mono-geo");
    draft.actionConfigs.leftClick.textKind = "文本飘字";
    draft.actionConfigs.leftClick.textMode = "默认模式 (+1)";
    draft.actionConfigs.leftClick.textContent = "主文案";
    draft.actionConfigs.leftClick.textTags = ["备选文案", "主文案", "第三条"];
    draft.cursorModes.wait = "覆盖";
    draft.cursorStateActions.wait = "doubleClick";
    draft.cursorSkin.states.busy = {
      image: {
        kind: "dataUrl",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,skin",
        width: 96,
        height: 96,
      },
      hotspot: { x: 10, y: 14 },
      size: { mode: "fixedBox", boxSize: 72 },
    };

    const previewPack = buildPreviewThemePackFromWorkbench(
      { themePacks: [] },
      {
        selection: { themeId: "mono-geo" },
        draftsByTheme: { "mono-geo": draft },
        themeLibrary: [createThemeLibraryEntry()],
      }
    );

    expect(previewPack.workbenchDraft.actionConfigs.leftClick.textTags).toEqual(["备选文案", "主文案", "第三条"]);
    expect(previewPack.workbenchDraft.actionConfigs.leftClick.textContent).toBe("主文案");
    expect(previewPack.cursorSkin.states.busy.image.dataUrl).toBe("data:image/png;base64,skin");
    expect(previewPack.workbenchDraft.cursorSkin.states.busy.image.dataUrl).toBe("data:image/png;base64,skin");
    expect(previewPack.cursorStates.wait).toEqual({
      mode: "override",
      actionId: "doubleClick",
      imageDataUrl: "data:image/png;base64,skin",
      hotspotX: 10,
      hotspotY: 14,
      size: 72,
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

    const draft = createThemeDraft("mono-geo");
    draft.cursorModes.wait = "覆盖";
    draft.cursorStateActions.wait = "doubleClick";
    draft.cursorSkin.states.default = {
      image: {
        kind: "dataUrl",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,default-skin",
        width: 64,
        height: 64,
      },
      hotspot: { x: 8, y: 9 },
      size: { mode: "fixedBox", boxSize: 56 },
    };

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
        draftsByTheme: { "mono-geo": draft },
        selection: {
          themeId: "mono-geo",
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
    expect(storedConfig.activeThemePackId).toBe("mono-geo");
    expect(storedConfig.schemes).toEqual(storedConfig.themePacks);
    expect(storedConfig.siteRules).toEqual(siteRules);
    expect(storedConfig.themePacks[0].cursorSkin.states.default.image.dataUrl).toBe("data:image/png;base64,default-skin");
    expect(storedConfig.themePacks[0].workbenchDraft.cursorSkin.states.default.image.dataUrl).toBe("data:image/png;base64,default-skin");
    expect(storedConfig.themePacks[0].cursorStates.default).toMatchObject({
      imageDataUrl: "data:image/png;base64,default-skin",
      hotspotX: 8,
      hotspotY: 9,
      size: 56,
    });
    expect(storedConfig.themePacks[0].cursorStates.wait.mode).toBe("override");
  });

  it("preserves mono-geo number semantics across themePack to draft to stored themePack", () => {
    const { defaultConfig, runtime } = installPublicConfigRuntime();
    const state = hydrateWorkbenchState(defaultConfig, { host: "example.com" });
    const draft = state.draftsByTheme["mono-geo"].actionConfigs.leftClick;

    expect(draft.textKind).toBe("数字飘字");
    expect(draft.textMode).toBe("默认模式 (+1)");
    expect(draft.comboEnabled).toBe(true);
    expect(draft.textTags).toEqual(["+1", "+2", "+3"]);

    const storedConfig = buildStoredConfigFromWorkbench(defaultConfig, state);
    const storedThemePack = storedConfig.themePacks.find((item) => item.id === "mono-geo");

    expect(storedThemePack.workbenchDraft.actionConfigs.leftClick).toMatchObject({
      textKind: "数字飘字",
      textMode: "默认模式 (+1)",
      comboEnabled: true,
    });
    expect(storedThemePack.workbenchDraft.actionConfigs.leftClick.textTags).toEqual(["+1", "+2", "+3"]);
    expect(runtime.getActionTextConfig(draft).textKind).toBe("数字飘字");
  });

  it("round-trips custom text tags with stable primary-text ordering", () => {
    const { defaultConfig, runtime } = installPublicConfigRuntime();
    const customConfig = runtime.normalizeConfig({
      ...defaultConfig,
      activeThemePackId: "mono-geo",
      themePacks: [
        {
          id: "mono-geo",
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
    const draft = state.draftsByTheme["mono-geo"].actionConfigs.leftClick;

    expect(draft.textKind).toBe("文本飘字");
    expect(draft.textContent).toBe("第一条");
    expect(draft.textTags).toEqual(["第二条", "第一条", "第三条"]);

    const storedConfig = buildStoredConfigFromWorkbench(customConfig, state);
    const storedThemePack = storedConfig.themePacks.find((item) => item.id === "mono-geo");

    expect(storedThemePack.workbenchDraft.actionConfigs.leftClick.textContent).toBe("第一条");
    expect(storedThemePack.workbenchDraft.actionConfigs.leftClick.textTags).toEqual(["第二条", "第一条", "第三条"]);
  });

  it("builds preview overlays without mutating persisted config semantics", () => {
    const { defaultConfig } = installPublicConfigRuntime();
    const state = hydrateWorkbenchState(defaultConfig, { host: "example.com" });
    const originalContent = defaultConfig.themePacks.find((item) => item.id === "mono-geo")
      .workbenchDraft.actionConfigs.leftClick.textContent;

    state.draftsByTheme["mono-geo"].actionConfigs.leftClick.textKind = "文本飘字";
    state.draftsByTheme["mono-geo"].actionConfigs.leftClick.textContent = "预览文案";
    state.draftsByTheme["mono-geo"].actionConfigs.leftClick.textTags = ["预览文案", "备用文案"];

    const previewThemePack = buildPreviewThemePackFromWorkbench(defaultConfig, state);

    expect(previewThemePack.workbenchDraft.actionConfigs.leftClick.textContent).toBe("预览文案");
    expect(previewThemePack.workbenchDraft.actionConfigs.leftClick.textTags).toEqual(["预览文案", "备用文案"]);
    expect(defaultConfig.themePacks.find((item) => item.id === "mono-geo")
      .workbenchDraft.actionConfigs.leftClick.textContent).toBe(originalContent);
  });

  it("stores all action config fields in workbench draft", () => {
    const { defaultConfig } = installPublicConfigRuntime();
    const state = hydrateWorkbenchState(defaultConfig, { host: "example.com" });

    state.draftsByTheme["mono-geo"].actionConfigs.leftClick.textEasing = "弹性";
    state.draftsByTheme["mono-geo"].actionConfigs.leftClick.sound = true;
    state.draftsByTheme["mono-geo"].actionConfigs.leftClick.cursorOverride = "跟随当前状态";

    const storedConfig = buildStoredConfigFromWorkbench(defaultConfig, state);
    const storedLeftClickDraft = storedConfig.themePacks.find((item) => item.id === "mono-geo").workbenchDraft.actionConfigs.leftClick;

    expect(storedLeftClickDraft).toMatchObject({
      textEasing: "弹性",
      sound: true,
      cursorOverride: "跟随当前状态",
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
    state.draftsByTheme["mono-geo"].actionConfigs.leftClick.textEasing = "弹性";

    const storedConfig = buildStoredConfigFromWorkbench(defaultConfig, state);
    const rehydratedState = hydrateWorkbenchState(storedConfig, { host: "example.com" });
    const leftClickConfig = rehydratedState.draftsByTheme["mono-geo"].actionConfigs.leftClick;

    expect(leftClickConfig.textKind).toBe("数字飘字");
    expect(leftClickConfig.textEnabled).toBe(true);
    expect(leftClickConfig.ripple).toBe(true);
    expect(leftClickConfig.particle).toBe(true);
    expect(leftClickConfig.holdMs).toBe(0);
    expect(leftClickConfig.textEasing).toBe("弹性");
    expect(leftClickConfig.sound).toBe(false);
    expect(leftClickConfig.triggerTiming).toBe("抬起时");
  });

  it("builds export payloads around the current stored theme pack shape", () => {
    const { defaultConfig } = installPublicConfigRuntime();
    const state = hydrateWorkbenchState(defaultConfig, { host: "example.com" });
    state.draftsByTheme["mono-geo"].actionConfigs.leftClick.textKind = "文本飘字";
    state.draftsByTheme["mono-geo"].actionConfigs.leftClick.textContent = "导出测试";

    const themePack = buildStoredThemePackFromWorkbench(defaultConfig, state, "mono-geo");
    const payload = buildThemeExportPayload(themePack);

    expect(payload.format).toBe("cursordance-theme-pack");
    expect(payload.version).toBe(1);
    expect(payload.themePack.id).toBe("mono-geo");
    expect(payload.themePack.workbenchDraft.actionConfigs.leftClick.textContent).toBe("导出测试");
    expect(payload.themePack.workbenchDraft.actionConfigs.leftClick).toHaveProperty("textKind", "文本飘字");
  });

  it("exports custom theme packs instead of the first normalized fallback theme", () => {
    const { defaultConfig } = installPublicConfigRuntime();
    const state = hydrateWorkbenchState(defaultConfig, { host: "example.com" });
    const customDraft = createThemeDraft("custom-keyboard");
    customDraft.keyFeedbackConfig.color = "#00FFAA";
    const customState = {
      ...state,
      themeLibrary: [
        ...state.themeLibrary,
        {
          id: "custom-keyboard",
          name: "自定义键盘",
          kind: "自定义",
          summary: "自定义",
          description: "",
          tone: "amber",
        },
      ],
      draftsByTheme: {
        ...state.draftsByTheme,
        "custom-keyboard": customDraft,
      },
    };

    const themePack = buildStoredThemePackFromWorkbench(defaultConfig, customState, "custom-keyboard");
    const payload = buildThemeExportPayload(themePack);

    expect(payload.themePack.id).toBe("custom-keyboard");
    expect(payload.themePack.workbenchDraft.keyFeedbackConfig.color).toBe("#00FFAA");
  });

  it("stores and rehydrates image effect fields through workbench drafts", () => {
    const { defaultConfig } = installPublicConfigRuntime();
    const state = hydrateWorkbenchState(defaultConfig, { host: "example.com" });
    state.draftsByTheme["mono-geo"].actionConfigs.leftClick.imageEnabled = true;
    state.draftsByTheme["mono-geo"].actionConfigs.leftClick.imageDataUrl = "data:image/svg+xml;utf8,%3Csvg/%3E";
    state.draftsByTheme["mono-geo"].actionConfigs.leftClick.imageSize = 72;
    state.draftsByTheme["mono-geo"].actionConfigs.leftClick.imageDuration = 960;

    const storedConfig = buildStoredConfigFromWorkbench(defaultConfig, state);
    const storedDraft = storedConfig.themePacks.find((item) => item.id === "mono-geo").workbenchDraft.actionConfigs.leftClick;

    expect(storedDraft).toMatchObject({
      imageEnabled: true,
      imageDataUrl: "data:image/svg+xml;utf8,%3Csvg/%3E",
      imageSize: 72,
      imageDuration: 960,
    });

    const rehydratedState = hydrateWorkbenchState(storedConfig, { host: "example.com" });
    expect(rehydratedState.draftsByTheme["mono-geo"].actionConfigs.leftClick).toMatchObject({
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
    state.draftsByTheme["mono-geo"].actionConfigs.leftClick.animationEnabled = true;
    state.draftsByTheme["mono-geo"].actionConfigs.leftClick.animationStyle = "弹跳徽记";
    state.draftsByTheme["mono-geo"].actionConfigs.leftClick.animationDuration = 880;
    state.draftsByTheme["mono-geo"].actionConfigs.leftClick.animationScale = 136;

    const storedConfig = buildStoredConfigFromWorkbench(defaultConfig, state);
    const storedDraft = storedConfig.themePacks.find((item) => item.id === "mono-geo").workbenchDraft.actionConfigs.leftClick;

    expect(storedDraft).toMatchObject({
      animationEnabled: true,
      animationStyle: "弹跳徽记",
      animationDuration: 880,
      animationScale: 136,
    });

    const rehydratedState = hydrateWorkbenchState(storedConfig, { host: "example.com" });
    expect(rehydratedState.draftsByTheme["mono-geo"].actionConfigs.leftClick).toMatchObject({
      animationEnabled: true,
      animationStyle: "弹跳徽记",
      animationDuration: 880,
      animationScale: 136,
    });
  });

  it("stores key feedback config inside theme workbench draft", () => {
    const { defaultConfig } = installPublicConfigRuntime();
    const state = hydrateWorkbenchState(defaultConfig, { host: "example.com" });
    state.draftsByTheme["mono-geo"].keyFeedbackConfig.color = "#00FFAA";
    state.draftsByTheme["mono-geo"].keyFeedbackConfig.fontSize = 72;

    const storedConfig = buildStoredConfigFromWorkbench(defaultConfig, state);
    const storedThemePack = storedConfig.themePacks.find((item) => item.id === "mono-geo");

    expect(storedThemePack.workbenchDraft.keyFeedbackConfig).toMatchObject({
      color: "#00FFAA",
      fontSize: 72,
      animationStyle: "bounce",
    });
    expect(storedThemePack.workbenchDraft.resetKeyFeedbackConfig).toMatchObject({
      color: state.draftsByTheme["mono-geo"].resetKeyFeedbackConfig.color,
      fontSize: state.draftsByTheme["mono-geo"].resetKeyFeedbackConfig.fontSize,
    });
  });

  it("preserves legacy root key feedback config instead of overwriting it from the current draft", () => {
    const { defaultConfig } = installPublicConfigRuntime();
    const previousConfig = {
      ...defaultConfig,
      keyFeedbackConfig: {
        ...defaultConfig.keyFeedbackConfig,
        color: "#111111",
        fontSize: 30,
      },
    };
    const state = hydrateWorkbenchState(previousConfig, { host: "example.com" });
    state.draftsByTheme["mono-geo"].keyFeedbackConfig.color = "#00FFAA";
    state.draftsByTheme["mono-geo"].keyFeedbackConfig.fontSize = 72;

    const storedConfig = buildStoredConfigFromWorkbench(previousConfig, state);

    expect(storedConfig.keyFeedbackConfig.color).toBe("#111111");
    expect(storedConfig.keyFeedbackConfig.fontSize).toBe(30);
    expect(storedConfig.themePacks.find((item) => item.id === "mono-geo").workbenchDraft.keyFeedbackConfig.color).toBe("#00FFAA");
  });
});
