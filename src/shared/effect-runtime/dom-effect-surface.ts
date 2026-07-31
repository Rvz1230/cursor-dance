// CursorDance shared DOM visual-effect surface.
// Platform adapters inject config and DOM dependencies; specialized renderers
// live under dom-effect-renderers while this module owns lifecycle coordination.

import { buildVisualEffectsCSS } from "./dom-effect-styles";
import type { EffectHandle } from "./contracts";
import {
  createEffectGroupRegistry,
  createEffectLifecycle,
  createTimedOverride,
} from "./effect-lifecycle";
import { createBasicEffectRenderers } from "./dom-effect-renderers/basic-renderers";
import { createCursorEffectRenderer } from "./dom-effect-renderers/cursor-renderer";
import { createParticleEffectRenderers } from "./dom-effect-renderers/particle-renderers";
import type {
  ActionConfig,
  VisualEffectsConfigStore,
} from "./dom-effect-renderers/types";

export interface VisualEffectsDeps {
  window: Window;
  document: Document;
  constants: { ROOT_ID: string; STYLE_ID: string };
  state: { activeEffects: number };
  configStore: VisualEffectsConfigStore;
}

export interface VisualEffectsModule {
  ensureRoot(): HTMLElement;
  renderText(x: number, y: number, config: ActionConfig, actionId: string, runIndex: number): EffectHandle;
  renderRipple(x: number, y: number, config: ActionConfig): EffectHandle;
  renderAnimationEffect(x: number, y: number, config: ActionConfig): EffectHandle;
  renderImageEffect(x: number, y: number, config: ActionConfig): EffectHandle;
  renderParticles(x: number, y: number, config: ActionConfig, runIndex: number): EffectHandle;
  renderOrbitalParticles(x: number, y: number, config: ActionConfig, runIndex: number, actionId?: string): EffectHandle;
  clearOrbitalParticles(actionId?: string): void;
  clearEffects(): void;
  renderCursorOverride(x: number, y: number, config: ActionConfig): EffectHandle;
  hasCursorOverride(config: ActionConfig): boolean;
}

export function createVisualEffects(deps: VisualEffectsDeps): VisualEffectsModule {
  const { window, document, constants, state, configStore } = deps;

  function ensureStyles(): void {
    if (document.getElementById(constants.STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = constants.STYLE_ID;
    style.textContent = buildVisualEffectsCSS(constants.ROOT_ID);
    document.head.append(style);
  }

  function ensureRoot(): HTMLElement {
    let root = document.getElementById(constants.ROOT_ID);
    if (!root) {
      ensureStyles();
      root = document.createElement("div");
      root.id = constants.ROOT_ID;
      document.documentElement.append(root);
    }
    return root;
  }

  const effectLifecycle = createEffectLifecycle({
    state,
    getMaxActiveEffects: () => configStore.getMaxActiveEffects(),
    appendNode: (node) => ensureRoot().append(node),
  });
  const orbitalGroups = createEffectGroupRegistry();
  const pointerOverride = createTimedOverride({
    timers: {
      setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
      clearTimeout: (timeoutId) => window.clearTimeout(timeoutId as number),
    },
    read: () => document.body.style.cursor,
    write: (value) => { document.body.style.cursor = value; },
  });

  const basicRenderers = createBasicEffectRenderers({
    document,
    configStore,
    animateNode: effectLifecycle.animateNode,
  });
  const particleRenderers = createParticleEffectRenderers({
    document,
    configStore,
    animateNode: effectLifecycle.animateNode,
    ensureRoot,
    orbitalGroups,
  });
  const cursorRenderer = createCursorEffectRenderer({
    document,
    configStore,
    animateNode: effectLifecycle.animateNode,
    pointerOverride,
  });

  function clearEffects(): void {
    pointerOverride.clear();
    effectLifecycle.clear();
    particleRenderers.clearOrbitalParticles();
    state.activeEffects = 0;
    const root = document.getElementById(constants.ROOT_ID);
    if (!root) return;
    for (const node of root.querySelectorAll<HTMLElement>(".cd-effect")) {
      for (const animation of node.getAnimations()) animation.cancel();
      node.remove();
    }
  }

  return {
    ensureRoot,
    ...basicRenderers,
    ...particleRenderers,
    clearEffects,
    ...cursorRenderer,
  };
}
