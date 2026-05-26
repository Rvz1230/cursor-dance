import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { createThemeDraft } from "../model/workbenchSchema.js";
import {
  buildPreviewThemePackFromWorkbench,
  buildStoredConfigFromWorkbench,
  buildStoredThemePackFromWorkbench,
  hydrateWorkbenchState,
  SITE_MODE_ENABLED,
  SITE_MODE_DISABLED,
  SITE_MODE_FOLLOW,
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

  it("hydrates workbench state through runtime site mode and editor aliases", () => {
    installWindowStub({
      CursorDanceConfigRuntime: {
        getSiteRule: vi.fn(() => ({ mode: "enabled", themePackId: "woodfish" })),
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
    expect(state.siteMode).toBe(SITE_MODE_ENABLED);
    expect(state.siteThemeId).toBe("woodfish");
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
    const setSiteRuleThemePackId = vi.fn((config, host, themePackId) => ({
      ...config,
      siteRules: {
        ...(config.siteRules || {}),
        byHost: {
          ...(config.siteRules?.byHost || {}),
          [host]: {
            ...(config.siteRules?.byHost?.[host] || {}),
            themePackId,
          },
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
        setSiteRuleThemePackId,
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
        siteMode: SITE_MODE_DISABLED,
        siteThemeId: "woodfish",
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
    expect(setSiteRuleThemePackId).not.toHaveBeenCalled();
  });

  it("writes enabled site rules with a dedicated theme binding", () => {
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
    const setSiteRuleThemePackId = vi.fn((config, host, themePackId) => ({
      ...config,
      siteRules: {
        ...(config.siteRules || {}),
        byHost: {
          ...(config.siteRules?.byHost || {}),
          [host]: {
            ...(config.siteRules?.byHost?.[host] || {}),
            themePackId,
          },
        },
      },
    }));

    installWindowStub({
      CursorDanceConfigRuntime: {
        setSiteRuleMode,
        setSiteRuleThemePackId,
        normalizeConfig: (config) => config,
      },
    });

    const draft = createThemeDraft("woodfish");

    const storedConfig = buildStoredConfigFromWorkbench(
      {
        enabled: true,
        themePacks: [],
        editor: {},
      },
      {
        workspaceId: "sites",
        siteMode: SITE_MODE_ENABLED,
        siteThemeId: "petal",
        themeLibrary: [
          createThemeLibraryEntry(),
          createThemeLibraryEntry({ id: "petal", name: "花瓣流光", tone: "rose" }),
        ],
        draftsByTheme: {
          woodfish: draft,
          petal: createThemeDraft("petal"),
        },
        selection: {
          themeId: "woodfish",
          actionId: "leftClick",
          cursorStateId: "default",
        },
        siteRulesByHost: {},
        ui: { enabled: true },
        site: { host: "example.com" },
      }
    );

    expect(setSiteRuleMode).toHaveBeenCalledWith(expect.any(Object), "example.com", "enabled");
    expect(setSiteRuleThemePackId).toHaveBeenCalledWith(expect.any(Object), "example.com", "petal");
    expect(storedConfig.siteRules.byHost["example.com"]).toEqual({ mode: "enabled", themePackId: "petal" });
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
    expect(storedLeftClickDraft).toHaveProperty("holdMs", 80);
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
    expect(leftClickConfig.holdMs).toBe(80);
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
    const { defaultConfig, runtime } = installPublicConfigRuntime();
    runtime.setSiteRuleMode = vi.fn((config, host, mode) => {
      const nextByHost = { ...(config.siteRules?.byHost || {}) };
      if (mode === "inherit") {
        delete nextByHost[host];
      } else {
        nextByHost[host] = mode === "enabled"
          ? { mode, themePackId: nextByHost[host]?.themePackId || "woodfish" }
          : { mode };
      }
      return {
        ...config,
        siteRules: { ...(config.siteRules || {}), byHost: nextByHost },
      };
    });
    runtime.setSiteRuleThemePackId = vi.fn((config, host, themePackId) => ({
      ...config,
      siteRules: {
        ...(config.siteRules || {}),
        byHost: {
          ...(config.siteRules?.byHost || {}),
          [host]: {
            ...(config.siteRules?.byHost?.[host] || {}),
            mode: "enabled",
            themePackId,
          },
        },
      },
    }));

    // Start with no site rules
    const state1 = hydrateWorkbenchState(defaultConfig, { host: "example.com" });
    expect(state1.siteMode).toBe(SITE_MODE_FOLLOW);
    expect(state1.siteRulesByHost).toEqual({});

    // Enable site + select theme
    const draft = createThemeDraft("woodfish");
    draft.actionConfigs.leftClick.textContent = "roundtrip";
    const state2 = {
      ...state1,
      siteMode: SITE_MODE_ENABLED,
      siteThemeId: "petal",
      draftsByTheme: { ...state1.draftsByTheme, woodfish: draft },
    };
    const config2 = buildStoredConfigFromWorkbench(defaultConfig, state2);
    expect(config2.siteRules.byHost["example.com"]).toEqual({ mode: "enabled", themePackId: "petal" });

    // Rehydrate and verify
    const state3 = hydrateWorkbenchState(config2, { host: "example.com" });
    expect(state3.siteMode).toBe(SITE_MODE_ENABLED);
    expect(state3.siteThemeId).toBe("petal");
    expect(state3.siteRulesByHost["example.com"]).toEqual({ mode: "enabled", themePackId: "petal" });

    // Disable site
    const state4 = {
      ...state3,
      siteMode: SITE_MODE_DISABLED,
    };
    const config4 = buildStoredConfigFromWorkbench(config2, state4);
    expect(config4.siteRules.byHost["example.com"]).toEqual({ mode: "disabled" });

    // Follow global — rule removed
    const state5 = {
      ...state4,
      siteMode: SITE_MODE_FOLLOW,
    };
    const config5 = buildStoredConfigFromWorkbench(config4, state5);
    expect(config5.siteRules.byHost["example.com"]).toBeUndefined();

    // Rehydrate after removal
    const state6 = hydrateWorkbenchState(config5, { host: "example.com" });
    expect(state6.siteMode).toBe(SITE_MODE_FOLLOW);
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
