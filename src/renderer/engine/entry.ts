// CursorDance 效果引擎入口
//
// 调用方（src/renderer/overlay、Workbench 预览面板）通过 createEffectEngine(deps)
// 拿到 { visualEffects, cursorOverlay, audioRuntime, triggerHandlers } 四个子模块。
//
// 任务 2.1 / 2.2 / 2.3 / 2.4：四个引擎子模块全部就位。

import type { EngineDeps, EffectEngine } from "./types";
import { createVisualEffects } from "./visual-effects";
import { createCursorOverlay } from "./cursor-overlay";
import { createAudioRuntime } from "./audio";
import { createTriggerHandlers } from "./trigger-handlers";

export function createEffectEngine(deps: EngineDeps): EffectEngine {
  const visualEffects = createVisualEffects(deps);
  const cursorOverlay = createCursorOverlay({
    document: deps.document,
    constants: deps.constants,
    state: deps.state,
    visualEffects,
  });
  const audioRuntime = createAudioRuntime({
    window: deps.window,
    state: deps.state,
    configStore: deps.configStore,
  });
  const triggerHandlers = createTriggerHandlers({
    window: deps.window,
    document: deps.document,
    state: deps.state,
    configStore: deps.configStore,
    visualEffects,
    audioRuntime,
    cursorOverlay,
  });

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
