// CursorDance 效果引擎入口
//
// 调用方（src/renderer/overlay、Workbench 预览面板）通过 createEffectEngine(deps)
// 拿到 { visualEffects, cursorOverlay, audioRuntime, triggerHandlers } 四个子模块。
//
// 任务 2.1 / 2.2：visualEffects、cursorOverlay 已就位；其余两个仍是占位，
// 等待 2.3 / 2.4 把 public/content-runtime/*.js 迁过来。

import type {
  EngineDeps,
  EffectEngine,
  AudioRuntimeModule,
  TriggerHandlersModule,
} from "./types";
import { createVisualEffects } from "./visual-effects";
import { createCursorOverlay } from "./cursor-overlay";

export function createEffectEngine(deps: EngineDeps): EffectEngine {
  const visualEffects = createVisualEffects(deps);
  const cursorOverlay = createCursorOverlay({
    document: deps.document,
    constants: deps.constants,
    state: deps.state,
    visualEffects,
  });
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
