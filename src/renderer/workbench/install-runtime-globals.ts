// 任务 3.0.5：把扩展端 public/config.js 通过 IIFE 注入到 window 上的两个全局
// (CursorDanceDefaultConfig / CursorDanceConfigRuntime) 在桌面 renderer 里复刻一份。
//
// 背景：
//   - 扩展端 manifest 加载 public/config.js → 在 window 上挂全局 → workbench 的
//     runtimeConfig.ts (getDefaultConfig / getRuntimeConfig) 直接读这俩全局。
//   - 桌面 workbench 渲染进程不会加载 public/*，导致两个全局缺失，
//     getDefaultConfig() 返回 {}、normalizeStoredConfig 退化为 NOOP，
//     主题列表为空、保存后改动被重置、livePreview 链路传递的是残缺 config。
//
// 已有素材：阶段二的引擎迁移（任务 2.5/2.9）已经把 createDefaultThemePacks /
// normalizeConfig / mergeThemePackWithFallback 等迁到 default-config.ts，
// action helper 在 action-config.ts，文本语义 helper 在 text-semantics.ts。
// 这里只是把这些 ES 模块导出"再挂到 window 上"，让 runtimeConfig.ts 拿得到。
//
// 必须在 ReactDOM.render 之前 import —— useThemeWorkbenchPersistence 的 hydrate
// effect 在挂载后立刻读 window.CursorDanceDefaultConfig，时机错过即丢。

import {
  cloneValue,
  createDefaultThemePacks,
  createDefaultCursorStates,
  defaultConfig,
  mergeCursorStates,
  mergeThemePackWithFallback,
  needsMigration,
  normalizeConfig,
  normalizeSiteRules,
} from "../engine/default-config";
import {
  getActionAnimationConfig,
  getActionAudioConfig,
  getActionCursorFeedbackConfig,
  getActionImageConfig,
  getActionParticleConfig,
  getActionRippleConfig,
  getActionTextConfig,
  getActionTriggerConfig,
} from "../engine/action-config";
import {
  buildStoredTextEffectPayload,
  inferTextKindFromEffect,
  resolveActionTextConfigFromEffect,
  resolveNumberStyleFromEffect,
  resolveTextModeFromEffect,
} from "../engine/text-semantics";

declare global {
  interface Window {
    CursorDanceDefaultConfig?: unknown;
    CursorDanceConfigRuntime?: unknown;
  }
}

if (typeof window !== "undefined") {
  // 只在第一次 import 时注入；HMR 重新执行时跳过避免反复覆盖（runtime 内部
  // 全是纯函数引用，覆盖也无副作用，但跳过更直观）。
  if (!window.CursorDanceDefaultConfig) {
    window.CursorDanceDefaultConfig = defaultConfig;
  }
  if (!window.CursorDanceConfigRuntime) {
    window.CursorDanceConfigRuntime = {
      cloneValue,
      createDefaultThemePacks,
      createDefaultCursorStates,
      inferTextKindFromEffect,
      resolveNumberStyleFromEffect,
      resolveTextModeFromEffect,
      resolveActionTextConfigFromEffect,
      buildStoredTextEffectPayload,
      getActionTriggerConfig,
      getActionTextConfig,
      getActionParticleConfig,
      getActionRippleConfig,
      getActionAudioConfig,
      getActionAnimationConfig,
      getActionImageConfig,
      getActionCursorFeedbackConfig,
      mergeThemePackWithFallback,
      mergeCursorStates,
      normalizeSiteRules,
      normalizeConfig,
      needsMigration,
    };
  }
}

export {};
