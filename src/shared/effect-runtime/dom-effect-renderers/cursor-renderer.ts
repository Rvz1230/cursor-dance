import type { EffectHandle } from "../contracts";
import { emptyEffectHandle } from "../effect-lifecycle";
import type {
  AnimateEffectNode,
  TimedOverride,
  VisualEffectsConfigStore,
} from "./types";

export function createCursorEffectRenderer(deps: {
  document: Document;
  configStore: VisualEffectsConfigStore;
  animateNode: AnimateEffectNode;
  pointerOverride: TimedOverride;
}) {
  const { document, configStore, animateNode, pointerOverride } = deps;

  function getCursorOverrideKind(cursorOverride: unknown): "boost" | "press" | "woodfish" | "pointer" | null {
    if (cursorOverride === "木鱼（增强态）") return "boost";
    if (cursorOverride === "木鱼（按压态）") return "press";
    if (cursorOverride === "木鱼（继承默认）") return "woodfish";
    if (cursorOverride === "切换到 pointer") return "pointer";
    return null;
  }

  function hasCursorOverride(actionConfig: Record<string, unknown>): boolean {
    const cursorFeedbackConfig = configStore.getActionCursorFeedbackConfig(actionConfig);
    return Boolean(getCursorOverrideKind(cursorFeedbackConfig.cursorOverride));
  }

  function renderCursorOverride(x: number, y: number, actionConfig: Record<string, unknown>): EffectHandle {
    const cursorFeedbackConfig = configStore.getActionCursorFeedbackConfig(actionConfig);
    const cursorKind = getCursorOverrideKind(cursorFeedbackConfig.cursorOverride);
    if (!cursorKind) return emptyEffectHandle;

    if (cursorKind === "pointer") {
      return pointerOverride.apply("pointer", 360);
    }

    const node = document.createElement("div");
    node.className = "cd-effect cd-cursor";
    const size = (cursorFeedbackConfig.cursorSize as number) || 48;
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;

    if (cursorKind === "boost") {
      node.style.background = "radial-gradient(circle at 35% 35%, rgba(253,224,71,0.95), rgba(180,83,9,0.94))";
      node.textContent = "击";
    } else if (cursorKind === "press") {
      node.style.background = "radial-gradient(circle at 35% 35%, rgba(251,191,36,0.92), rgba(146,64,14,0.96))";
      node.textContent = "压";
      node.style.borderRadius = "38% 38% 58% 58% / 42% 42% 56% 56%";
    } else {
      node.style.background = "radial-gradient(circle at 35% 35%, rgba(252,211,77,0.94), rgba(180,83,9,0.92))";
      node.textContent = "咚";
    }

    const shake = Math.max(0, (cursorFeedbackConfig.shake as number) || 0) / 100;
    const driftX = (shake * 18) || 4;
    const driftY = Math.max(8, shake * 26);
    return animateNode(
      node,
      [
        { opacity: 0, transform: "translate3d(-50%, -50%, 0) scale(0.86)" },
        { opacity: 1, transform: `translate3d(calc(-50% + ${driftX * 0.18}px), calc(-50% + ${driftY * 0.08}px), 0) scale(1)` },
        { opacity: 0, transform: `translate3d(calc(-50% + ${driftX}px), calc(-50% + ${driftY}px), 0) scale(0.9)` },
      ],
      { duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }

  return { renderCursorOverride, hasCursorOverride };
}
