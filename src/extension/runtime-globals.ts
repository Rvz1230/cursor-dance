import * as actionConfig from "@/shared/effect-core/action-config";
import * as computeSpecs from "@/shared/effect-core/compute-specs";
import * as textSemantics from "@/shared/effect-core/text-semantics";
import {
  decideActionExecution,
  getActionTimingMs,
  getComboWindowMs,
} from "@/shared/effect-runtime/action-state";
import {
  createDoubleClickDetector,
  createLongPressTracker,
} from "@/shared/effect-runtime/gesture-state";
import {
  createEffectLifecycle,
  createEffectGroupRegistry,
  createTimedOverride,
} from "@/shared/effect-runtime/effect-lifecycle";
import { createAudioRuntime } from "@/shared/effect-runtime/audio-runtime";

export const configHelpers = Object.assign(
  globalThis.CursorDanceConfigHelpers || {},
  textSemantics,
  actionConfig,
  computeSpecs,
);

export const effectRuntime = Object.assign(
  globalThis.CursorDanceEffectRuntime || {},
  {
    decideActionExecution,
    createAudioRuntime,
    createDoubleClickDetector,
    createEffectLifecycle,
    createEffectGroupRegistry,
    createLongPressTracker,
    createTimedOverride,
    getActionTimingMs,
    getComboWindowMs,
  },
);

globalThis.CursorDanceConfigHelpers = configHelpers;
globalThis.CursorDanceEffectRuntime = effectRuntime;
