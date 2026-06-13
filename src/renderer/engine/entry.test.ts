import { describe, it, expect } from "vitest";
import { createEffectEngine } from "./entry";
import type { EngineDeps } from "./types";

// 任务 2.1：visualEffects 已落地为真实模块。其余子模块仍是占位 {}。
// 这里只验证骨架装配 —— 不触发任何 DOM API（vitest 默认 node 环境，没有 document.createElement 实现）。
function makeStubDeps(): EngineDeps {
  const fakeDocument = {} as Document;
  const fakeWindow = {} as Window;
  return {
    window: fakeWindow,
    document: fakeDocument,
    constants: { ROOT_ID: "x", STYLE_ID: "y", HIDE_CURSOR_CLASS: "z" },
    state: { activeEffects: 0 },
    configStore: {
      getActionTextConfig: () => ({}),
      getActionRippleConfig: () => ({}),
      getActionParticleConfig: () => ({}),
      getActionAnimationConfig: () => ({}),
      getActionImageConfig: () => ({}),
      getActionCursorFeedbackConfig: () => ({}),
      getMaxActiveEffects: () => 0,
    },
  };
}

describe("createEffectEngine (skeleton)", () => {
  it("wires up visualEffects + remaining placeholders", () => {
    const engine = createEffectEngine(makeStubDeps());
    // visualEffects 暴露 10 个方法（renderText/renderRipple/... 见 VisualEffectsModule）
    expect(typeof engine.visualEffects.ensureRoot).toBe("function");
    expect(typeof engine.visualEffects.renderText).toBe("function");
    expect(typeof engine.visualEffects.clearOrbitalParticles).toBe("function");
    // 2.2–2.4 的子模块尚未迁移
    expect(engine.cursorOverlay).toEqual({});
    expect(engine.audioRuntime).toEqual({});
    expect(engine.triggerHandlers).toEqual({});
  });
});
