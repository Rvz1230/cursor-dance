// CursorDance 配置存储 / 解析
//
// 从 public/content-runtime/config-store.js 迁移而来（任务 2.5）。关键调整：
//   - 去 IIFE，改为 createConfigStore(deps)，依赖通过参数注入。
//   - **删除 hover BASE_ACTION_CONFIG 条目**：桌面端不支持 hover 触发（CLAUDE.md
//     no-go）。BASE_ACTION_CONFIGS 现有 5 条：leftClick / rightClick /
//     doubleClick / longPress / wheel。
//   - **chrome.storage 替换为 storeAdapter**：调用方注入异步 read/write，桌面端
//     桥接 IPC + electron-store，扩展端可仍由 chrome.storage 包装。
//   - **resolveSiteRule → resolveAppRule**：站点规则换成应用规则；isCurrentSiteEnabled
//     和 getActiveScheme 现在向 deps.activeAppInfo 索要 processName/title。
//   - resolveCursorStateId / matchesTriggerZone 仍走 DOM 路径——桌面端的 trigger-handlers
//     在没有真实 DOM target 时把 target 传 null，这里返回 "default" / true 即可。
//   - getWorkbenchDraft / mergeActionConfig 字节级保留——这是两端 actionConfig
//     合并语义的唯一来源，扩展端 actionConfigSync.test.js 已校验。
//   - debouncedSyncConfigFromStorage 保留为 thin wrapper；live-preview / chrome
//     session 通道在桌面端不存在，由 storeAdapter 实现自行决定如何映射。

import type {
  ConfigStore,
  EngineState,
  DiagnosticsModule,
} from "./types";
import {
  defaultConfig as defaultEngineConfig,
  mergeCursorStates as defaultMergeCursorStates,
  normalizeConfig as defaultNormalizeConfig,
  needsMigration as defaultNeedsMigration,
  type CursorDanceConfig,
  type ThemePack,
} from "./default-config";
import {
  getActionTriggerConfig,
  getActionTextConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionAudioConfig,
  getActionAnimationConfig,
  getActionImageConfig,
  getActionCursorFeedbackConfig,
} from "./action-config";
import { resolveAppRule, type AppRule, type ActiveAppInfo } from "./app-matcher";

export interface ConfigStoreConstants {
  CONFIG_STORAGE_KEY: string;
  LEGACY_ENABLED_STORAGE_KEY: string;
  LIVE_PREVIEW_CONFIG_STORAGE_KEY: string;
  CURSOR_ASSET_STORAGE_KEY_PREFIX: string;
  INTERACTIVE_SELECTOR: string;
  TEXT_EDITABLE_SELECTOR: string;
}

export interface ConfigStoreAdapter {
  /** 读取 { [CONFIG_STORAGE_KEY], [LEGACY_ENABLED_STORAGE_KEY] } 等键。返回值同 chrome.storage.local.get */
  get(keys: string[]): Promise<Record<string, unknown>>;
  /** 写入键值对。Set Promise resolve 后视为持久化完成。 */
  set(payload: Record<string, unknown>): Promise<void>;
  /** 选填：读取 live preview 临时配置（扩展走 chrome.storage.session；桌面可不实现）。 */
  getSessionConfig?(): Promise<unknown | null>;
  /** 选填：读取本地预览配置（landing 等）；桌面端通常返回 null。 */
  getLocalPreviewConfig?(): unknown | null;
}

export interface ConfigStoreDeps {
  window: Window;
  state: EngineState;
  constants: ConfigStoreConstants;
  diagnostics?: DiagnosticsModule;
  storeAdapter?: ConfigStoreAdapter;
  /** 桌面端注入：当前前台应用（进程名 / 窗口标题）。扩展端不传，回退到「无规则匹配」。 */
  getActiveAppInfo?: () => ActiveAppInfo | null;
  /** 桌面端不需要：扩展端 / 静态预览传入应用规则数组（替代了原来的 siteRules）。 */
  getAppRules?: () => AppRule[] | null | undefined;
  /** 上层 reportRuntimeError 回调。 */
  reportRuntimeError?: (scope: string, message: string) => void;
}

export interface ConfigStoreApi extends ConfigStore {
  setConfig(nextConfig: unknown): CursorDanceConfig;
  getConfig(): CursorDanceConfig;
  normalizeConfig(value: unknown): CursorDanceConfig;
  isLocalPreviewHost(): boolean;
  getActiveScheme(): ThemePack;
  isCurrentSiteEnabled(): boolean;
  getActionConfig(scheme: ThemePack | null | undefined, actionId: string): Record<string, unknown> | null;
  getCursorStateBinding(scheme: ThemePack | null | undefined, stateId: string, sourceActionId: string): {
    cursorStateId: string;
    actionId: string;
    inheritedFromDefault: boolean;
  };
  getEffectiveCursorStateConfig(scheme: ThemePack | null | undefined, stateId: string): unknown;
  resolveCursorStateId(target: unknown): string;
  matchesTriggerZone(
    target: unknown,
    triggerZone: unknown,
    event: unknown,
    opts: { actionId: string; triggerSource: string },
  ): boolean;
  getMaxActiveEffects(): number;
  getAtmosphereConfig(scheme: ThemePack | null | undefined): { mode: string };
  getBaseActionConfigs(): Record<string, Record<string, unknown>>;
  getWorkbenchDraft(scheme: ThemePack | null | undefined): {
    cursorModes: Record<string, string>;
    cursorStateActions: Record<string, string>;
    cursorStateAssets: Record<string, unknown>;
    actionConfigs: Record<string, Record<string, unknown>>;
  };
  syncConfigFromStorage(opts: { clearStateCursorOverlay: () => void }): Promise<void>;
  debouncedSyncConfigFromStorage(opts: { clearStateCursorOverlay: () => void }): void;
  setOnSyncComplete(cb: (() => void) | null): void;
}

const ATMOSPHERE_DEFAULTS = { mode: "none" as const };

const BASE_ACTION_CONFIGS: Record<string, Record<string, unknown>> = {
  leftClick: {
    textKind: "数字飘字",
    textStyle: "阿拉伯数字 (1, 2, 3)",
    textMode: "默认模式 (+1)",
    textTemplate: "${number}",
    textEnabled: true,
    textContent: "+1",
    textTags: ["功德 +1", "继续点击", "已触发"],
    textTagPlayMode: "按顺序显示",
    textColor: "#B45309",
    textDuration: 1000,
    textEasing: "弹跳",
    textOpacity: 100,
    textFontFamily: "系统默认",
    textWeight: "加粗",
    textOutlineWidth: 0,
    textShadow: "柔和",
    comboEnabled: true,
    textOffsetX: 0,
    textOffsetY: -28,
    fontSize: 24,
    particle: true,
    particleCount: 22,
    particleSpread: 62,
    particleStyle: "火花",
    particleDirection: "四周扩散",
    particleColorMode: "跟随主题",
    particlePalette: ["#FBBF24", "#F59E0B", "#FDE68A", "#FCD34D", "#FEF3C7"],
    particleDuration: 780,
    particleSize: 14,
    particleOpacity: 88,
    particleGravity: 8,
    particleWind: 0,
    particleBounce: 14,
    particleTrail: false,
    particleDelay: 0,
    particleStagger: 26,
    particleMotionMode: "burst",
    orbitalCount: 6,
    orbitalRadius: 32,
    orbitalSpeed: 3,
    ripple: true,
    rippleSize: 72,
    rippleDuration: 860,
    rippleStyle: "回声环",
    rippleEasing: "缓出",
    rippleLineWidth: 2,
    rippleOpacity: 72,
    rippleColor: "#F59E0B",
    rippleDelay: 0,
    sound: true,
    volume: 72,
    playbackRate: 100,
    soundDelay: 0,
    soundFadeOut: 80,
    soundTriggerMode: "每次触发",
    soundBlendMode: "保持原音量",
    soundFile: "woodfish-soft.wav",
    animationEnabled: false,
    animationStyle: "聚焦脉冲",
    animationDuration: 720,
    animationEasing: "缓出",
    animationScale: 100,
    animationOpacity: 100,
    animationOffsetX: 0,
    animationOffsetY: -10,
    animationColor: "#F59E0B",
    animationGlow: false,
    animationDelay: 0,
    imageEnabled: false,
    imageDataUrl: "",
    imageDuration: 780,
    imageSize: 56,
    imageOpacity: 100,
    imageOffsetX: 0,
    imageOffsetY: -18,
    imageDelay: 0,
    textGradient: false,
    textGradientStart: "#FBBF24",
    textGradientEnd: "#EC4899",
    cursorTrailEnabled: true,
    cursorTrailCount: 4,
    cursorTrailOpacity: 36,
    cursorGlowColor: "#F59E0B",
    comboWindowMs: 900,
    textDelay: 0,
    shake: 48,
    cursorOverride: "木鱼（继承默认）",
    cursorSize: 48,
    triggerTiming: "抬起时",
    triggerZone: "当前页面可点击区域",
    holdMs: 0,
  },
  rightClick: {
    textKind: "文本飘字",
    textEnabled: false,
    textContent: "menu",
    textTags: ["展开菜单", "右键操作", "更多选项"],
    textColor: "#475569",
    textDuration: 820,
    textEasing: "缓出",
    textWeight: "中等",
    textShadow: "无",
    textOffsetY: -18,
    particle: true,
    particleCount: 14,
    particleSpread: 40,
    particleDirection: "四周扩散",
    particleDuration: 560,
    particleSize: 10,
    particleOpacity: 72,
    particleGravity: 0,
    particleWind: 0,
    particleBounce: 0,
    particleTrail: false,
    particleDelay: 0,
    particleStagger: 26,
    particleMotionMode: "burst",
    orbitalCount: 6,
    orbitalRadius: 32,
    orbitalSpeed: 3,
    ripple: true,
    rippleSize: 50,
    rippleDuration: 560,
    rippleStyle: "双环",
    rippleEasing: "缓出",
    rippleOpacity: 62,
    rippleColor: "#F59E0B",
    rippleDelay: 0,
    sound: false,
    fontSize: 18,
    volume: 60,
    soundFadeOut: 40,
    soundTriggerMode: "节流播放",
    shake: 22,
    cursorOverride: "跟随当前状态",
    cursorSize: 44,
    triggerTiming: "菜单弹出前",
    triggerZone: "右键菜单前",
    holdMs: 0,
    soundFile: "tick-light.wav",
    textStyle: "阿拉伯数字 (1, 2, 3)",
    textMode: "默认模式 (+1)",
    textTemplate: "${number}",
    textOpacity: 100,
    textFontFamily: "系统默认",
    textOutlineWidth: 0,
    textTagPlayMode: "按顺序显示",
    comboEnabled: false,
    textOffsetX: 0,
    particleStyle: "点状粒子",
    particleColorMode: "跟随主题",
    particlePalette: ["#FBBF24", "#F59E0B", "#FDE68A", "#FCD34D", "#FEF3C7"],
    rippleLineWidth: 2,
    soundBlendMode: "保持原音量",
    playbackRate: 100,
    soundDelay: 0,
    animationEnabled: false,
    animationStyle: "聚焦脉冲",
    animationDuration: 720,
    animationEasing: "缓出",
    animationScale: 100,
    animationOpacity: 100,
    animationOffsetX: 0,
    animationOffsetY: -10,
    animationColor: "#F59E0B",
    animationGlow: false,
    animationDelay: 0,
    imageEnabled: false,
    imageDataUrl: "",
    imageDuration: 780,
    imageSize: 56,
    imageOpacity: 100,
    imageOffsetX: 0,
    imageOffsetY: -18,
    imageDelay: 0,
    textGradient: false,
    textGradientStart: "#FBBF24",
    textGradientEnd: "#EC4899",
    cursorTrailEnabled: false,
    cursorTrailCount: 5,
    cursorTrailOpacity: 50,
    cursorGlowColor: "",
    comboWindowMs: 900,
    textDelay: 0,
  },
  doubleClick: {
    textKind: "数字飘字",
    textStyle: "英文单词 (one, two, three)",
    textMode: "模板模式",
    textTemplate: "combo ${number}",
    textEnabled: true,
    textContent: "combo",
    textTags: ["双击完成", "连击命中", "combo"],
    textTagPlayMode: "随机显示",
    textColor: "#0F766E",
    textDuration: 1100,
    textEasing: "弹性",
    textWeight: "加粗",
    textOutlineWidth: 1,
    textShadow: "柔和",
    comboEnabled: true,
    textOffsetY: -30,
    particle: true,
    particleCount: 26,
    particleSpread: 74,
    particleStyle: "火花",
    particleDirection: "四周扩散",
    particleColorMode: "随机轻变化",
    particlePalette: ["#14B8A6", "#0F766E", "#5EEAD4", "#99F6E4", "#CCFBF1"],
    particleDuration: 980,
    particleSize: 16,
    particleOpacity: 96,
    particleGravity: 0,
    particleWind: 0,
    particleBounce: 0,
    particleTrail: false,
    particleDelay: 0,
    particleStagger: 26,
    particleMotionMode: "burst",
    orbitalCount: 6,
    orbitalRadius: 32,
    orbitalSpeed: 3,
    ripple: true,
    rippleSize: 84,
    rippleDuration: 940,
    rippleStyle: "双环",
    rippleEasing: "弹性",
    rippleLineWidth: 3,
    rippleOpacity: 84,
    rippleColor: "#14B8A6",
    rippleDelay: 0,
    sound: true,
    fontSize: 24,
    volume: 80,
    playbackRate: 104,
    soundFadeOut: 90,
    soundTriggerMode: "连击叠加",
    soundBlendMode: "压低页面音频",
    shake: 52,
    cursorOverride: "木鱼（增强态）",
    cursorSize: 52,
    cursorTrailEnabled: true,
    cursorTrailCount: 5,
    cursorTrailOpacity: 42,
    cursorGlowColor: "#14B8A6",
    triggerTiming: "第二次抬起后",
    triggerZone: "双击命中区域",
    holdMs: 320,
    soundFile: "woodfish-deep.wav",
    textOpacity: 100,
    textFontFamily: "系统默认",
    textOffsetX: 0,
    animationEnabled: false,
    animationStyle: "聚焦脉冲",
    animationDuration: 720,
    animationEasing: "缓出",
    animationScale: 100,
    animationOpacity: 100,
    animationOffsetX: 0,
    animationOffsetY: -10,
    animationColor: "#F59E0B",
    animationGlow: false,
    animationDelay: 0,
    imageEnabled: false,
    imageDataUrl: "",
    imageDuration: 780,
    imageSize: 56,
    imageOpacity: 100,
    imageOffsetX: 0,
    imageOffsetY: -18,
    imageDelay: 0,
    textGradient: false,
    textGradientStart: "#FBBF24",
    textGradientEnd: "#EC4899",
    comboWindowMs: 900,
    textDelay: 0,
    soundDelay: 0,
  },
  longPress: {
    textKind: "文本飘字",
    textStyle: "中文数字 (一, 二, 三)",
    textEnabled: false,
    textContent: "蓄",
    textTags: ["按住中", "蓄力完成", "松开触发"],
    textColor: "#7C3AED",
    textDuration: 900,
    textEasing: "缓入缓出",
    textOpacity: 94,
    textWeight: "中等",
    textShadow: "柔和",
    textOffsetY: -22,
    particle: true,
    particleCount: 16,
    particleSpread: 48,
    particleStyle: "碎屑粒子",
    particleDirection: "向上喷发",
    particlePalette: ["#A78BFA", "#7C3AED", "#C4B5FD", "#DDD6FE", "#EDE9FE"],
    particleDuration: 740,
    particleSize: 12,
    particleOpacity: 78,
    particleGravity: 0,
    particleWind: 0,
    particleBounce: 0,
    particleTrail: false,
    particleDelay: 0,
    particleStagger: 26,
    particleMotionMode: "burst",
    orbitalCount: 6,
    orbitalRadius: 32,
    orbitalSpeed: 3,
    ripple: true,
    rippleSize: 62,
    rippleDuration: 780,
    rippleStyle: "柔和面波",
    rippleEasing: "缓入缓出",
    rippleOpacity: 56,
    rippleColor: "#A78BFA",
    rippleDelay: 0,
    sound: true,
    fontSize: 20,
    volume: 72,
    playbackRate: 92,
    soundDelay: 60,
    soundFadeOut: 120,
    soundTriggerMode: "每次触发",
    soundBlendMode: "压低页面音频",
    shake: 58,
    cursorOverride: "木鱼（按压态）",
    cursorSize: 50,
    triggerTiming: "松开后触发",
    triggerZone: "按住后释放",
    holdMs: 560,
    soundFile: "woodfish-deep.wav",
    textMode: "默认模式 (+1)",
    textTemplate: "${number}",
    textFontFamily: "系统默认",
    textOutlineWidth: 0,
    textTagPlayMode: "按顺序显示",
    comboEnabled: false,
    textOffsetX: 0,
    particleColorMode: "跟随主题",
    animationEnabled: false,
    animationStyle: "聚焦脉冲",
    animationDuration: 720,
    animationEasing: "缓出",
    animationScale: 100,
    animationOpacity: 100,
    animationOffsetX: 0,
    animationOffsetY: -10,
    animationColor: "#F59E0B",
    animationGlow: false,
    animationDelay: 0,
    imageEnabled: false,
    imageDataUrl: "",
    imageDuration: 780,
    imageSize: 56,
    imageOpacity: 100,
    imageOffsetX: 0,
    imageOffsetY: -18,
    imageDelay: 0,
    textGradient: false,
    textGradientStart: "#FBBF24",
    textGradientEnd: "#EC4899",
    cursorTrailEnabled: false,
    cursorTrailCount: 5,
    cursorTrailOpacity: 50,
    cursorGlowColor: "",
    comboWindowMs: 900,
    textDelay: 0,
    rippleLineWidth: 2,
  },
  wheel: {
    textKind: "文本飘字",
    textEnabled: false,
    textContent: "roll",
    textTags: ["向上滚动", "向下滚动", "继续滚动"],
    textTagPlayMode: "随机显示",
    textColor: "#0284C7",
    textDuration: 700,
    textEasing: "线性",
    textOpacity: 90,
    textWeight: "常规",
    textShadow: "无",
    textOffsetY: -14,
    particle: true,
    particleCount: 10,
    particleSpread: 36,
    particleDirection: "四周扩散",
    particleColorMode: "跟随飘字色",
    particlePalette: ["#FBBF24", "#F59E0B", "#FDE68A", "#FCD34D", "#FEF3C7"],
    particleDuration: 460,
    particleSize: 10,
    particleOpacity: 72,
    particleGravity: 0,
    particleWind: 0,
    particleBounce: 0,
    particleTrail: false,
    particleDelay: 0,
    particleStagger: 26,
    particleMotionMode: "burst",
    orbitalCount: 6,
    orbitalRadius: 32,
    orbitalSpeed: 3,
    ripple: true,
    rippleSize: 38,
    rippleDuration: 500,
    rippleEasing: "线性",
    rippleLineWidth: 1,
    rippleOpacity: 46,
    rippleColor: "#0284C7",
    rippleDelay: 0,
    sound: false,
    fontSize: 16,
    volume: 40,
    playbackRate: 110,
    soundFadeOut: 30,
    soundTriggerMode: "节流播放",
    shake: 16,
    cursorOverride: "跟随当前状态",
    cursorSize: 44,
    triggerTiming: "连续滚动中",
    triggerZone: "向上 / 向下滚轮",
    holdMs: 180,
    soundFile: "tick-light.wav",
    textStyle: "阿拉伯数字 (1, 2, 3)",
    textMode: "默认模式 (+1)",
    textTemplate: "${number}",
    textFontFamily: "系统默认",
    textOutlineWidth: 0,
    comboEnabled: false,
    textOffsetX: 0,
    particleStyle: "点状粒子",
    soundBlendMode: "保持原音量",
    soundDelay: 0,
    animationEnabled: false,
    animationStyle: "聚焦脉冲",
    animationDuration: 720,
    animationEasing: "缓出",
    animationScale: 100,
    animationOpacity: 100,
    animationOffsetX: 0,
    animationOffsetY: -10,
    animationColor: "#F59E0B",
    animationGlow: false,
    animationDelay: 0,
    imageEnabled: false,
    imageDataUrl: "",
    imageDuration: 780,
    imageSize: 56,
    imageOpacity: 100,
    imageOffsetX: 0,
    imageOffsetY: -18,
    imageDelay: 0,
    textGradient: false,
    textGradientStart: "#FBBF24",
    textGradientEnd: "#EC4899",
    cursorTrailEnabled: false,
    cursorTrailCount: 5,
    cursorTrailOpacity: 50,
    cursorGlowColor: "",
    comboWindowMs: 900,
    textDelay: 0,
    rippleStyle: "单环",
  },
};

export function createConfigStore(deps: ConfigStoreDeps): ConfigStoreApi {
  const {
    window,
    state,
    constants,
    diagnostics,
    storeAdapter,
    getActiveAppInfo,
    getAppRules,
    reportRuntimeError,
  } = deps;

  // 使用 EngineState.config 切片承载当前 config（与扩展端布局一致）。
  const stateAsAny = state as EngineState & { config?: CursorDanceConfig };

  function normalizeConfig(value: unknown): CursorDanceConfig {
    return defaultNormalizeConfig(value as Partial<CursorDanceConfig>, defaultEngineConfig);
  }

  function setConfig(nextConfig: unknown): CursorDanceConfig {
    stateAsAny.config = normalizeConfig(nextConfig);
    return stateAsAny.config;
  }

  function getConfig(): CursorDanceConfig {
    return stateAsAny.config || defaultEngineConfig;
  }

  function isLocalPreviewHost(): boolean {
    const hostname = window.location?.hostname || "";
    return hostname === "localhost" || hostname === "127.0.0.1";
  }

  function buildCursorAssetStorageKey(themeId: string, stateId: string): string {
    return `${constants.CURSOR_ASSET_STORAGE_KEY_PREFIX}${themeId}.${stateId}`;
  }

  function mergeCursorStates(
    fallbackCursorStates: Record<string, unknown> | null | undefined,
    cursorStates: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    return defaultMergeCursorStates(
      fallbackCursorStates as never,
      cursorStates as never,
    ) as Record<string, unknown>;
  }

  function getSchemeById(schemeId: string | undefined | null): ThemePack {
    const cfg = getConfig();
    return cfg.schemes.find((scheme) => scheme.id === schemeId) || cfg.schemes[0] || ({} as ThemePack);
  }

  function getActiveScheme(): ThemePack {
    const rules = getAppRules?.();
    const info = getActiveAppInfo?.();
    let appAction: ReturnType<typeof resolveAppRule> = null;
    if (rules && info) {
      appAction = resolveAppRule(rules, info);
    }
    const themeFromRule = appAction && typeof appAction === "object" && appAction.theme ? appAction.theme : "";
    return getSchemeById(themeFromRule || getConfig().activeSchemeId);
  }

  function isCurrentSiteEnabled(): boolean {
    const rules = getAppRules?.();
    const info = getActiveAppInfo?.();
    if (rules && info) {
      const appAction = resolveAppRule(rules, info);
      if (appAction === "disable") return false;
      if (appAction && typeof appAction === "object" && appAction.enable) return true;
    }
    return getConfig().enabled;
  }

  function withResolvedCursorAssets(
    nextConfig: CursorDanceConfig,
    assetEntries: Record<string, { imageDataUrl?: string }>,
  ): CursorDanceConfig {
    const assetMap = assetEntries || {};
    const nextThemePacks = (nextConfig.themePacks || []).map((themePack) => ({
      ...themePack,
      cursorStates: Object.fromEntries(
        Object.entries(themePack.cursorStates || {}).map(([stateId, stateConfig]) => [
          stateId,
          {
            ...stateConfig,
            imageDataUrl:
              assetMap[buildCursorAssetStorageKey(themePack.id, stateId)]?.imageDataUrl
              || stateConfig.imageDataUrl
              || "",
          },
        ]),
      ),
    }));

    return {
      ...nextConfig,
      themePacks: nextThemePacks,
      schemes: nextThemePacks,
    };
  }

  function getMaxActiveEffects(): number {
    return getConfig().performance?.maxActiveEffects || 48;
  }

  function getBaseActionConfigs(): Record<string, Record<string, unknown>> {
    return BASE_ACTION_CONFIGS;
  }

  function mergeActionConfig(
    baseConfig: Record<string, unknown>,
    ...overlays: (Record<string, unknown> | undefined)[]
  ): Record<string, unknown> {
    return overlays.reduce(
      (mergedConfig, overlay) => {
        const safeOverlay = overlay
          ? Object.fromEntries(Object.entries(overlay).filter(([, v]) => v !== undefined))
          : {};
        const overlayTextTags = (overlay as { textTags?: unknown })?.textTags;
        return {
          ...mergedConfig,
          ...safeOverlay,
          textTags: Array.isArray(overlayTextTags)
            ? [...(overlayTextTags as unknown[])]
            : (mergedConfig as { textTags?: unknown[] }).textTags,
        };
      },
      {
        ...baseConfig,
        textTags: Array.isArray((baseConfig as { textTags?: unknown }).textTags)
          ? [...((baseConfig as { textTags: unknown[] }).textTags)]
          : [],
      } as Record<string, unknown>,
    );
  }

  function getAtmosphereConfig(scheme: ThemePack | null | undefined): { mode: string } {
    const storedDraft = scheme?.workbenchDraft || {};
    const storedAtmosphere = storedDraft.atmosphere || {};
    return { mode: storedAtmosphere.mode || ATMOSPHERE_DEFAULTS.mode };
  }

  function getWorkbenchDraft(scheme: ThemePack | null | undefined): {
    cursorModes: Record<string, string>;
    cursorStateActions: Record<string, string>;
    cursorStateAssets: Record<string, unknown>;
    actionConfigs: Record<string, Record<string, unknown>>;
  } {
    const fallbackPack = defaultEngineConfig.schemes?.[0]?.cursorStates as Record<string, unknown> | undefined;
    const mergedCursorStates = mergeCursorStates(fallbackPack, scheme?.cursorStates as Record<string, unknown>);
    const baseCursorModes = Object.fromEntries(
      Object.entries(mergedCursorStates || {}).map(([stateId, stateConfig]) => {
        const sc = stateConfig as { mode?: string };
        if (stateId === "default") return [stateId, sc.mode === "override" ? "覆盖" : "源"];
        return [stateId, sc.mode === "override" ? "覆盖" : "继承"];
      }),
    );
    const baseCursorStateActions = Object.fromEntries(
      Object.entries(mergedCursorStates || {}).map(([stateId, stateConfig]) => [
        stateId,
        (stateConfig as { actionId?: string })?.actionId || "leftClick",
      ]),
    );
    const baseActionConfigs = getBaseActionConfigs();
    const storedDraft = scheme?.workbenchDraft || {};
    const storedActionConfigs = storedDraft.actionConfigs || {};

    return {
      cursorModes: { ...baseCursorModes, ...(storedDraft.cursorModes || {}) },
      cursorStateActions: { ...baseCursorStateActions, ...(storedDraft.cursorStateActions || {}) },
      cursorStateAssets: storedDraft.cursorStateAssets || {},
      actionConfigs: Object.fromEntries(
        Object.keys(baseActionConfigs).map((actionId) => [
          actionId,
          mergeActionConfig(baseActionConfigs[actionId], storedActionConfigs[actionId]),
        ]),
      ),
    };
  }

  function getActionConfig(scheme: ThemePack | null | undefined, actionId: string): Record<string, unknown> | null {
    const draft = getWorkbenchDraft(scheme);
    return draft.actionConfigs?.[actionId] || draft.actionConfigs?.leftClick || null;
  }

  function getMergedCursorStates(scheme: ThemePack | null | undefined): Record<string, unknown> {
    const fallback = defaultEngineConfig.schemes?.[0]?.cursorStates as Record<string, unknown> | undefined;
    return mergeCursorStates(fallback, scheme?.cursorStates as Record<string, unknown>);
  }

  function getCursorStateBinding(
    scheme: ThemePack | null | undefined,
    stateId: string,
    sourceActionId: string,
  ): { cursorStateId: string; actionId: string; inheritedFromDefault: boolean } {
    if (sourceActionId !== "leftClick") {
      return { cursorStateId: stateId, actionId: sourceActionId, inheritedFromDefault: false };
    }

    const mergedCursorStates = getMergedCursorStates(scheme);
    const defaultStateConfig = mergedCursorStates?.default as { actionId?: string } | undefined;
    const defaultActionId = defaultStateConfig?.actionId || "leftClick";
    const stateConfig = (mergedCursorStates?.[stateId] || {}) as { mode?: string; actionId?: string };
    const inheritedFromDefault = stateId !== "default" && stateConfig.mode !== "override";
    const actionId = inheritedFromDefault
      ? defaultActionId
      : (stateConfig.actionId || defaultActionId || sourceActionId);

    return { cursorStateId: stateId, actionId, inheritedFromDefault };
  }

  function getEffectiveCursorStateConfig(scheme: ThemePack | null | undefined, stateId: string): unknown {
    const mergedCursorStates = getMergedCursorStates(scheme);
    const defaultState = mergedCursorStates?.default || null;
    const stateConfig = (mergedCursorStates?.[stateId] || null) as { mode?: string } | null;
    if (!stateConfig) return defaultState;
    if (stateId === "default" || stateConfig.mode === "override") return stateConfig;
    return defaultState;
  }

  const cursorStateIdCache: { target: unknown; stateId: string } = { target: null, stateId: "default" };

  function resolveCursorStateId(target: unknown): string {
    if (!(target instanceof Element)) return "default";
    if (target === cursorStateIdCache.target) return cursorStateIdCache.stateId;

    const cursorValue = window.getComputedStyle(target).cursor || "";
    let stateId: string;

    if (cursorValue === "pointer" || cursorValue === "grab" || cursorValue === "grabbing") stateId = "pointer";
    else if (cursorValue === "text" || cursorValue === "vertical-text") stateId = "text";
    else if (cursorValue === "help") stateId = "help";
    else if (cursorValue === "wait" || cursorValue === "progress") stateId = "wait";
    else if (cursorValue === "not-allowed" || cursorValue === "no-drop") stateId = "notAllowed";
    else if (cursorValue === "none") stateId = "default";
    else if (
      cursorValue === "move" || cursorValue === "copy" || cursorValue === "alias"
      || cursorValue === "cell" || cursorValue === "all-scroll" || cursorValue === "crosshair"
      || cursorValue === "context-menu"
    ) stateId = "pointer";
    else if (cursorValue === "zoom-in" || cursorValue === "zoom-out") stateId = "pointer";
    else if (typeof cursorValue.endsWith === "function" && cursorValue.endsWith("-resize")) stateId = "pointer";
    else if (target.closest(constants.TEXT_EDITABLE_SELECTOR)) stateId = "text";
    else if (target.closest(":disabled,[aria-disabled='true']")) stateId = "notAllowed";
    else if (target.closest(constants.INTERACTIVE_SELECTOR)) stateId = "pointer";
    else stateId = "default";

    cursorStateIdCache.target = target;
    cursorStateIdCache.stateId = stateId;
    return stateId;
  }

  function isInteractiveTarget(target: unknown): boolean {
    return target instanceof Element ? Boolean(target.closest(constants.INTERACTIVE_SELECTOR)) : false;
  }

  function isButtonOrLinkTarget(target: unknown): boolean {
    return target instanceof Element ? Boolean(target.closest("a,button,[role='button']")) : false;
  }

  function matchesTriggerZone(
    target: unknown,
    triggerZone: unknown,
    event: unknown,
    meta: { actionId: string; triggerSource: string },
  ): boolean {
    let matched = true;
    const zone = typeof triggerZone === "string" ? triggerZone : "";
    const wheelEvent = event as { deltaY?: number; pointerType?: string } | null | undefined;

    if (!zone) matched = true;
    else if (zone.includes("按钮和链接")) matched = isButtonOrLinkTarget(target);
    else if (zone.includes("可交互元素")) matched = isInteractiveTarget(target);
    else if (zone.includes("空白区域")) matched = !isInteractiveTarget(target);
    else if (zone.includes("内容卡片")) {
      matched = target instanceof Element ? Boolean(target.closest("article,section,li,div")) : false;
    }
    else if (zone.includes("仅向上滚动")) matched = (wheelEvent?.deltaY ?? 0) < 0;
    else if (zone.includes("仅向下滚动")) matched = (wheelEvent?.deltaY ?? 0) > 0;

    diagnostics?.log("trigger-zone.check", {
      actionId: meta.actionId || null,
      triggerSource: meta.triggerSource || null,
      triggerZone: zone || "任意区域",
      matched,
      pointerType: wheelEvent?.pointerType || null,
      deltaY: Number.isFinite(wheelEvent?.deltaY) ? wheelEvent?.deltaY : null,
      target: diagnostics?.describeTarget?.(target) ?? null,
    });

    return matched;
  }

  let onSyncComplete: (() => void) | null = null;
  function setOnSyncComplete(cb: (() => void) | null): void {
    onSyncComplete = cb;
  }

  let syncTimer: number | null = null;
  function debouncedSyncConfigFromStorage(opts: { clearStateCursorOverlay: () => void }): void {
    if (syncTimer != null) window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      syncTimer = null;
      void syncConfigFromStorage(opts);
    }, 60);
  }

  async function syncConfigFromStorage(opts: { clearStateCursorOverlay: () => void }): Promise<void> {
    const { clearStateCursorOverlay } = opts;
    try {
      const localPreviewConfig = storeAdapter?.getLocalPreviewConfig?.();
      if (localPreviewConfig) {
        setConfig(localPreviewConfig);
        clearStateCursorOverlay();
        onSyncComplete?.();
        return;
      }

      try {
        const livePreviewConfig = await storeAdapter?.getSessionConfig?.();
        if (livePreviewConfig) {
          setConfig(livePreviewConfig);
          clearStateCursorOverlay();
          onSyncComplete?.();
          return;
        }
      } catch {
        reportRuntimeError?.("config-session-read", "Failed to read live preview from session storage.");
      }

      if (storeAdapter) {
        const result = await storeAdapter.get([
          constants.CONFIG_STORAGE_KEY,
          constants.LEGACY_ENABLED_STORAGE_KEY,
        ]);
        const storedConfig = result[constants.CONFIG_STORAGE_KEY];
        const nextConfig = normalizeConfig(
          storedConfig || {
            ...defaultEngineConfig,
            enabled: result[constants.LEGACY_ENABLED_STORAGE_KEY] !== false,
          },
        );
        const assetKeys = (nextConfig.themePacks || []).flatMap((themePack) =>
          Object.keys(themePack.cursorStates || {}).map((stateId) =>
            buildCursorAssetStorageKey(themePack.id, stateId),
          ),
        );
        const assetEntries = assetKeys.length
          ? (await storeAdapter.get(assetKeys)) as Record<string, { imageDataUrl?: string }>
          : {};
        stateAsAny.config = withResolvedCursorAssets(nextConfig, assetEntries);
        if (!storedConfig || defaultNeedsMigration(storedConfig)) {
          await storeAdapter.set({ [constants.CONFIG_STORAGE_KEY]: stateAsAny.config });
        }
        clearStateCursorOverlay();
        onSyncComplete?.();
        return;
      }

      setConfig(getConfig() || defaultEngineConfig);
      clearStateCursorOverlay();
      onSyncComplete?.();
    } catch {
      reportRuntimeError?.("config-sync", "Failed to sync config from storage; using defaults.");
      setConfig(getConfig() || defaultEngineConfig);
      clearStateCursorOverlay();
      onSyncComplete?.();
    }
  }

  return {
    normalizeConfig,
    setConfig,
    getConfig,
    isLocalPreviewHost,
    getActionTriggerConfig,
    getActionTextConfig,
    getActionParticleConfig,
    getActionRippleConfig,
    getActionAudioConfig,
    getActionAnimationConfig,
    getActionImageConfig,
    getActionCursorFeedbackConfig,
    getActiveScheme,
    isCurrentSiteEnabled,
    getActionConfig,
    getCursorStateBinding,
    getEffectiveCursorStateConfig,
    resolveCursorStateId,
    matchesTriggerZone,
    getMaxActiveEffects,
    getAtmosphereConfig,
    getBaseActionConfigs,
    getWorkbenchDraft,
    syncConfigFromStorage,
    debouncedSyncConfigFromStorage,
    setOnSyncComplete,
  };
}
