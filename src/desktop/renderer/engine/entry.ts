// CursorDance 效果引擎入口
//
// 桌面 overlay 通过 createEffectEngine(deps)
// 拿到各桌面运行时子模块；Workbench 预览使用 shared preview engine。
//
import type { EngineDeps, EffectEngine } from "./types";
import { createVisualEffects } from "./visual-effects";
import { createCursorOverlay } from "./cursor-overlay";
import { createAudioRuntime } from "./audio";
import { createTriggerHandlers } from "./trigger-handlers";
import { createKeyFeedback } from "./key-feedback";
import { createDomEffectSurface, createWebAudioOutput } from "@/shared/effect-runtime/output-adapters";

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
    diagnostics: deps.diagnostics,
    reportRuntimeError: deps.reportRuntimeError,
  });
  const effectSurface = createDomEffectSurface(visualEffects);
  const audioOutput = createWebAudioOutput(audioRuntime);
  const triggerHandlers = createTriggerHandlers({
    window: deps.window,
    state: deps.state,
    diagnostics: deps.diagnostics,
    configStore: deps.configStore,
    effectSurface,
    audioOutput,
  });
  const keyFeedback = createKeyFeedback(deps);

  return {
    visualEffects,
    effectSurface,
    cursorOverlay,
    audioRuntime,
    audioOutput,
    triggerHandlers,
    keyFeedback,
  };
}

export type {
  EngineDeps,
  EffectEngine,
  EngineConstants,
  EngineState,
} from "./types";
