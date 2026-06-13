// CursorDance 效果引擎入口
//
// 调用方（src/renderer/overlay、Workbench 预览面板）通过 createEffectEngine(deps)
// 拿到 { visualEffects, cursorOverlay, audioRuntime, triggerHandlers } 四个子模块。
//
// 当前阶段（任务 2.0）只搭骨架，子模块返回空对象占位；任务 2.1–2.5 会逐个把
// public/content-runtime/*.js 迁移过来并填充具体实现。

import type {
  EngineDeps,
  EffectEngine,
  VisualEffectsModule,
  CursorOverlayModule,
  AudioRuntimeModule,
  TriggerHandlersModule,
} from "./types";

export function createEffectEngine(deps: EngineDeps): EffectEngine {
  // deps 暂未使用——后续任务从这里取 window/document/configStore
  void deps;

  const visualEffects: VisualEffectsModule = {};
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
