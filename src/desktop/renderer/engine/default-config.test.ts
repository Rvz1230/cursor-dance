import { describe, it, expect } from "vitest";
import { defaultConfig, createDefaultThemePacks, mergeThemePackWithFallback, normalizeConfig, normalizeCursorSkin } from "./default-config";
import { defaultKeyFeedbackConfig } from "./key-feedback-types";

// 任务 2.9：4 套内置主题（mono-geo / drift / molten / sunset）必须为桌面 5 个 action
// 都提供默认配置，否则 trigger-handlers 会走 missing-source-action-config skip 分支，
// overlay 上对应触发就不出效果。这条测试是回归保险——以后如果有人误删某个 action
// 默认配置，CI 会立刻拦下。

const DESKTOP_ACTION_IDS = ["leftClick", "rightClick", "doubleClick", "longPress", "wheel"] as const;
const BUILTIN_THEME_IDS = ["mono-geo", "drift", "molten", "sunset"] as const;

describe("defaultConfig — 桌面端 5 个 action 默认配置完整性", () => {
  it("4 套内置主题都各自包含 5 个 action 的默认配置", () => {
    for (const themeId of BUILTIN_THEME_IDS) {
      const pack = defaultConfig.themePacks.find((p) => p.id === themeId);
      expect(pack, `主题 ${themeId} 缺失`).toBeDefined();
      const actionConfigs = pack?.workbenchDraft?.actionConfigs || {};
      for (const actionId of DESKTOP_ACTION_IDS) {
        expect(actionConfigs[actionId], `主题 ${themeId} 缺 ${actionId} actionConfig`).toBeDefined();
      }
    }
  });

  it("createDefaultThemePacks 返回的副本同样保留 5 个 action（避免被某次 cloneValue 错误剔除）", () => {
    const packs = createDefaultThemePacks();
    for (const themeId of BUILTIN_THEME_IDS) {
      const pack = packs.find((p) => p.id === themeId);
      expect(pack).toBeDefined();
      const keys = Object.keys(pack?.workbenchDraft?.actionConfigs || {});
      for (const actionId of DESKTOP_ACTION_IDS) {
        expect(keys).toContain(actionId);
      }
    }
  });

  it("每个 action 配置至少启用一种反馈（text / particle / ripple / sound / animation / image），否则 overlay 不会出效果", () => {
    for (const themeId of BUILTIN_THEME_IDS) {
      const pack = defaultConfig.themePacks.find((p) => p.id === themeId);
      const actionConfigs = pack?.workbenchDraft?.actionConfigs || {};
      for (const actionId of DESKTOP_ACTION_IDS) {
        const cfg = actionConfigs[actionId] as Record<string, unknown>;
        const hasOutput =
          cfg.textEnabled === true ||
          cfg.particle === true ||
          cfg.ripple === true ||
          cfg.sound === true ||
          cfg.animationEnabled === true ||
          cfg.imageEnabled === true;
        expect(hasOutput, `主题 ${themeId} 的 ${actionId} 没有任何启用的反馈`).toBe(true);
      }
    }
  });

  it("内置主题都包含主题内键盘动效配置", () => {
    for (const themeId of BUILTIN_THEME_IDS) {
      const pack = defaultConfig.themePacks.find((p) => p.id === themeId);
      expect(pack?.workbenchDraft?.keyFeedbackConfig?.enabled, `主题 ${themeId} 缺 keyFeedbackConfig`).toBe(defaultKeyFeedbackConfig.enabled);
      expect(pack?.workbenchDraft?.keyFeedbackConfig?.animationStyle).toBe(defaultKeyFeedbackConfig.animationStyle);
    }
  });

  it("合并主题时优先保留用户主题内键盘动效配置", () => {
    const fallbackPack = defaultConfig.themePacks[0];
    const merged = mergeThemePackWithFallback(fallbackPack, {
      id: fallbackPack.id,
      cursorStates: fallbackPack.cursorStates,
      workbenchDraft: {
        keyFeedbackConfig: {
          color: "#00FFAA",
          fontSize: 72,
        },
      },
    });

    expect(merged.workbenchDraft?.keyFeedbackConfig?.color).toBe("#00FFAA");
    expect(merged.workbenchDraft?.keyFeedbackConfig?.fontSize).toBe(72);
    expect(merged.workbenchDraft?.keyFeedbackConfig?.animationStyle).toBe(defaultKeyFeedbackConfig.animationStyle);
  });

  it("显式空 cursorSkin 不会被 legacy cursorStates 重新填充", () => {
    const legacyCursorStates = {
      default: {
        mode: "override" as const,
        actionId: "leftClick",
        imageDataUrl: "data:image/png;base64,legacy",
        hotspotX: 8,
        hotspotY: 9,
        size: 56,
      },
    };

    expect(normalizeCursorSkin(undefined, legacyCursorStates).states.default?.image.dataUrl)
      .toBe("data:image/png;base64,legacy");
    expect(normalizeCursorSkin({ version: 1, enabled: true, transitionMs: 80, states: {} }, legacyCursorStates).states)
      .toEqual({});
  });

  it("normalizeConfig 不为没有 legacy 字段的新配置强制新增顶层 keyFeedbackConfig", () => {
    const normalized = normalizeConfig({
      schemaVersion: 3,
      enabled: true,
      activeThemePackId: defaultConfig.activeThemePackId,
      activeSchemeId: defaultConfig.activeSchemeId,
      themePacks: defaultConfig.themePacks,
      schemes: defaultConfig.schemes,
      performance: defaultConfig.performance,
      siteRules: [],
      editor: defaultConfig.editor,
    }, {
      ...defaultConfig,
      keyFeedbackConfig: undefined,
    });

    expect(normalized.keyFeedbackConfig).toBeUndefined();
  });

  it("normalizeConfig 将 legacy 顶层键盘配置迁移到所有缺失主题", () => {
    const themePacks = defaultConfig.themePacks.map((pack) => ({
      ...pack,
      workbenchDraft: {
        ...(pack.workbenchDraft || {}),
        keyFeedbackConfig: undefined,
        resetKeyFeedbackConfig: undefined,
      },
    }));
    const normalized = normalizeConfig({
      ...defaultConfig,
      activeThemePackId: "mono-geo",
      activeSchemeId: "mono-geo",
      themePacks,
      schemes: themePacks,
      keyFeedbackConfig: { ...defaultKeyFeedbackConfig, color: "#FF00AA", fontSize: 64 },
    });

    expect(normalized.themePacks.find((pack) => pack.id === "mono-geo")?.workbenchDraft?.keyFeedbackConfig?.color).toBe("#FF00AA");
    expect(normalized.themePacks.find((pack) => pack.id === "drift")?.workbenchDraft?.keyFeedbackConfig?.color).toBe("#FF00AA");
    expect(normalized.themePacks.find((pack) => pack.id === "drift")?.workbenchDraft?.resetKeyFeedbackConfig?.fontSize).toBe(64);
  });
});
