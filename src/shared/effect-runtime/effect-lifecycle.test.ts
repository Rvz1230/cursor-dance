import { describe, expect, it, vi } from "vitest";
import {
  combineEffectHandles,
  createEffectGroupRegistry,
  createEffectLifecycle,
  createTimedOverride,
  emptyEffectHandle,
} from "./effect-lifecycle";

function createAnimationHarness(maxActiveEffects = 2) {
  const listeners = new Map<string, () => void>();
  const animation = {
    addEventListener: vi.fn((type: string, callback: () => void) => listeners.set(type, callback)),
    cancel: vi.fn(() => listeners.get("cancel")?.()),
  } as unknown as Animation;
  const node = {
    animate: vi.fn(() => animation),
    remove: vi.fn(),
  } as unknown as HTMLElement;
  const state = { activeEffects: 0 };
  const appendNode = vi.fn();
  const lifecycle = createEffectLifecycle({
    state,
    appendNode,
    getMaxActiveEffects: () => maxActiveEffects,
  });
  return { animation, appendNode, lifecycle, listeners, node, state };
}

describe("shared effect lifecycle", () => {
  it("tracks an animated node and cleans it exactly once", () => {
    const { animation, lifecycle, listeners, node, state } = createAnimationHarness();
    const handle = lifecycle.animateNode(node, [], 240);

    expect(state.activeEffects).toBe(1);
    listeners.get("finish")?.();
    handle.dispose();

    expect(node.remove).toHaveBeenCalledOnce();
    expect(animation.cancel).not.toHaveBeenCalled();
    expect(state.activeEffects).toBe(0);
  });

  it("returns an empty handle without appending when the budget is exhausted", () => {
    const { appendNode, lifecycle, node, state } = createAnimationHarness(0);

    expect(lifecycle.animateNode(node, [], 100)).toBe(emptyEffectHandle);
    expect(appendNode).not.toHaveBeenCalled();
    expect(state.activeEffects).toBe(0);
  });

  it("clears every active animation handle", () => {
    const first = createAnimationHarness();
    const secondNode = {
      animate: vi.fn(() => ({
        addEventListener: vi.fn(),
        cancel: vi.fn(),
      })),
      remove: vi.fn(),
    } as unknown as HTMLElement;
    first.lifecycle.animateNode(first.node, [], 100);
    first.lifecycle.animateNode(secondNode, [], 100);

    first.lifecycle.clear();

    expect(first.node.remove).toHaveBeenCalledOnce();
    expect(secondNode.remove).toHaveBeenCalledOnce();
    expect(first.state.activeEffects).toBe(0);
  });

  it("combines handles with idempotent disposal", () => {
    const first = { dispose: vi.fn() };
    const second = { dispose: vi.fn() };
    const combined = combineEffectHandles([first, second]);

    combined.dispose();
    combined.dispose();

    expect(first.dispose).toHaveBeenCalledOnce();
    expect(second.dispose).toHaveBeenCalledOnce();
  });

  it("replaces keyed groups without letting a stale handle clear the new group", () => {
    const registry = createEffectGroupRegistry();
    const first = { dispose: vi.fn() };
    const second = { dispose: vi.fn() };
    const staleHandle = registry.replace("leftClick", first);
    registry.replace("leftClick", second);

    staleHandle.dispose();
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(second.dispose).not.toHaveBeenCalled();

    registry.clear("leftClick");
    expect(second.dispose).toHaveBeenCalledOnce();
  });

  it("restores an overlapping timed override only after the last handle ends", () => {
    let current = "crosshair";
    const callbacks: Array<() => void> = [];
    const override = createTimedOverride({
      timers: {
        setTimeout(callback) { callbacks.push(callback); return callbacks.length; },
        clearTimeout: vi.fn(),
      },
      read: () => current,
      write: (value) => { current = value; },
    });

    override.apply("pointer", 360);
    override.apply("pointer", 360);
    callbacks[0]?.();
    expect(current).toBe("pointer");
    callbacks[1]?.();
    expect(current).toBe("crosshair");
  });
});
