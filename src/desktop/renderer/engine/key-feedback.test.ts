import { describe, it, expect, beforeEach } from "vitest";
import { createKeyFeedback } from "./key-feedback";
import {
  defaultKeyFeedbackConfig,
  type KeyFeedbackConfig,
} from "./key-feedback-types";
import type { EngineDeps, EngineState, NativeKeyboardEvent } from "./types";

// uiohook UiohookKey 数值，与 key-layout-map.ts 内联的 K 对象保持一致
const KEY_A = 30;
const KEY_SHIFT = 42;
const KEY_FN_UNMAPPED = 99999;

interface FakeAnimation {
  finishHandlers: Array<() => void>;
  cancelHandlers: Array<() => void>;
  addEventListener(type: "finish" | "cancel", cb: () => void, _opts: { once: boolean }): void;
  finish(): void;
}

interface FakeElement {
  className: string;
  textContent: string | null;
  style: Record<string, string> & { cssText: string };
  parentRemoved: boolean;
  animations: FakeAnimation[];
  appended: FakeElement[];
  remove(): void;
  append(child: FakeElement): void;
  animate(_keyframes: Keyframe[], _options: KeyframeAnimationOptions): FakeAnimation;
}

function createFakeElement(): FakeElement {
  const styleProxyTarget = { cssText: "" };
  const style = new Proxy(styleProxyTarget as Record<string, string> & { cssText: string }, {
    set(target, prop, value) {
      target[prop as string] = value as string;
      return true;
    },
  });
  const el: FakeElement = {
    className: "",
    textContent: null,
    style,
    parentRemoved: false,
    animations: [],
    appended: [],
    remove() {
      this.parentRemoved = true;
    },
    append(child) {
      this.appended.push(child);
    },
    animate() {
      const anim: FakeAnimation = {
        finishHandlers: [],
        cancelHandlers: [],
        addEventListener(type, cb) {
          if (type === "finish") this.finishHandlers.push(cb);
          else this.cancelHandlers.push(cb);
        },
        finish() {
          this.finishHandlers.forEach((fn) => fn());
        },
      };
      this.animations.push(anim);
      return anim;
    },
  };
  return el;
}

function makeFakeDeps(overrides?: Partial<KeyFeedbackConfig>): {
  deps: EngineDeps;
  state: EngineState;
  root: FakeElement;
  config: KeyFeedbackConfig;
} {
  const config = { ...defaultKeyFeedbackConfig, ...overrides };
  const root = createFakeElement();

  const fakeDocument = {
    createElement: () => createFakeElement(),
    getElementById: (id: string) => (id === "cursordance-root" ? root : null),
    documentElement: root,
  } as unknown as Document;

  const fakeWindow = {
    innerWidth: 1920,
    innerHeight: 1080,
  } as Window;

  const state: EngineState = { activeEffects: 0 };

  const deps: EngineDeps = {
    window: fakeWindow,
    document: fakeDocument,
    constants: { ROOT_ID: "cursordance-root", STYLE_ID: "s", HIDE_CURSOR_CLASS: "h" },
    state,
    configStore: {
      getActionTextConfig: () => ({}),
      getActionRippleConfig: () => ({}),
      getActionParticleConfig: () => ({}),
      getActionAnimationConfig: () => ({}),
      getActionImageConfig: () => ({}),
      getActionCursorFeedbackConfig: () => ({}),
      getActionAudioConfig: () => ({}),
      getActionTriggerConfig: () => ({}),
      getMaxActiveEffects: () => 48,
      // @ts-expect-error 测试只关心 key-feedback 调用的接口
      getKeyFeedbackConfig: () => config,
    },
    diagnostics: { isEnabled: () => false, log: () => {} },
    reportRuntimeError: () => {},
  };

  return { deps, state, root, config };
}

function makeKeyEvent(keycode: number, timestamp = 1): NativeKeyboardEvent {
  return {
    type: "keydown",
    keycode,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    timestamp,
  };
}

let nowSpy: number = 0;
beforeEach(() => {
  nowSpy = 1000;
  // 替换 Date.now 让冷却测试可控
  Date.now = () => nowSpy;
});

describe("key-feedback: gating", () => {
  it("ignores keyup events", () => {
    const { deps, state, root } = makeFakeDeps();
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent({ ...makeKeyEvent(KEY_A), type: "keyup" });
    expect(root.appended.length).toBe(0);
    expect(state.activeEffects).toBe(0);
  });

  it("does nothing when config.enabled is false", () => {
    const { deps, root } = makeFakeDeps({ enabled: false });
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    expect(root.appended.length).toBe(0);
  });

  it("skips keys with no display character mapping", () => {
    const { deps, root } = makeFakeDeps();
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent(makeKeyEvent(KEY_FN_UNMAPPED));
    expect(root.appended.length).toBe(0);
  });

  it("skips when activeEffects >= maxActiveEffects (global budget)", () => {
    const { deps, state, root } = makeFakeDeps();
    state.activeEffects = 48; // 等于 getMaxActiveEffects()
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    expect(root.appended.length).toBe(0);
  });
});

describe("key-feedback: cooldown", () => {
  it("throttles per-keycode within cooldownMs window", () => {
    const { deps, root } = makeFakeDeps({ cooldownMs: 100 });
    const mod = createKeyFeedback(deps);

    nowSpy = 1000;
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    expect(root.appended.length).toBe(1);

    // 50ms 后再按同键 → 仍在冷却
    nowSpy = 1050;
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    expect(root.appended.length).toBe(1);

    // 101ms 后再按 → 通过
    nowSpy = 1101;
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    expect(root.appended.length).toBe(2);
  });

  it("cooldown is per-keycode, not global", () => {
    const { deps, root } = makeFakeDeps({ cooldownMs: 100 });
    const mod = createKeyFeedback(deps);
    const KEY_B = 48;

    nowSpy = 1000;
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    nowSpy = 1010;
    mod.handleKeyboardEvent(makeKeyEvent(KEY_B)); // 不同键不受 A 的冷却影响
    expect(root.appended.length).toBe(2);
  });
});

describe("key-feedback: maxSimultaneous", () => {
  it("rejects new effect when activeKeyEffects >= maxSimultaneous", () => {
    const { deps, state, root } = makeFakeDeps({ maxSimultaneous: 2, cooldownMs: 0 });
    const mod = createKeyFeedback(deps);
    const KEY_B = 48;
    const KEY_C = 46;

    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    mod.handleKeyboardEvent(makeKeyEvent(KEY_B));
    expect(root.appended.length).toBe(2);
    expect(state.activeKeyEffects).toBe(2);

    mod.handleKeyboardEvent(makeKeyEvent(KEY_C));
    expect(root.appended.length).toBe(2); // 第 3 个被拒
  });

  it("decrements counter on animation finish", () => {
    const { deps, state, root } = makeFakeDeps({ maxSimultaneous: 2, cooldownMs: 0 });
    const mod = createKeyFeedback(deps);

    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    expect(state.activeKeyEffects).toBe(1);
    expect(state.activeEffects).toBe(1);

    // finish 第一个
    root.appended[0].animations[0].finish();
    expect(state.activeKeyEffects).toBe(0);
    expect(state.activeEffects).toBe(0);
    expect(root.appended[0].parentRemoved).toBe(true);
  });
});

describe("key-feedback: rendering", () => {
  it("appends element with cd-key-feedback class and correct character", () => {
    const { deps, root } = makeFakeDeps();
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    expect(root.appended.length).toBe(1);
    const el = root.appended[0];
    expect(el.className).toBe("cd-effect cd-key-feedback");
    expect(el.textContent).toBe("A");
  });

  it("uppercase=false still renders uppercase letters (key map already uppercase)", () => {
    const { deps, root } = makeFakeDeps({ uppercase: false });
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    expect(root.appended[0].textContent).toBe("A");
  });

  it("ignores modifier keys is handled at native-events.ts (not here)", () => {
    // 此模块不抑制 Shift/Ctrl —— 主进程已过滤
    // 但单独 Shift 键在 keyDisplayCharacter 中无映射 → 实际仍 skip
    const { deps, root } = makeFakeDeps();
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent(makeKeyEvent(KEY_SHIFT));
    expect(root.appended.length).toBe(0);
  });
});
