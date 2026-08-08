import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/components/ui/utils";
import type { KeyFeedbackConfig } from "@/shared/config/key-feedback";
import { deriveKeyFeedbackConfig, resolveKeyFeedbackColor, type KeySemanticKind } from "@/shared/effect-core/key-feedback-style";
import { buildKeyFeedbackKeyframes, resolveKeyFeedbackMotion, resolveKeyFeedbackRestPoint } from "@/shared/effect-core/key-feedback-motion";
import { getAnimationEasing } from "@/shared/effect-core/action-config";
import { getPreviewKeyLabel, getPreviewLayoutX, getPreviewSemanticKind, resolvePreviewAnchorBounds } from "./keyboardPreviewModel";

interface PreviewEffect {
  id: number;
  label: string;
  color: string;
  kind: KeySemanticKind;
  config: KeyFeedbackConfig;
  startX: number;
  startY: number;
  fontSize: number;
  frames: Keyframe[];
}

const EDGE_LABELS = { top: "上", bottom: "下", left: "左", right: "右" } as const;
const EDGE_POSITION_CLASSES = {
  top: "keyboard-edge-button--top",
  bottom: "keyboard-edge-button--bottom",
  left: "keyboard-edge-button--left",
  right: "keyboard-edge-button--right",
} as const;
const EDGE_POSITION_STYLES: Record<keyof typeof EDGE_LABELS, CSSProperties> = {
  top: { left: "50%", top: 0, width: "6rem", height: "1.5rem", transform: "translate(-50%, -50%)" },
  bottom: { left: "50%", bottom: 0, width: "6rem", height: "1.5rem", transform: "translate(-50%, 50%)" },
  left: { left: 0, top: "50%", width: "1.75rem", height: "5rem", transform: "translate(-50%, -50%)" },
  right: { right: 0, top: "50%", width: "1.75rem", height: "5rem", transform: "translate(50%, -50%)" },
};
const FONT_WEIGHTS: Record<string, number> = { "特细": 100, "细体": 200, "标准": 400, "中等": 500, "半粗": 600, "加粗": 700, "特粗": 900 };
const SCREEN_REFERENCE_WIDTH = 1440;

function multiplyFrameOpacity(frames: Keyframe[], factor: number): Keyframe[] {
  return frames.map((frame) => ({
    ...frame,
    opacity: typeof frame.opacity === "number" ? frame.opacity * factor : frame.opacity,
  }));
}

function KeyboardEffect({ effect, onFinished }: { effect: PreviewEffect; onFinished: (id: number) => void }) {
  const mainRef = useRef<HTMLSpanElement | null>(null);
  const trailRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const trailCount = effect.config.trail ? Math.min(6, Math.max(1, Math.round(effect.config.trailLength))) : 0;

  useEffect(() => {
    const entries = [
      ...trailRefs.current.slice(0, trailCount).map((node, index) => ({ node, index: trailCount - index, trail: true })),
      { node: mainRef.current, index: 0, trail: false },
    ];
    const animations = entries.flatMap(({ node, index, trail }) => {
      if (!node || typeof node.animate !== "function") return [];
      const factor = trail ? (1 - index / (trailCount + 1)) * 0.7 : 1;
      return [node.animate(trail ? multiplyFrameOpacity(effect.frames, factor) : effect.frames, {
        duration: effect.config.duration,
        delay: effect.config.delay + (trail ? index * Math.max(24, effect.config.duration * 0.035) : 0),
        easing: "linear",
        fill: "forwards",
      })];
    });
    const trailDelay = trailCount * Math.max(24, effect.config.duration * 0.035);
    const cleanupTimer = window.setTimeout(
      () => onFinished(effect.id),
      effect.config.delay + effect.config.duration + trailDelay + 80,
    );
    return () => {
      window.clearTimeout(cleanupTimer);
      animations.forEach((animation) => animation.cancel());
    };
  }, [effect, onFinished, trailCount]);

  const style: CSSProperties = {
    position: "absolute",
    zIndex: 20,
    left: effect.startX,
    top: effect.startY,
    color: effect.config.gradient ? "transparent" : effect.color,
    fontSize: effect.fontSize,
    fontFamily: effect.config.fontFamily === "系统默认" ? undefined : effect.config.fontFamily,
    fontWeight: FONT_WEIGHTS[effect.config.fontWeight] ?? 700,
    lineHeight: 1,
    pointerEvents: "none",
    userSelect: "none",
    willChange: "transform, opacity, filter",
    backgroundImage: effect.config.gradient ? `linear-gradient(180deg, ${effect.color}, ${effect.config.gradientTo})` : undefined,
    backgroundClip: effect.config.gradient ? "text" : undefined,
    WebkitBackgroundClip: effect.config.gradient ? "text" : undefined,
    textShadow: effect.config.glow && !effect.config.gradient ? `0 0 ${effect.config.glowRadius}px ${effect.config.glowColor}` : undefined,
    filter: effect.config.glow && effect.config.gradient ? `drop-shadow(0 0 ${effect.config.glowRadius}px ${effect.config.glowColor})` : undefined,
  };

  return (
    <>
      {Array.from({ length: trailCount }, (_, index) => (
        <span key={`trail-${index}`} ref={(node) => { trailRefs.current[index] = node; }} aria-hidden="true" className="keyboard-preview-glyph keyboard-preview-glyph--trail" style={style}>{effect.label}</span>
      ))}
      <span ref={mainRef} className="keyboard-preview-glyph" data-semantic-kind={effect.kind} style={style}>{effect.label}</span>
    </>
  );
}

export function KeyboardPreview({ config, onUpdate, onCaptureChange, onComboLevelChange }: {
  config: KeyFeedbackConfig;
  onUpdate: (patch: Partial<KeyFeedbackConfig>) => void;
  onCaptureChange?: (active: boolean) => void;
  onComboLevelChange?: (level: number) => void;
}) {
  const [wall, setWall] = useState<"light" | "dark">("light");
  const [open, setOpen] = useState(true);
  const [focused, setFocused] = useState(false);
  const [hasTyped, setHasTyped] = useState(false);
  const [effects, setEffects] = useState<PreviewEffect[]>([]);
  const [comboLevel, setComboLevel] = useState(0);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const effectsRef = useRef<PreviewEffect[]>([]);
  const effectId = useRef(0);
  const lastKeyAt = useRef(0);
  const lastKeyAtByCode = useRef(new Map<string, number>());
  const comboLevelRef = useRef(0);
  const comboResetTimer = useRef<number | null>(null);
  const typewriter = useRef({ x: 0, at: 0 });

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const sync = () => setStageSize({ width: stage.clientWidth, height: stage.clientHeight });
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [open]);

  useEffect(() => () => {
    if (comboResetTimer.current !== null) window.clearTimeout(comboResetTimer.current);
    onCaptureChange?.(false);
  }, [onCaptureChange]);

  useEffect(() => {
    onComboLevelChange?.(comboLevel);
  }, [comboLevel, onComboLevelChange]);

  useEffect(() => {
    if (!focused) return;
    const exitCapture = () => {
      stageRef.current?.blur();
      setFocused(false);
      onCaptureChange?.(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      exitCapture();
    };
    window.addEventListener("keydown", handleEscape, true);
    window.addEventListener("blur", exitCapture);
    return () => {
      window.removeEventListener("keydown", handleEscape, true);
      window.removeEventListener("blur", exitCapture);
    };
  }, [focused, onCaptureChange]);

  const removeEffect = useMemo(() => (id: number) => {
    effectsRef.current = effectsRef.current.filter((effect) => effect.id !== id);
    setEffects(effectsRef.current);
  }, []);

  function setCapture(active: boolean) {
    setFocused(active);
    onCaptureChange?.(active);
  }

  function trigger(event: ReactKeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.currentTarget.blur();
      return;
    }
    if (!config.enabled || event.nativeEvent.isComposing || event.key === "Process" || stageSize.width <= 0) return;
    const label = getPreviewKeyLabel(event.nativeEvent, config.keyDisplayMode, config.showModifierKeys, config.uppercase);
    if (!label) return;
    event.preventDefault();
    setHasTyped(true);
    const now = performance.now();
    const lastSameKey = lastKeyAtByCode.current.get(event.code) ?? 0;
    if (now - lastSameKey < config.cooldownMs) return;
    lastKeyAtByCode.current.set(event.code, now);
    if (effectsRef.current.length >= config.maxSimultaneous) return;

    const kind = getPreviewSemanticKind(event.nativeEvent);
    let nextCombo = 0;
    if (config.typingCombo && kind === "character") {
      nextCombo = event.repeat
        ? comboLevelRef.current
        : now - lastKeyAt.current <= 260 ? Math.min(comboLevelRef.current + 1, 7) : 0;
      if (!event.repeat) lastKeyAt.current = now;
    } else if (!event.repeat) {
      comboLevelRef.current = 0;
    }
    comboLevelRef.current = nextCombo;
    setComboLevel(Math.min(nextCombo, 5));
    if (comboResetTimer.current !== null) window.clearTimeout(comboResetTimer.current);
    comboResetTimer.current = window.setTimeout(() => {
      comboLevelRef.current = 0;
      setComboLevel(0);
    }, 500);

    const derived = deriveKeyFeedbackConfig(config, { kind, comboLevel: nextCombo });
    const scale = stageSize.width / SCREEN_REFERENCE_WIDTH;
    const fontSize = derived.fontSize * derived.scale * scale;
    const anchor = resolvePreviewAnchorBounds(derived.anchor, stageSize);
    let typewriterOffset = 0;
    if (derived.originMapping === "typewriter") {
      const advance = fontSize * 0.62;
      if (now - typewriter.current.at > 1200 || typewriter.current.x + advance > anchor.width * 0.88) typewriter.current.x = 0;
      typewriterOffset = typewriter.current.x;
      typewriter.current = { x: typewriterOffset + advance, at: now };
    }
    const layoutX = getPreviewLayoutX(event.code);
    const motion = resolveKeyFeedbackMotion({
      config: { ...derived, bounceHeight: derived.bounceHeight * scale },
      bounds: anchor,
      viewport: stageSize,
      fontSize,
      layoutX,
      typewriterOffset,
      jitter: (Math.random() * 40 - 20) * scale,
    });
    const color = resolveKeyFeedbackColor(derived, { layoutX, kind, comboLevel: nextCombo });
    const persistentFilter = derived.glow && derived.gradient ? `drop-shadow(0 0 ${derived.glowRadius}px ${derived.glowColor})` : undefined;
    const item: PreviewEffect = {
      id: ++effectId.current,
      label,
      color,
      kind,
      config: derived,
      startX: motion.startX,
      startY: motion.startY,
      fontSize,
      frames: buildKeyFeedbackKeyframes({ config: derived, motion, viewport: stageSize, fontSize, entranceEasing: getAnimationEasing(derived.easing), persistentFilter }),
    };
    effectsRef.current = [...effectsRef.current, item];
    setEffects(effectsRef.current);
  }

  const previewGeometry = useMemo(() => {
    if (stageSize.width <= 0) return null;
    const scale = stageSize.width / SCREEN_REFERENCE_WIDTH;
    const fontSize = config.fontSize * config.scale * scale;
    const anchor = resolvePreviewAnchorBounds(config.anchor, stageSize);
    const scaledConfig = { ...config, bounceHeight: config.bounceHeight * scale };
    const motion = resolveKeyFeedbackMotion({ config: scaledConfig, bounds: anchor, viewport: stageSize, fontSize, layoutX: 0.5, jitter: 0 });
    const raw = resolveKeyFeedbackRestPoint(motion, config.animationStyle);
    const point = config.animationStyle === "raindrop"
      ? { x: Math.min(anchor.x + anchor.width, Math.max(anchor.x, raw.x)), y: Math.min(anchor.y + anchor.height, Math.max(anchor.y, raw.y)) }
      : raw;
    return { anchor, point, scale, fontSize, edge: motion.edge };
  }, [config, stageSize]);

  function dragRestPoint(event: ReactPointerEvent<HTMLButtonElement>) {
    const geometry = previewGeometry;
    if (!geometry || config.anchor === "caret" || (config.animationStyle === "raindrop" && config.originMapping !== "center")) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || geometry.anchor.width <= 0 || geometry.anchor.height <= 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const update = (clientX: number, clientY: number) => {
      const { anchor, scale } = geometry;
      const x = Math.min(anchor.width, Math.max(0, clientX - rect.left - anchor.x));
      const y = Math.min(anchor.height, Math.max(0, clientY - rect.top - anchor.y));
      const edge = config.anchor === "caret" ? "bottom" : config.originEdge;
      const patch: { globalOffsetX?: number; globalOffsetY?: number } = {};
      if (edge === "bottom" || edge === "top") {
        if (config.originMapping === "center") patch.globalOffsetX = x / anchor.width;
        if (config.animationStyle === "bounce") {
          const distance = edge === "bottom" ? anchor.height - y : y;
          patch.globalOffsetY = Math.max(0, Math.min(1, (distance - config.bounceHeight * scale) / anchor.height));
        }
      } else {
        patch.globalOffsetY = y / anchor.height;
        if (config.animationStyle === "bounce") {
          const distance = edge === "left" ? x : anchor.width - x;
          patch.globalOffsetX = Math.max(0, Math.min(1, (distance - config.bounceHeight * scale) / anchor.width));
        }
      }
      onUpdate(patch);
    };
    update(event.clientX, event.clientY);
    const move = (moveEvent: PointerEvent) => update(moveEvent.clientX, moveEvent.clientY);
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  }

  const autoMapping = config.originMapping !== "center";
  const showHandle = config.anchor !== "caret" && !(config.animationStyle === "raindrop" && autoMapping);
  const stageHint = config.anchor === "caret"
    ? "位置由文字插入点决定，请在右侧「位置」中调整距离。"
    : showHandle
      ? `点四周的「上／下／左／右」选择字符从哪条边飞入；拖动圆点调整${config.animationStyle === "raindrop" ? "起始" : "停留"}位置。`
      : "位置由键位与重力决定，请在右侧「位置」中调整参数。";
  const verticalEntry = previewGeometry?.edge === "top" || previewGeometry?.edge === "bottom";
  const handleLabel = `${config.animationStyle === "raindrop" ? "起始位置" : "停留位置"}${verticalEntry && config.anchor !== "caret" ? config.originMapping === "typewriter" ? "（行首）" : config.originMapping === "keyboardLayout" ? "（键位决定横向）" : "" : ""}`;

  return (
    <section className="keyboard-card keyboard-preview-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0"><h2 className="text-sm font-medium text-slate-900">屏幕预览</h2></div>
        <div className="flex items-center gap-2">
          <div className="inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 p-0.5" role="radiogroup" aria-label="桌面底色">
            {(["light", "dark"] as const).map((value) => <button key={value} type="button" role="radio" aria-checked={wall === value} onClick={() => setWall(value)} className={cn("inline-flex h-6 items-center rounded-lg px-2 text-xs font-medium transition-colors", wall === value ? "bg-slate-950 text-white shadow-sm" : "text-slate-500 hover:text-slate-900")}>{value === "light" ? "浅色" : "深色"}</button>)}
          </div>
          <button type="button" className="grid size-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-expanded={open} aria-label={open ? "收起屏幕预览" : "展开屏幕预览"} onClick={() => setOpen((value) => !value)}><ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90")} /></button>
        </div>
      </div>
      {open ? <div className="px-4 py-3">
        <div className="keyboard-preview-stage relative mx-auto">
          <div ref={stageRef} data-keyboard-screen role="group" tabIndex={0} aria-label="屏幕预览：点一下再打字即可预览效果" onPointerDown={(event) => event.currentTarget.focus()} onFocus={() => setCapture(true)} onBlur={() => setCapture(false)} onKeyDown={trigger} className={cn("relative aspect-[16/10] w-full overflow-hidden rounded-xl border outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2", wall === "dark" ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-100")}>
            <div className={cn("absolute inset-x-0 top-0 h-[6%]", wall === "dark" ? "bg-slate-900/70" : "bg-white/70")} />
            <div className={cn("absolute left-[6%] top-[14%] h-[48%] w-[36%] rounded-lg border", wall === "dark" ? "border-slate-700 bg-slate-900/70" : "border-slate-200 bg-white/80")}><div className={cn("h-[14%] border-b", wall === "dark" ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-100/80")} /></div>
            <div className={cn("absolute left-[52%] top-[26%] h-[56%] w-[42%] rounded-lg border", wall === "dark" ? "border-slate-700 bg-slate-900/50" : "border-slate-200 bg-white/60")}><div className={cn("h-[13%] border-b", wall === "dark" ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-slate-100/80")} /></div>
            {config.anchor !== "screen" ? <div className={cn("pointer-events-none absolute left-[52%] top-[26%] h-[56%] w-[42%] rounded-lg border", wall === "dark" ? "border-slate-400" : "border-slate-400")}>
              <span className={cn("absolute left-1 top-1 text-2xs font-medium", wall === "dark" ? "text-slate-300" : "text-slate-500")}>前台窗口</span>
              <div className="absolute inset-x-4 top-6 space-y-1.5"><div className={cn("h-1.5 w-4/5 rounded-full", wall === "dark" ? "bg-slate-600/70" : "bg-slate-300/70")} /><div className={cn("h-1.5 w-3/5 rounded-full", wall === "dark" ? "bg-slate-600/70" : "bg-slate-300/70")} /></div>
              {config.anchor === "caret" ? <div className="absolute inset-x-4 top-16 flex items-center gap-1"><div className={cn("h-1.5 flex-1 rounded-full", wall === "dark" ? "bg-slate-600/70" : "bg-slate-300/70")} /><div className={cn("h-4 w-0.5 shrink-0 animate-pulse", wall === "dark" ? "bg-white" : "bg-slate-900")} /><div className="w-10 shrink-0" /></div> : null}
            </div> : null}
            <div className={cn("absolute inset-x-0 bottom-0 h-[10%]", wall === "dark" ? "bg-slate-900/60" : "bg-white/50")} />
            {config.originMapping === "keyboardLayout" && previewGeometry && (previewGeometry.edge === "top" || previewGeometry.edge === "bottom") && config.anchor !== "caret" ? (
              <div className="pointer-events-none absolute rounded-lg border border-dashed border-slate-400/60" style={{ left: previewGeometry.anchor.x, width: previewGeometry.anchor.width, height: Math.max(18, previewGeometry.fontSize * 1.6), top: Math.max(2, Math.min(stageSize.height - Math.max(20, previewGeometry.fontSize * 1.6), previewGeometry.point.y - previewGeometry.fontSize * 0.8)) }}>
                <span className={cn("keyboard-stage-tag absolute left-0", Number(previewGeometry.point.y - previewGeometry.fontSize * 0.8) < 22 ? "top-full mt-1" : "-top-5")}>按键位散开</span>
                {[[0.1, "q"], [0.28, "e"], [0.45, "t"], [0.62, "u"], [0.8, "o"], [0.92, "p"]].map(([x, label]) => <span key={String(label)} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 font-bold leading-none" style={{ left: `${Number(x) * 100}%`, fontSize: previewGeometry.fontSize, color: config.color, opacity: 0.22 }}>{label}</span>)}
              </div>
            ) : null}
            {config.originMapping === "typewriter" && previewGeometry && (previewGeometry.edge === "top" || previewGeometry.edge === "bottom") && config.anchor !== "caret" ? (
              <div className="pointer-events-none absolute border-b border-dashed border-slate-400" style={{ left: previewGeometry.anchor.x + previewGeometry.anchor.width * 0.04, width: previewGeometry.anchor.width * 0.88, height: previewGeometry.fontSize, top: Math.max(8, Math.min(stageSize.height - previewGeometry.fontSize, previewGeometry.point.y - previewGeometry.fontSize * 0.38)) }}><span className="keyboard-stage-tag absolute -top-5 left-0">打字机基线</span>{["a", "b", "c"].map((label, index) => <span key={label} className="absolute bottom-0 font-bold leading-none" style={{ left: index * previewGeometry.fontSize * 0.62, fontSize: previewGeometry.fontSize, color: config.color, opacity: 0.22 }}>{label}</span>)}</div>
            ) : null}
            {effects.map((effect) => <KeyboardEffect key={effect.id} effect={effect} onFinished={removeEffect} />)}
            {!hasTyped ? <div className="pointer-events-none absolute inset-0 grid place-items-center"><span className={cn("rounded-lg px-3 py-1.5 text-xs font-medium ring-1", wall === "dark" ? "bg-slate-900/90 text-slate-300 ring-slate-700" : "bg-white/85 text-slate-500 ring-slate-200")}>直接开始打字</span></div> : null}
            {config.anchor === "caret" ? <div className="pointer-events-none absolute inset-x-2 bottom-2 flex justify-center"><span className="rounded-lg bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-white/90">中文输入组字期间不出字符 · 上屏那一刻才触发</span></div> : null}
            {!config.enabled ? <div className="absolute inset-0 grid place-items-center bg-white/70"><span className="rounded-xl bg-white px-3 py-2 text-center text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">动效已关闭<span className="mt-0.5 block font-normal text-slate-400">配置仍可调整，开启后生效</span></span></div> : null}
          </div>
          {(Object.keys(EDGE_LABELS) as Array<keyof typeof EDGE_LABELS>).map((edge) => <button key={edge} type="button" role="radio" aria-checked={(config.anchor === "caret" ? "bottom" : config.originEdge) === edge} disabled={config.anchor === "caret"} onClick={() => onUpdate({ originEdge: edge })} className={cn("keyboard-edge-button", EDGE_POSITION_CLASSES[edge], (config.anchor === "caret" ? "bottom" : config.originEdge) === edge && "keyboard-edge-button--active")} style={EDGE_POSITION_STYLES[edge]}>{EDGE_LABELS[edge]}</button>)}
          {showHandle && previewGeometry ? <button type="button" aria-label={`拖动${config.animationStyle === "raindrop" ? "起始" : "停留"}位置`} onPointerDown={dragRestPoint} className="keyboard-rest-handle" style={{ left: previewGeometry.point.x, top: previewGeometry.point.y }}><span /><span className="keyboard-stage-tag keyboard-rest-label">{handleLabel}</span></button> : null}
        </div>
        <div className="mt-2.5 flex min-h-6 items-center justify-between gap-3"><p className="min-w-0 text-2xs leading-relaxed text-slate-500">{stageHint}</p><div className="flex shrink-0 items-center gap-1.5">{effects.length > 0 ? <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold tabular-nums ring-1", effects.length >= config.maxSimultaneous ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-slate-50 text-slate-600 ring-slate-200")}>同显 {effects.length}/{config.maxSimultaneous}</span> : null}{config.typingCombo && comboLevel > 0 ? <span className="inline-flex h-6 items-center gap-1.5 rounded-lg bg-slate-50 px-2 text-xs font-medium text-slate-500 ring-1 ring-slate-200">连击 <span className="flex items-center gap-0.5">{Array.from({ length: 5 }, (_, index) => <span key={index} className={cn("size-1.5 rounded-full", index < comboLevel ? "bg-emerald-500" : "bg-slate-200")} />)}</span></span> : null}</div></div>
      </div> : null}
    </section>
  );
}
