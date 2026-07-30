import type { EffectHandle } from "./contracts";

export type EffectAnimationOptions = number | {
  duration?: number;
  easing?: string;
  delay?: number;
};

export interface EffectLifecycleState {
  activeEffects: number;
}

export const emptyEffectHandle: EffectHandle = Object.freeze({ dispose() {} });

export function combineEffectHandles(handles: readonly EffectHandle[]): EffectHandle {
  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const handle of handles) handle.dispose();
    },
  };
}

export function createEffectGroupRegistry() {
  const groups = new Map<string, EffectHandle>();

  function clear(key?: string): void {
    if (key !== undefined) {
      const group = groups.get(key);
      if (!group) return;
      groups.delete(key);
      group.dispose();
      return;
    }
    const activeGroups = [...groups.values()];
    groups.clear();
    for (const group of activeGroups) group.dispose();
  }

  function replace(key: string, group: EffectHandle): EffectHandle {
    clear(key);
    groups.set(key, group);
    let disposed = false;
    return {
      dispose() {
        if (disposed) return;
        disposed = true;
        if (groups.get(key) !== group) return;
        groups.delete(key);
        group.dispose();
      },
    };
  }

  return { replace, clear };
}

export function createEffectLifecycle(deps: {
  state: EffectLifecycleState;
  getMaxActiveEffects(): number;
  appendNode(node: HTMLElement): void;
}) {
  const activeHandles = new Set<EffectHandle>();

  function animateNode(
    node: HTMLElement,
    keyframes: Keyframe[],
    options: EffectAnimationOptions,
  ): EffectHandle {
    if (deps.state.activeEffects >= deps.getMaxActiveEffects()) return emptyEffectHandle;

    const animationOptions = typeof options === "number"
      ? { duration: options, easing: "ease-out", delay: 0 }
      : {
          duration: options.duration || 0,
          easing: options.easing || "ease-out",
          delay: options.delay || 0,
        };

    let animation: Animation | undefined;
    let cleaned = false;
    let handle: EffectHandle;
    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      node.remove();
      deps.state.activeEffects = Math.max(0, deps.state.activeEffects - 1);
      activeHandles.delete(handle);
    };
    handle = {
      dispose() {
        if (cleaned) return;
        animation?.cancel();
        cleanup();
      },
    };

    deps.state.activeEffects += 1;
    try {
      deps.appendNode(node);
      animation = node.animate(keyframes, {
        duration: animationOptions.duration,
        easing: animationOptions.easing,
        delay: animationOptions.delay,
        fill: "forwards",
      });
      activeHandles.add(handle);
      animation.addEventListener("finish", cleanup, { once: true });
      animation.addEventListener("cancel", cleanup, { once: true });
      return handle;
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  function clear(): void {
    for (const handle of [...activeHandles]) handle.dispose();
  }

  return { animateNode, clear };
}

export function createTimedOverride<T>(deps: {
  timers: {
    setTimeout(callback: () => void, delayMs: number): unknown;
    clearTimeout(timeoutId: unknown): void;
  };
  read(): T;
  write(value: T): void;
}) {
  const activeRestores = new Set<() => void>();
  let baseValue: T;

  function apply(value: T, durationMs: number): EffectHandle {
    if (activeRestores.size === 0) baseValue = deps.read();
    deps.write(value);

    let restored = false;
    let timeoutId: unknown;
    const restore = (): void => {
      if (restored) return;
      restored = true;
      if (timeoutId !== undefined) deps.timers.clearTimeout(timeoutId);
      activeRestores.delete(restore);
      if (activeRestores.size === 0) deps.write(baseValue);
    };
    activeRestores.add(restore);
    timeoutId = deps.timers.setTimeout(restore, durationMs);
    return { dispose: restore };
  }

  function clear(): void {
    for (const restore of [...activeRestores]) restore();
  }

  return { apply, clear };
}
