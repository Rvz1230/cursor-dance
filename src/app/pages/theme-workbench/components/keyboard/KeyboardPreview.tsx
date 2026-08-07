import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ChevronDown, Moon, Sun } from "lucide-react";
import { cn } from "@/components/ui/utils";
import type { KeyFeedbackConfig } from "@/shared/config/key-feedback";
import { deriveKeyFeedbackConfig, resolveKeyFeedbackColor, type KeySemanticKind } from "@/shared/effect-core/key-feedback-style";
import { getPreviewKeyLabel, getPreviewLayoutX, getPreviewSemanticKind, resolvePreviewEffectPosition } from "./keyboardPreviewModel";

interface PreviewEffect {
  id: number;
  label: string;
  x: number;
  y: number;
  color: string;
  kind: KeySemanticKind;
  comboLevel: number;
  config: KeyFeedbackConfig;
}

type PreviewStyle = CSSProperties & Record<`--kbd-${string}`, string | number>;

const EDGE_LABELS = { top: "上", bottom: "下", left: "左", right: "右" } as const;

function KeyboardEffect({ effect }: { effect: PreviewEffect }) {
  const config = effect.config;
  const style: PreviewStyle = {
    "--kbd-x": `${effect.x * 100}%`,
    "--kbd-y": `${effect.y * 100}%`,
    "--kbd-size": `${Math.max(14, config.fontSize * config.scale * 0.68)}px`,
    "--kbd-opacity": config.opacity / 100,
    "--kbd-duration": `${Math.max(280, config.duration)}ms`,
    "--kbd-color": effect.color,
    "--kbd-glow": config.glow ? `0 0 ${Math.max(2, config.glowRadius * 0.7)}px ${config.glowColor}` : "none",
    fontFamily: config.fontFamily === "系统默认" ? undefined : config.fontFamily,
    fontWeight: ({ 标准: 400, 中等: 500, 半粗: 600, 加粗: 700 } as Record<string, number>)[config.fontWeight] ?? 700,
  };
  if (config.gradient) {
    style.backgroundImage = `linear-gradient(180deg, ${effect.color}, ${config.gradientTo})`;
  }
  return (
    <div
      className={cn(
        "keyboard-preview-effect",
        `keyboard-preview-effect--${config.animationStyle}`,
        `keyboard-preview-effect--${config.originEdge}`,
        `keyboard-preview-effect--exit-${config.exitStyle}`,
        config.gradient && "keyboard-preview-effect--gradient",
      )}
      style={style}
      data-semantic-kind={effect.kind}
    >
      {config.trail ? Array.from({ length: config.trailLength }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className="keyboard-preview-trail"
          style={{ opacity: (config.opacity / 100) * (0.24 / (index + 1)), transform: `translateY(${(index + 1) * 5}px) scale(${1 - index * 0.04})` }}
        >{effect.label}</span>
      )) : null}
      <span>{effect.label}</span>
    </div>
  );
}

export function KeyboardPreview({
  config,
  onUpdate,
}: {
  config: KeyFeedbackConfig;
  onUpdate: (patch: Partial<KeyFeedbackConfig>) => void;
}) {
  const [wall, setWall] = useState<"light" | "dark">("light");
  const [open, setOpen] = useState(true);
  const [focused, setFocused] = useState(false);
  const [effects, setEffects] = useState<PreviewEffect[]>([]);
  const [comboLevel, setComboLevel] = useState(0);
  const effectId = useRef(0);
  const lastKeyAt = useRef(0);
  const comboLevelRef = useRef(0);
  const comboResetTimer = useRef<number | null>(null);
  const typewriter = useRef({ x: 0.14, at: 0 });
  const timers = useRef<number[]>([]);

  useEffect(() => () => {
    timers.current.forEach(window.clearTimeout);
    if (comboResetTimer.current !== null) window.clearTimeout(comboResetTimer.current);
  }, []);

  function trigger(event: ReactKeyboardEvent<HTMLDivElement>) {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.currentTarget.blur();
      return;
    }
    if (!config.enabled || event.repeat || event.nativeEvent.isComposing || event.key === "Process") return;
    const label = getPreviewKeyLabel(event.nativeEvent, config.keyDisplayMode, config.showModifierKeys, config.uppercase);
    if (!label) return;
    event.preventDefault();
    const now = Date.now();
    const nextCombo = now - lastKeyAt.current <= 260 ? Math.min(comboLevelRef.current + 1, 5) : 0;
    lastKeyAt.current = now;
    comboLevelRef.current = nextCombo;
    setComboLevel(nextCombo);
    if (comboResetTimer.current !== null) window.clearTimeout(comboResetTimer.current);
    comboResetTimer.current = window.setTimeout(() => {
      comboLevelRef.current = 0;
      setComboLevel(0);
    }, 300);
    const kind = getPreviewSemanticKind(event.nativeEvent);
    const derived = deriveKeyFeedbackConfig(config, { kind, comboLevel: nextCombo });
    let typewriterX = 0.14;
    if (derived.originMapping === "typewriter") {
      if (now - typewriter.current.at > 1200 || typewriter.current.x > 0.82) typewriter.current.x = 0.14;
      typewriterX = typewriter.current.x;
      typewriter.current = { x: typewriterX + Math.min(0.14, Math.max(0.05, label.length * 0.04)), at: now };
    }
    const layoutX = getPreviewLayoutX(event.code);
    const position = resolvePreviewEffectPosition({ ...derived, layoutX, typewriterX });
    const item: PreviewEffect = {
      id: ++effectId.current,
      label,
      ...position,
      color: resolveKeyFeedbackColor(derived, { layoutX, kind, comboLevel: nextCombo }),
      kind,
      comboLevel: nextCombo,
      config: derived,
    };
    setEffects((current) => [...current.slice(-Math.max(0, config.maxSimultaneous - 1)), item]);
    const timer = window.setTimeout(() => {
      setEffects((current) => current.filter((candidate) => candidate.id !== item.id));
    }, derived.duration + 120);
    timers.current.push(timer);
  }

  function dragRestPoint(event: ReactPointerEvent<HTMLButtonElement>) {
    if (config.originMapping !== "center" || config.anchor === "caret") return;
    const stage = event.currentTarget.parentElement?.querySelector<HTMLElement>("[data-keyboard-screen]");
    const rect = stage?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const update = (clientX: number, clientY: number) => onUpdate({
      globalOffsetX: Math.min(0.94, Math.max(0.06, (clientX - rect.left) / rect.width)),
      globalOffsetY: Math.min(0.9, Math.max(0.1, (clientY - rect.top) / rect.height)),
    });
    update(event.clientX, event.clientY);
    const move = (moveEvent: PointerEvent) => update(moveEvent.clientX, moveEvent.clientY);
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  }

  const stageHint = config.anchor === "caret"
    ? "插入点锚点在此模拟；桌面运行时暂时回落到屏幕"
    : config.originMapping === "center"
      ? "拖动圆点调整停留位置 · 四条边选择入场方向"
      : config.originMapping === "typewriter"
        ? "字符沿基线依次排开 · 四条边选择入场方向"
        : "按 QWERTY 键位横向散开 · 四条边选择入场方向";

  return (
    <section className="keyboard-card keyboard-preview-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-medium text-slate-900">屏幕预览</h2>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" role="radiogroup" aria-label="桌面底色">
            {(["light", "dark"] as const).map((value) => (
              <button key={value} type="button" role="radio" aria-checked={wall === value} onClick={() => setWall(value)} className={cn("flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium", wall === value ? "bg-slate-950 text-white" : "text-slate-500")}>
                {value === "light" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}{value === "light" ? "浅色" : "深色"}
              </button>
            ))}
          </div>
          <button type="button" className="grid size-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-expanded={open} aria-label={open ? "收起屏幕预览" : "展开屏幕预览"} onClick={() => setOpen((value) => !value)}>
            <ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90")} />
          </button>
        </div>
      </div>
      {open ? (
        <div className="px-4 py-3">
          <div className="keyboard-preview-stage relative mx-auto">
            <div
              data-keyboard-screen
              role="application"
              tabIndex={0}
              aria-label="屏幕预览：点一下再打字即可预览效果"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={trigger}
              className={cn(
                "relative aspect-[16/10] w-full overflow-hidden rounded-xl border outline-none transition-shadow",
                wall === "dark" ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-slate-100",
                focused && "ring-2 ring-slate-400 ring-offset-2",
              )}
            >
              <div className={cn("absolute inset-x-0 top-0 h-[6%]", wall === "dark" ? "bg-slate-950/80" : "bg-white/80")} />
              <div className={cn("absolute left-[6%] top-[14%] h-[48%] w-[36%] rounded-lg border", wall === "dark" ? "border-slate-700 bg-slate-800/80" : "border-slate-200 bg-white/80")}>
                <div className={cn("h-[14%] border-b", wall === "dark" ? "border-slate-700" : "border-slate-200")} />
              </div>
              <div className={cn("absolute left-[52%] top-[26%] h-[56%] w-[42%] rounded-lg border", wall === "dark" ? "border-slate-600 bg-slate-800/70" : "border-slate-300 bg-white/70", config.anchor !== "screen" && "ring-2 ring-sky-400/60")}>
                <div className={cn("h-[13%] border-b", wall === "dark" ? "border-slate-600" : "border-slate-200")} />
                <div className="mx-[12%] mt-[14%] space-y-2">
                  <div className={cn("h-1.5 w-4/5 rounded-full", wall === "dark" ? "bg-slate-600" : "bg-slate-300")} />
                  <div className={cn("h-1.5 w-3/5 rounded-full", wall === "dark" ? "bg-slate-600" : "bg-slate-300")} />
                  {config.anchor === "caret" ? <div className="ml-[55%] h-5 w-0.5 animate-pulse bg-sky-500" /> : null}
                </div>
                {config.anchor !== "screen" ? <span className={cn("absolute left-1.5 top-1 text-2xs font-medium", wall === "dark" ? "text-slate-300" : "text-slate-500")}>{config.anchor === "caret" ? "文字插入点" : "前台窗口"}</span> : null}
              </div>
              <div className={cn("absolute inset-x-0 bottom-0 h-[10%]", wall === "dark" ? "bg-slate-950/70" : "bg-white/60")} />

              {config.originMapping === "keyboardLayout" ? <div className="pointer-events-none absolute inset-x-[8%] bottom-[18%] h-[22%] rounded-lg border border-dashed border-slate-400/60" /> : null}
              {config.originMapping === "typewriter" ? <div className="pointer-events-none absolute left-[14%] right-[14%] top-[62%] border-b border-dashed border-slate-400"><span className="absolute -top-5 left-0 text-2xs font-medium text-slate-500">打字机基线</span></div> : null}

              {effects.map((effect) => <KeyboardEffect key={effect.id} effect={effect} />)}
              {!focused && effects.length === 0 ? <div className="pointer-events-none absolute inset-0 grid place-items-center"><span className={cn("rounded-lg px-3 py-1.5 text-xs font-medium ring-1", wall === "dark" ? "bg-slate-900/90 text-slate-300 ring-slate-700" : "bg-white/90 text-slate-500 ring-slate-200")}>点一下，再直接开始打字</span></div> : null}
              {!config.enabled ? <div className="absolute inset-0 grid place-items-center bg-white/70"><span className="rounded-xl bg-white px-3 py-2 text-center text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">动效已关闭<span className="mt-0.5 block font-normal text-slate-400">配置仍可调整，开启后生效</span></span></div> : null}
            </div>

            {(Object.keys(EDGE_LABELS) as Array<keyof typeof EDGE_LABELS>).map((edge) => (
              <button key={edge} type="button" role="radio" aria-checked={config.originEdge === edge} disabled={config.anchor === "caret"} onClick={() => onUpdate({ originEdge: edge })} className={cn("keyboard-edge-button", `keyboard-edge-button--${edge}`, config.originEdge === edge && "keyboard-edge-button--active")}>
                {EDGE_LABELS[edge]}
              </button>
            ))}
            {config.originMapping === "center" && config.anchor !== "caret" ? (
              <button type="button" aria-label="拖动停留位置" onPointerDown={dragRestPoint} className="keyboard-rest-handle" style={{ left: `${config.globalOffsetX * 100}%`, top: `${config.globalOffsetY * 100}%` }}><span /></button>
            ) : null}
          </div>
          <div className="mt-2.5 flex min-h-6 items-center justify-between gap-3">
            <p className="min-w-0 text-2xs leading-relaxed text-slate-500">{stageHint}</p>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="rounded-lg bg-slate-50 px-2 py-1 text-xs font-semibold tabular-nums text-slate-600 ring-1 ring-slate-200">同显 {effects.length}/{config.maxSimultaneous}</span>
              {config.typingCombo ? <span className="flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-500 ring-1 ring-slate-200">连击 {Array.from({ length: 5 }, (_, index) => <span key={index} className={cn("size-1.5 rounded-full", index < comboLevel ? "bg-slate-800" : "bg-slate-200")} />)}</span> : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
