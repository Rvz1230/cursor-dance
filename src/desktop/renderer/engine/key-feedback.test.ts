import { describe, it, expect, beforeEach } from "vitest";
import { createKeyFeedback } from "./key-feedback";
import {
  defaultKeyFeedbackConfig,
  type KeyFeedbackConfig,
} from "./key-feedback-types";
import type { EngineDeps, EngineState, NativeKeyboardEvent } from "./types";

// uiohook UiohookKey 数值，与 key-layout-map.ts 内联的 K 对象保持一致
const KEY_A = 30;
const KEY_K = 37;
const KEY_SHIFT = 42;
const KEY_ENTER = 28;
const KEY_DELETE = 3667;
const KEY_F1 = 59;
const KEY_F13 = 91;
const KEY_DIGIT_1 = 2;
const KEY_SLASH = 53;
const KEY_FN_UNMAPPED = 99999;

interface FakeAnimation {
  finishHandlers: Array<() => void>;
  cancelHandlers: Array<() => void>;
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
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
    animate(keyframes, options) {
      const anim: FakeAnimation = {
        finishHandlers: [],
        cancelHandlers: [],
        keyframes,
        options,
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
    expect(el.textContent).toBe("a");
  });

  it("uppercase=false renders typed lowercase letters", () => {
    const { deps, root } = makeFakeDeps({ uppercase: false });
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    expect(root.appended[0].textContent).toBe("a");
  });

  it("makes bounce visible near the screen edge before the overshoot", () => {
    const { deps, root } = makeFakeDeps({ animationStyle: "bounce" });
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    const keyframes = root.appended[0].animations[0].keyframes;
    expect(keyframes[1].offset).toBe(0.12);
    expect(keyframes[1].opacity).toBe(defaultKeyFeedbackConfig.opacity / 100);
    expect(String(keyframes[1].transform)).toContain("scale(0.82)");
  });

  it("raindrop respects configured origin edge and keyboard layout mapping", () => {
    const { deps, root } = makeFakeDeps({
      animationStyle: "raindrop",
      originEdge: "bottom",
      originMapping: "keyboardLayout",
    });
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    const style = root.appended[0].style.cssText;
    expect(style).toContain("left:192px");
    expect(style).toContain("top:1104px");
  });

  it("raindrop applies wind perpendicular to horizontal entry", () => {
    const { deps, root } = makeFakeDeps({
      animationStyle: "raindrop",
      originEdge: "left",
      originMapping: "center",
      wind: 1,
      gravity: 0,
    });
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    const keyframes = root.appended[0].animations[0].keyframes;
    const finalFrame = keyframes[keyframes.length - 1];
    expect(String(finalFrame?.transform)).toContain("324px)");
  });

  it("renders typed characters for Shift-modified symbol keys", () => {
    const { deps, root } = makeFakeDeps({ cooldownMs: 0 });
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent({ ...makeKeyEvent(KEY_DIGIT_1), shiftKey: true });
    mod.handleKeyboardEvent({ ...makeKeyEvent(KEY_SLASH), shiftKey: true });
    expect(root.appended[0].textContent).toBe("!");
    expect(root.appended[1].textContent).toBe("?");
  });

  it("renders typed lowercase letters by default", () => {
    const { deps, root } = makeFakeDeps();
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    expect(root.appended[0].textContent).toBe("a");
  });

  it("renders typed uppercase letters when Shift is held", () => {
    const { deps, root } = makeFakeDeps();
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent({ ...makeKeyEvent(KEY_A), shiftKey: true });
    expect(root.appended[0].textContent).toBe("A");
  });

  it("renders physical letter labels as uppercase", () => {
    const { deps, root } = makeFakeDeps({ keyDisplayMode: "physical" });
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    expect(root.appended[0].textContent).toBe("A");
  });

  it("renders shortcut chords when Command / Control / Option are held", () => {
    const { deps, root } = makeFakeDeps({ semanticStyles: false });
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent({ ...makeKeyEvent(KEY_K), metaKey: true });
    expect(root.appended[0].textContent).toBe("⌘K");
  });

  it("renders standalone modifier keys when enabled", () => {
    const { deps, root } = makeFakeDeps({ showModifierKeys: true });
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent(makeKeyEvent(KEY_SHIFT));
    expect(root.appended[0].textContent).toBe("⇧");
  });

  it("skips standalone modifier keys when disabled", () => {
    const { deps, root } = makeFakeDeps({ showModifierKeys: false });
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent(makeKeyEvent(KEY_SHIFT));
    expect(root.appended.length).toBe(0);
  });

  it("semantic styles make shortcuts centered and shorter", () => {
    const { deps, root } = makeFakeDeps({
      duration: 1000,
      semanticStyles: true,
      originEdge: "left",
      globalOffsetY: 0.08,
    });
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent({ ...makeKeyEvent(KEY_K), metaKey: true });
    expect(root.appended[0].style.cssText).toContain("top:540px");
    expect(root.appended[0].animations[0].options.duration).toBe(720);
  });

  it("semantic styles make standalone modifiers lighter", () => {
    const { deps, root } = makeFakeDeps({ fontSize: 50, opacity: 90, duration: 1000, semanticStyles: true });
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent(makeKeyEvent(KEY_SHIFT));
    expect(root.appended[0].style.cssText).toContain("font-size:36px");
    expect(root.appended[0].style.cssText).toContain("rgba(245, 158, 11, 0.65)");
    expect(root.appended[0].animations[0].options.duration).toBe(550);
  });

  it("typing combo resets when interrupted by a non-character key", () => {
    const { deps, root } = makeFakeDeps({ cooldownMs: 0, typingCombo: true, semanticStyles: false });
    const mod = createKeyFeedback(deps);
    nowSpy = 1000;
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    nowSpy = 1100;
    mod.handleKeyboardEvent(makeKeyEvent(KEY_ENTER));
    nowSpy = 1200;
    mod.handleKeyboardEvent(makeKeyEvent(KEY_K));
    expect(root.appended[2].style.cssText).toContain("font-size:48px");
  });

  it("function keys use special-key semantic styling instead of typing combo", () => {
    const { deps, root } = makeFakeDeps({ duration: 1000, semanticStyles: true, typingCombo: true, cooldownMs: 0 });
    const mod = createKeyFeedback(deps);
    nowSpy = 1000;
    mod.handleKeyboardEvent(makeKeyEvent(KEY_F1));
    nowSpy = 1100;
    mod.handleKeyboardEvent(makeKeyEvent(KEY_F1));
    expect(root.appended[0].textContent).toBe("F1");
    expect(root.appended[1].style.cssText).toContain("font-size:51.84px");
    expect(root.appended[1].animations[0].options.duration).toBe(820);
    expect(root.appended[1].style.textShadow ?? "").toBe("");
  });

  it("extended function key codes render function key labels", () => {
    const { deps, root } = makeFakeDeps();
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent(makeKeyEvent(KEY_F13));
    expect(root.appended[0].textContent).toBe("F13");
  });

  it("renders navigation keys that are classified as special", () => {
    const { deps, root } = makeFakeDeps();
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent(makeKeyEvent(KEY_DELETE));
    expect(root.appended[0].textContent).toBe("Del");
  });
});
