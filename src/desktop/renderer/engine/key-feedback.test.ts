import { describe, it, expect, beforeEach } from "vitest";
import { createKeyFeedback } from "./key-feedback";
import {
  defaultKeyFeedbackConfig,
  type KeyFeedbackConfig,
} from "@/shared/config/key-feedback";
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
      // 用闭包捕获的数组而非 this：对象字面量方法里的 this 未被 noImplicitThis 约束，会退化为 any。
      const finishHandlers: Array<() => void> = [];
      const cancelHandlers: Array<() => void> = [];
      const anim: FakeAnimation = {
        finishHandlers,
        cancelHandlers,
        keyframes,
        options,
        addEventListener(type, cb) {
          if (type === "finish") finishHandlers.push(cb);
          else cancelHandlers.push(cb);
        },
        finish() {
          finishHandlers.forEach((fn) => fn());
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

describe("key-feedback: native auto repeat", () => {
  it("renders held keys without advancing the typing combo", () => {
    const { deps, root } = makeFakeDeps({ cooldownMs: 0, typingCombo: true, comboScale: true });
    const mod = createKeyFeedback(deps);
    nowSpy = 1000;
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    mod.handleKeyboardEvent({ ...makeKeyEvent(KEY_A), type: "keyup" });
    nowSpy = 1080;
    mod.handleKeyboardEvent(makeKeyEvent(KEY_K));
    mod.handleKeyboardEvent({ ...makeKeyEvent(KEY_K), type: "keyup" });
    nowSpy = 1160;
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    nowSpy = 1200;
    mod.handleKeyboardEvent({ ...makeKeyEvent(KEY_A), repeat: true });

    const fontSize = (index: number) => /font-size:([\d.]+)px/.exec(root.appended[index].style.cssText)?.[1];
    expect(fontSize(3)).toBe(fontSize(2));
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

// ────────────────────────────────────────────────────────────────
// 缓动过冲：把选中的曲线放在动画级会让字符整段不可见
//
// 「弹跳」是 cubic-bezier(0.34, 1.56, 0.64, 1)，输出会超过 1。作为动画级
// timing function 时，时间轴进度会在中途冲过末帧，而末帧 opacity 是 0——
// 于是过冲窗口里字符看不见。修法：动画级 linear，曲线挪到入场段 keyframe。
// 下面的采样器刻意把动画级 easing 也算进去，所以这条断言能真正区分修没修。
// ────────────────────────────────────────────────────────────────

/** 解 cubic-bezier(x1,y1,x2,y2) 在输入 u 处的输出；二分足够精确。 */
function easingOutput(easing: string, u: number): number {
  if (easing === "linear") return u;
  const match = /cubic-bezier\(([^)]+)\)/.exec(easing);
  if (!match) return u;
  const [x1, y1, x2, y2] = match[1].split(",").map((part) => Number(part.trim()));
  const axis = (a: number, b: number, t: number) =>
    3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 60; i += 1) {
    const mid = (low + high) / 2;
    if (axis(x1, x2, mid) < u) low = mid;
    else high = mid;
  }
  return axis(y1, y2, (low + high) / 2);
}

/** 在整段时长上采样，返回 opacity ≥ 阈值的时间占比。 */
function visibleFraction(keyframes: Keyframe[], animationEasing: string, target: number): number {
  // Web Animations 里只有**声明了** opacity 的 keyframe 参与该属性的插值。
  const stops = keyframes
    .map((frame, index) => ({
      offset: typeof frame.offset === "number" ? frame.offset : index / (keyframes.length - 1),
      opacity: frame.opacity,
      easing: typeof frame.easing === "string" ? frame.easing : "linear",
    }))
    .filter((stop): stop is { offset: number; opacity: number; easing: string } =>
      typeof stop.opacity === "number");

  const threshold = target * 0.5;
  const SAMPLES = 400;
  let visible = 0;

  for (let i = 0; i <= SAMPLES; i += 1) {
    const u = i / SAMPLES;
    const progress = easingOutput(animationEasing, u);
    let opacity: number;
    if (progress <= stops[0].offset) opacity = stops[0].opacity;
    else if (progress >= stops[stops.length - 1].offset) opacity = stops[stops.length - 1].opacity;
    else {
      const nextIndex = stops.findIndex((stop) => stop.offset >= progress);
      const from = stops[nextIndex - 1];
      const to = stops[nextIndex];
      const local = (progress - from.offset) / (to.offset - from.offset);
      opacity = from.opacity + (to.opacity - from.opacity) * easingOutput(from.easing, local);
    }
    if (opacity >= threshold) visible += 1;
  }

  return visible / (SAMPLES + 1);
}

describe("key-feedback: 缓动只作用于入场段", () => {
  const OVERSHOOT = "cubic-bezier(0.34, 1.56, 0.64, 1)";

  it("keeps the animation-level easing linear so keyframe offsets equal real time", () => {
    const { deps, root } = makeFakeDeps({ easing: "弹跳" });
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    expect(root.appended[0].animations[0].options.easing).toBe("linear");
  });

  it("moves the selected curve onto the entrance keyframe for both styles", () => {
    for (const animationStyle of ["bounce", "raindrop"] as const) {
      const { deps, root } = makeFakeDeps({ easing: "弹跳", animationStyle });
      const mod = createKeyFeedback(deps);
      mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
      expect(root.appended[0].animations[0].keyframes[0].easing).toBe(OVERSHOOT);
    }
  });

  it("leaves the character visible for most of the duration under an overshoot curve", () => {
    const { deps, root, config } = makeFakeDeps({ easing: "弹跳", animationStyle: "bounce" });
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    const animation = root.appended[0].animations[0];
    const fraction = visibleFraction(
      animation.keyframes,
      String(animation.options.easing),
      config.opacity / 100,
    );
    expect(fraction).toBeGreaterThan(0.8);
  });

  it("regression guard: the same keyframes go mostly invisible if the curve returns to the animation level", () => {
    // 这条不测产品代码，只锁住「采样器确实能识别这个缺陷」——
    // 否则上一条断言可能因为采样器写错而永远为真。
    const { deps, root, config } = makeFakeDeps({ easing: "弹跳", animationStyle: "bounce" });
    const mod = createKeyFeedback(deps);
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    const fraction = visibleFraction(
      root.appended[0].animations[0].keyframes,
      OVERSHOOT,
      config.opacity / 100,
    );
    expect(fraction).toBeLessThan(0.7);
  });
});

describe("key-feedback: 横向入场的 keyboardLayout 映射", () => {
  // keyLayoutNormalizedX 是横向位置映射，对纵轴没有语义。横向入场时它必须
  // 回落到 center 行为，否则 globalOffsetY 被静默忽略、控件点了没反应。
  for (const originEdge of ["left", "right"] as const) {
    it(`${originEdge} entry: keyboardLayout falls back to center and honors globalOffsetY`, () => {
      const shared = { animationStyle: "raindrop", originEdge, globalOffsetY: 0.25 } as const;

      const layout = makeFakeDeps({ ...shared, originMapping: "keyboardLayout" });
      createKeyFeedback(layout.deps).handleKeyboardEvent(makeKeyEvent(KEY_A));

      const center = makeFakeDeps({ ...shared, originMapping: "center" });
      createKeyFeedback(center.deps).handleKeyboardEvent(makeKeyEvent(KEY_A));

      // 1080 * 0.25 = 270，而不是过去硬编码的 540（屏幕中线）
      expect(layout.root.appended[0].style.cssText).toContain("top:270px");
      expect(layout.root.appended[0].style.cssText).toBe(center.root.appended[0].style.cssText);
    });
  }
});

describe("key-feedback: anchors and advanced presentation", () => {
  it("anchors positions inside the active foreground window bounds", () => {
    const { deps, root } = makeFakeDeps({
      anchor: "window",
      animationStyle: "bounce",
      originEdge: "bottom",
      originMapping: "center",
      globalOffsetX: 0.5,
    });
    deps.getActiveWindowBounds = () => ({ x: 100, y: 200, width: 800, height: 600 });
    createKeyFeedback(deps).handleKeyboardEvent(makeKeyEvent(KEY_A));
    expect(root.appended[0].style.cssText).toContain("left:500px");
    expect(root.appended[0].style.cssText).toContain("top:824px");
  });

  it("falls back to the screen and records why window bounds are unavailable", () => {
    const { deps, root } = makeFakeDeps({ anchor: "window" });
    const events: Array<{ scope: string; payload?: Record<string, unknown> }> = [];
    deps.diagnostics = { isEnabled: () => true, log: (scope, payload) => events.push({ scope, payload }) };
    createKeyFeedback(deps).handleKeyboardEvent(makeKeyEvent(KEY_A));
    expect(root.appended).toHaveLength(1);
    expect(events).toContainEqual({ scope: "keyboard.anchor-fallback", payload: { requested: "window", reason: "window-bounds-unavailable" } });
  });

  it("falls back explicitly while caret geometry is not available", () => {
    const { deps } = makeFakeDeps({ anchor: "caret" });
    const events: Array<{ scope: string; payload?: Record<string, unknown> }> = [];
    deps.diagnostics = { isEnabled: () => true, log: (scope, payload) => events.push({ scope, payload }) };
    createKeyFeedback(deps).handleKeyboardEvent(makeKeyEvent(KEY_A));
    expect(events).toContainEqual({ scope: "keyboard.anchor-fallback", payload: { requested: "caret", reason: "caret-unavailable" } });
  });

  it("queues typewriter characters and resets the line after a pause", () => {
    const { deps, root } = makeFakeDeps({ originMapping: "typewriter", cooldownMs: 0 });
    const mod = createKeyFeedback(deps);
    nowSpy = 1000;
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    mod.handleKeyboardEvent({ ...makeKeyEvent(KEY_A), type: "keyup" });
    nowSpy = 1100;
    mod.handleKeyboardEvent(makeKeyEvent(KEY_K));
    mod.handleKeyboardEvent({ ...makeKeyEvent(KEY_K), type: "keyup" });
    nowSpy = 2401;
    mod.handleKeyboardEvent(makeKeyEvent(KEY_A));
    const left = (index: number) => Number(/left:([\d.]+)px/.exec(root.appended[index].style.cssText)?.[1]);
    expect(left(1)).toBeGreaterThan(left(0));
    expect(left(2)).toBeCloseTo(left(0));
  });

  it("renders gradient paint with glow through a drop shadow", () => {
    const { deps, root } = makeFakeDeps({ gradient: true, gradientTo: "#F43F5E", glow: true });
    createKeyFeedback(deps).handleKeyboardEvent(makeKeyEvent(KEY_A));
    const style = root.appended[0].style;
    expect(style.backgroundImage).toContain("linear-gradient");
    expect(style.color).toBe("transparent");
    expect(style.filter).toContain("drop-shadow");
  });

  it("creates trail ghosts without consuming the simultaneous effect budget", () => {
    const { deps, root, state } = makeFakeDeps({ trail: true, trailLength: 3 });
    createKeyFeedback(deps).handleKeyboardEvent(makeKeyEvent(KEY_A));
    expect(root.appended).toHaveLength(4);
    expect(root.appended.slice(0, 3).every((element) => element.className.includes("cd-key-feedback-trail"))).toBe(true);
    expect(state.activeKeyEffects).toBe(1);
    expect(state.activeEffects).toBe(1);
  });

  it.each([
    ["shrink", "scale(0.35)"],
    ["rise", "translateY(-"],
    ["blur", "blur("],
  ] as const)("applies the %s exit treatment to the final frame", (exitStyle, marker) => {
    const { deps, root } = makeFakeDeps({ exitStyle });
    createKeyFeedback(deps).handleKeyboardEvent(makeKeyEvent(KEY_A));
    const frames = root.appended[0].animations[0].keyframes;
    const frame = frames[frames.length - 1];
    expect(`${String(frame.transform)} ${String(frame.filter)}`).toContain(marker);
  });
});
