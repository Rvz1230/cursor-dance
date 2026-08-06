// CursorDance 配置存储 / 解析
//
// 桌面配置存储与运行时解析。关键调整：
//   - 去 IIFE，改为 createConfigStore(deps)，依赖通过参数注入。
//   - 默认动作配置与 Workbench / 扩展共用 shared effect-core 单一来源；桌面虽不
//     监听 hover，仍可安全保留其配置以便主题跨平台导入导出。
//   - **chrome.storage 替换为 storeAdapter**：调用方注入异步 read/write，桌面端
//     桥接 IPC + electron-store，扩展端可仍由 chrome.storage 包装。
//   - **resolveSiteRule → resolveAppRule**：站点规则换成应用规则；isCurrentSiteEnabled
//     和 getActiveScheme 现在向 deps.activeAppInfo 索要 processName/title。
//   - 配置选择、动作合并、光标状态和触发区域判断与扩展复用 shared runtime core。
//   - debouncedSyncConfigFromStorage 保留为 thin wrapper；live-preview / chrome
//     session 通道在桌面端不存在，由 storeAdapter 实现自行决定如何映射。

import type {
  ConfigStore,
  EngineState,
  DiagnosticsModule,
} from "./types";
import type { KeyFeedbackConfig } from "@/shared/config/key-feedback";
import { normalizeKeyFeedbackConfig } from "@/shared/config/key-feedback";
import {
  defaultConfig as defaultEngineConfig,
  needsConfigReset,
  normalizeConfig as defaultNormalizeConfig,
  type CursorDanceConfig,
  type ThemePack,
} from "@/shared/config/default-config";
import { createRuntimeConfigCore } from "@/shared/effect-runtime/runtime-config";
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
import { resolveDesktopContextAction, type ActiveAppInfo } from "../../../shared/app-rules";
import type { ContextRuleAction } from "../../../shared/domain/cursor-dance";

interface ConfigStoreConstants {
  CONFIG_STORAGE_KEY: string;
  INTERACTIVE_SELECTOR: string;
  TEXT_EDITABLE_SELECTOR: string;
}

export interface ConfigStoreAdapter {
  /** Read the canonical config entry. */
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
  /** 上层 reportRuntimeError 回调。 */
  reportRuntimeError?: (scope: string, message: string) => void;
}

export interface ConfigStoreApi extends ConfigStore {
  setConfig(nextConfig: unknown): CursorDanceConfig;
  getConfig(): CursorDanceConfig;
  normalizeConfig(value: unknown): CursorDanceConfig;
  isLocalPreviewHost(): boolean;
  getActiveScheme(): ThemePack;
  getResolvedAppRule(): ContextRuleAction | null;
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
  getKeyFeedbackConfig(): KeyFeedbackConfig;
  syncConfigFromStorage(opts: { clearStateCursorOverlay: () => void }): Promise<void>;
  debouncedSyncConfigFromStorage(opts: { clearStateCursorOverlay: () => void }): void;
  setOnSyncComplete(cb: (() => void) | null): void;
}

export function createConfigStore(deps: ConfigStoreDeps): ConfigStoreApi {
  const {
    window,
    state,
    constants,
    diagnostics,
    storeAdapter,
    getActiveAppInfo,
    reportRuntimeError,
  } = deps;

  // 使用 EngineState.config 切片承载当前 config（与扩展端布局一致）。
  const stateAsAny = state as EngineState & { config?: CursorDanceConfig };

  function normalizeConfig(value: unknown): CursorDanceConfig {
    return defaultNormalizeConfig(value, defaultEngineConfig);
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

  function getResolvedAppRule(): ContextRuleAction | null {
    return resolveDesktopContextAction(getConfig().contextRules, getActiveAppInfo?.());
  }

  const runtimeConfigCore = createRuntimeConfigCore({
    window,
    getConfig,
    resolveContextAction: getResolvedAppRule,
    interactiveSelector: constants.INTERACTIVE_SELECTOR,
    textEditableSelector: constants.TEXT_EDITABLE_SELECTOR,
    diagnostics,
  });
  const {
    getActiveTheme: getActiveScheme,
    isCurrentContextEnabled: isCurrentSiteEnabled,
    getMaxActiveEffects,
    getActionConfig,
    getCursorStateBinding,
    getEffectiveCursorStateConfig,
    resolveCursorStateId,
    matchesTriggerZone,
  } = runtimeConfigCore;

  function getKeyFeedbackConfig(): KeyFeedbackConfig {
    const activeScheme = getActiveScheme();
    return normalizeKeyFeedbackConfig(activeScheme.keyFeedbackConfig);
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
        const result = await storeAdapter.get([constants.CONFIG_STORAGE_KEY]);
        const storedConfig = result[constants.CONFIG_STORAGE_KEY];
        stateAsAny.config = normalizeConfig(storedConfig);
        if (needsConfigReset(storedConfig)) {
          await storeAdapter.set({ [constants.CONFIG_STORAGE_KEY]: stateAsAny.config });
        }
        clearStateCursorOverlay();
        onSyncComplete?.();
        return;
      }

      setConfig(defaultEngineConfig);
      clearStateCursorOverlay();
      onSyncComplete?.();
    } catch {
      reportRuntimeError?.("config-sync", "Failed to sync config from storage; using defaults.");
      setConfig(defaultEngineConfig);
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
    getResolvedAppRule,
    isCurrentSiteEnabled,
    getActionConfig,
    getCursorStateBinding,
    getEffectiveCursorStateConfig,
    resolveCursorStateId,
    matchesTriggerZone,
    getMaxActiveEffects,
    getKeyFeedbackConfig,
    syncConfigFromStorage,
    debouncedSyncConfigFromStorage,
    setOnSyncComplete,
  };
}
