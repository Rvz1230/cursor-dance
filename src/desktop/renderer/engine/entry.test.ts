import { describe, it, expect } from "vitest";
import { createEffectEngine } from "./entry";
import type { EngineDeps } from "./types";
import { defaultKeyFeedbackConfig } from "@/shared/config/key-feedback";

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
      getActionAudioConfig: () => ({}),
      getActionTriggerConfig: () => ({}),
      getMaxActiveEffects: () => 0,
      getKeyFeedbackConfig: () => defaultKeyFeedbackConfig,
    },
    diagnostics: { isEnabled: () => false, log: () => {} },
    reportRuntimeError: () => {},
  };
}

describe("createEffectEngine (skeleton)", () => {
  it("wires up visualEffects + cursorOverlay + audioRuntime + triggerHandlers", () => {
    const engine = createEffectEngine(makeStubDeps());
    // visualEffects 暴露 10 个方法（renderText/renderRipple/... 见 VisualEffectsModule）
    expect(typeof engine.visualEffects.ensureRoot).toBe("function");
    expect(typeof engine.visualEffects.renderText).toBe("function");
    expect(typeof engine.visualEffects.clearOrbitalParticles).toBe("function");
    expect(typeof engine.effectSurface.createNode).toBe("function");
    expect(typeof engine.effectSurface.clear).toBe("function");
    // cursorOverlay 暴露 syncStateCursorOverlay / clearStateCursorOverlay
    expect(typeof engine.cursorOverlay.syncStateCursorOverlay).toBe("function");
    expect(typeof engine.cursorOverlay.clearStateCursorOverlay).toBe("function");
    // audioRuntime 暴露 playSound（duckPageMedia 一族在桌面端被裁剪掉）
    expect(typeof engine.audioRuntime.playSound).toBe("function");
    expect(typeof engine.audioOutput.play).toBe("function");
    // triggerHandlers 暴露 7 个 handler（桌面端裁剪 hover：无 handlePointerOver / handlePointerOut）
    expect(typeof engine.triggerHandlers.handleLeftPointerDown).toBe("function");
    expect(typeof engine.triggerHandlers.handlePointerUp).toBe("function");
    expect(typeof engine.triggerHandlers.handlePointerCancel).toBe("function");
    expect(typeof engine.triggerHandlers.handleRightPointerDown).toBe("function");
    expect(typeof engine.triggerHandlers.handleContextMenu).toBe("function");
    expect(typeof engine.triggerHandlers.handleWheel).toBe("function");
    expect("previewAtViewportCenter" in engine.triggerHandlers).toBe(false);
  });
});
