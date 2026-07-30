import {
  createVisualEffects,
  type VisualEffectsDeps,
  type VisualEffectsModule,
} from "@/shared/effect-runtime/dom-effect-surface";

interface ContentModuleRegistry {
  createVisualEffects?: (runtime: VisualEffectsDeps) => VisualEffectsModule;
  [key: string]: unknown;
}

const runtimeGlobal = globalThis as typeof globalThis & {
  CursorDanceContentModules?: ContentModuleRegistry;
};

export const contentVisualEffectsFactory = createVisualEffects;

runtimeGlobal.CursorDanceContentModules ||= {};
runtimeGlobal.CursorDanceContentModules.createVisualEffects = contentVisualEffectsFactory;
