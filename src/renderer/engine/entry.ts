// CursorDance 效果引擎入口
//
// 调用方（src/renderer/overlay、Workbench 预览面板）通过 createEffectEngine(deps)
// 拿到 { visualEffects, cursorOverlay, audioRuntime, triggerHandlers } 四个子模块。
//
// 任务 2.1：visualEffects 已切到 createVisualEffects；其余三个子模块仍是占位，
// 等待 2.2–2.5 逐个把 public/content-runtime/*.js 迁过来。

import type {
  EngineDeps,
  EffectEngine,
  CursorOverlayModule,
  AudioRuntimeModule,
  TriggerHandlersModule,
} from "./types";
import { createVisualEffects } from "./visual-effects";

export function createEffectEngine(deps: EngineDeps): EffectEngine {
  const visualEffects = createVisualEffects(deps);
  const cursorOverlay: CursorOverlayModule = {};
  const audioRuntime: AudioRuntimeModule = {};
  const triggerHandlers: TriggerHandlersModule = {};

  return {
    visualEffects,
    cursorOverlay,
    audioRuntime,
    triggerHandlers,
  };
}

export type {
  CursorEvent,
  EngineDeps,
  EffectEngine,
  ConfigStore,
  VisualEffectsModule,
  CursorOverlayModule,
  AudioRuntimeModule,
  TriggerHandlersModule,
} from "./types";
