import {
  computeOrbitalParticleSpecs,
  computeParticleSpecs,
  getParticleShapeStyle,
  getParticleTint,
} from "@/shared/effect-core/compute-specs";
import type { EffectHandle } from "../contracts";
import { combineEffectHandles, emptyEffectHandle } from "../effect-lifecycle";
import type {
  AnimateEffectNode,
  EffectGroupRegistry,
  VisualEffectsConfigStore,
} from "./types";

export function createParticleEffectRenderers(deps: {
  document: Document;
  configStore: VisualEffectsConfigStore;
  animateNode: AnimateEffectNode;
  ensureRoot(): HTMLElement;
  orbitalGroups: EffectGroupRegistry;
}) {
  const { document, configStore, animateNode, ensureRoot, orbitalGroups } = deps;

  function renderParticles(x: number, y: number, actionConfig: Record<string, unknown>, runIndex: number): EffectHandle {
    const particleConfig = configStore.getActionParticleConfig(actionConfig);
    if (!particleConfig.particle) return emptyEffectHandle;

    const count = Math.min((particleConfig.particleCount as number) || 0, 40);
    if (!count) return emptyEffectHandle;

    const hasTrail = particleConfig.particleTrail;

    const specs = computeParticleSpecs(actionConfig, runIndex);
    if (!specs || !specs.length) return emptyEffectHandle;

    const handles: EffectHandle[] = [];
    for (let index = 0; index < specs.length; index++) {
      const spec = specs[index];
      let rotation = 0;
      const shapeStyle = getParticleShapeStyle(actionConfig, index, spec.size);
      if (shapeStyle) rotation = shapeStyle.rotation || 0;

      const node = document.createElement("span");
      node.className = "cd-effect cd-particle";
      node.style.left = x + "px";
      node.style.top = y + "px";
      node.style.background = getParticleTint(actionConfig, index);
      if (shapeStyle) {
        node.style.width = shapeStyle.width + "px";
        node.style.height = shapeStyle.height + "px";
        node.style.borderRadius = shapeStyle.borderRadius || "";
        if (shapeStyle.clipPath) node.style.clipPath = shapeStyle.clipPath;
        if (shapeStyle.boxShadow) node.style.boxShadow = shapeStyle.boxShadow;
      }

      const particleStyle = (particleConfig.particleStyle as string) || "点状粒子";
      const midTransform = "translate3d(calc(-50% + " + spec.midX + "px), calc(-50% + " + spec.midY + "px), 0) rotate(" + rotation + "deg)";
      const endTransform = "translate3d(calc(-50% + " + spec.x + "px), calc(-50% + " + spec.y + "px), 0) rotate(" + rotation + "deg)";

      handles.push(animateNode(
        node,
        [
          { opacity: 0, transform: "translate3d(-50%, -50%, 0) rotate(" + rotation + "deg) scale(0.5)" },
          { opacity: 0.9, transform: midTransform + " scale(1)" },
          { opacity: 0, transform: endTransform + " scale(" + spec.endScale + ")" },
        ],
        {
          duration: (particleConfig.particleDuration as number) || 760,
          easing: particleStyle === "火花" || particleStyle === "星光"
            ? "cubic-bezier(0.22, 1, 0.36, 1)"
            : particleStyle === "碎屑粒子"
              ? "cubic-bezier(0.34, 1.56, 0.64, 1)"
              : "ease-out",
          delay: spec.delay,
        },
      ));

      if (hasTrail && index % 3 === 0) {
        for (let t = 1; t <= 2; t++) {
          const trailNode = document.createElement("span");
          trailNode.className = "cd-effect cd-particle";
          trailNode.style.left = x + "px";
          trailNode.style.top = y + "px";
          trailNode.style.background = getParticleTint(actionConfig, index + t);
          const trailSize = spec.size * (1 - t * 0.32);
          const trailShapeStyle = getParticleShapeStyle(actionConfig, index + t, trailSize);
          if (trailShapeStyle) {
            trailNode.style.width = trailShapeStyle.width + "px";
            trailNode.style.height = trailShapeStyle.height + "px";
            trailNode.style.borderRadius = trailShapeStyle.borderRadius || "";
            if (trailShapeStyle.clipPath) trailNode.style.clipPath = trailShapeStyle.clipPath;
            if (trailShapeStyle.boxShadow) trailNode.style.boxShadow = trailShapeStyle.boxShadow;
          }
          const trailTx = spec.x * 0.24;
          const trailTy = spec.y * 0.24;
          const trailTxEnd = spec.x * 0.6;
          const trailTyEnd = spec.y * 0.6;
          trailNode.style.opacity = String(Math.max(0.12, 0.4 - t * 0.14));
          handles.push(animateNode(
            trailNode,
            [
              { opacity: 0, transform: "translate3d(-50%, -50%, 0) rotate(" + rotation + "deg) scale(0.5)" },
              { opacity: Math.max(0.12, 0.4 - t * 0.14), transform: "translate3d(calc(-50% + " + trailTx + "px), calc(-50% + " + trailTy + "px), 0) rotate(" + rotation + "deg) scale(0.68)" },
              { opacity: 0, transform: "translate3d(calc(-50% + " + trailTxEnd + "px), calc(-50% + " + trailTyEnd + "px), 0) rotate(" + rotation + "deg) scale(0.44)" },
            ],
            { duration: ((particleConfig.particleDuration as number) || 760) * 0.8, easing: "ease-out", delay: spec.delay + t * 40 },
          ));
        }
      }
    }
    return combineEffectHandles(handles);
  }

  function renderOrbitalParticles(
    x: number,
    y: number,
    actionConfig: Record<string, unknown>,
    runIndex: number,
    actionId?: string,
  ): EffectHandle {
    void runIndex; // 原 JS 形参不在轨道粒子算法中使用，保留签名一致
    const particleConfig = configStore.getActionParticleConfig(actionConfig);
    if (!particleConfig.particle) return emptyEffectHandle;

    const orbitalDuration = Math.max(0, ((particleConfig.particleDuration as number) || 760));
    const fadeInDuration = Math.min(400, ((particleConfig.particleDuration as number) || 760) * 0.3);

    const specs = computeOrbitalParticleSpecs(actionConfig);
    if (!specs || !specs.length) return emptyEffectHandle;

    const root = ensureRoot();
    const dots: HTMLElement[] = [];

    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      const dot = document.createElement("span");
      dot.className = "cd-effect cd-particle";
      dot.style.left = x + "px";
      dot.style.top = y + "px";
      dot.style.background = getParticleTint(actionConfig, i);

      const shapeStyle = getParticleShapeStyle(actionConfig, i, spec.size);
      if (shapeStyle) {
        dot.style.width = shapeStyle.width + "px";
        dot.style.height = shapeStyle.height + "px";
        dot.style.borderRadius = shapeStyle.borderRadius || "";
        if (shapeStyle.clipPath) dot.style.clipPath = shapeStyle.clipPath;
        if (shapeStyle.boxShadow) dot.style.boxShadow = shapeStyle.boxShadow;
      }

      const oscFrames: Keyframe[] = [
        { transform: "translate3d(calc(-50% + " + spec.sx + "px), calc(-50% + " + spec.sy + "px), 0) scale(0.6)", opacity: 0.5, offset: 0 },
        { transform: "translate3d(calc(-50% + " + spec.ex + "px), calc(-50% + " + spec.ey + "px), 0) scale(1.2)", opacity: 0.15, offset: 0.5 },
        { transform: "translate3d(calc(-50% + " + spec.sx + "px), calc(-50% + " + spec.sy + "px), 0) scale(0.6)", opacity: 0.5, offset: 1 },
      ];

      const iterations = orbitalDuration > 0 ? Math.ceil(orbitalDuration / (spec.speed * 1000)) : Infinity;
      dot.animate(oscFrames, {
        duration: spec.speed * 1000,
        iterations,
        delay: spec.delay,
        easing: "ease-in-out",
        fill: orbitalDuration > 0 ? "forwards" : "none",
      });

      // fade in (uses particleDuration for smoothness)
      dot.animate(
        [{ opacity: 0 }, { opacity: 0.9 }],
        { duration: fadeInDuration, easing: "ease-out", fill: "forwards" },
      );

      root.append(dot);
      dots.push(dot);
    }

    // store for external cleanup, keyed by actionId for isolation
    const key = actionId || "__unknown__";
    return orbitalGroups.replace(key, combineEffectHandles(dots.map((dot) => ({
      dispose() {
        for (const animation of dot.getAnimations()) animation.cancel();
        dot.remove();
      },
    }))));
  }

  function clearOrbitalParticles(actionId?: string): void {
    orbitalGroups.clear(actionId);
  }

  return { renderParticles, renderOrbitalParticles, clearOrbitalParticles };
}
