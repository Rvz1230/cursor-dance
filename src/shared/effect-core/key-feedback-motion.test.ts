import { describe, expect, it } from "vitest";
import { defaultKeyFeedbackConfig } from "../config/key-feedback";
import { buildKeyFeedbackKeyframes, resolveKeyFeedbackMotion, resolveKeyFeedbackRestPoint } from "./key-feedback-motion";

const bounds = { x: 100, y: 80, width: 800, height: 600 };
const viewport = { width: 1200, height: 800 };

describe("key feedback motion", () => {
  it("uses both rest distance and normalized offset for bottom bounce", () => {
    const config = { ...defaultKeyFeedbackConfig, originMapping: "center" as const, globalOffsetX: 0.25, globalOffsetY: 0.2, bounceHeight: 100 };
    const motion = resolveKeyFeedbackMotion({ config, bounds, viewport, fontSize: 40, layoutX: 0.5 });
    expect(motion.startX).toBe(300);
    expect(motion.startY).toBe(700);
    expect(resolveKeyFeedbackRestPoint(motion, "bounce")).toEqual({ x: 300, y: 460 });
  });

  it("turns caret anchors into an upward effect from a zero-size point", () => {
    const config = { ...defaultKeyFeedbackConfig, anchor: "caret" as const, originEdge: "top" as const };
    const motion = resolveKeyFeedbackMotion({ config, bounds: { x: 400, y: 300, width: 0, height: 0 }, viewport, fontSize: 30, layoutX: 0.5, jitter: 20 });
    expect(motion.edge).toBe("bottom");
    expect(motion.startX).toBe(400);
    expect(motion.dx).toBe(0);
  });

  it("applies gravity, wind and exit treatment to shared keyframes", () => {
    const config = { ...defaultKeyFeedbackConfig, animationStyle: "raindrop" as const, wind: 1, gravity: 1, exitStyle: "blur" as const };
    const motion = resolveKeyFeedbackMotion({ config, bounds, viewport, fontSize: 40, layoutX: 0.5 });
    const frames = buildKeyFeedbackKeyframes({ config, motion, viewport, fontSize: 40, entranceEasing: "linear", persistentFilter: "drop-shadow(0 0 4px red)" });
    const final = frames[frames.length - 1];
    expect(String(final.transform)).toContain("360px");
    expect(String(final.filter)).toContain("blur(6.4px) drop-shadow");
  });
});
