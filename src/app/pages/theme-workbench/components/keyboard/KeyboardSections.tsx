import { useState, type ReactNode } from "react";
import { CheckCircle2, ChevronDown, LockKeyhole, Monitor, TextCursorInput, Wand2 } from "lucide-react";
import { ColorField } from "@/components/ui/color-field";
import { EASING_NAMES, FONTS } from "@/components/ui/control-data";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/components/ui/utils";
import { defaultKeyFeedbackConfig, type KeyFeedbackConfig } from "@/shared/config/key-feedback";
import { getHueShiftUnavailableReason } from "@/shared/effect-core/key-feedback-style";
import { KEYBOARD_PRESETS, isKeyboardPresetActive } from "./keyboardPresets";

const COLORS = ["#F59E0B", "#0EA5E9", "#0D9488", "#F43F5E", "#8B5CF6", "#FFFFFF", "#0F172A"];

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("keyboard-card", className)}>{children}</section>;
}

function CardHeader({ title, description }: { title: string; description: string }) {
  return <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-medium text-slate-900">{title}</h2><p className="mt-0.5 text-xs text-slate-500">{description}</p></div>;
}

function Field({ label, value, children, note }: { label: string; value?: ReactNode; children: ReactNode; note?: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs font-medium text-slate-600">{label}</span>{value ? <span className="text-xs font-semibold tabular-nums text-slate-600">{value}</span> : null}</div>
      {children}
      {note ? <p className="mt-1.5 text-2xs leading-relaxed text-slate-500">{note}</p> : null}
    </div>
  );
}

function SwitchRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="min-w-0"><div className="text-xs font-medium text-slate-600">{label}</div>{description ? <p className="mt-0.5 text-2xs leading-relaxed text-slate-500">{description}</p> : null}</div>
      <Switch className="h-5 w-9 [&>span]:h-4 [&>span]:w-4 aria-checked:[&>span]:translate-x-4" checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

function InnerSection({ title, description, summary, children }: { title: string; description: string; summary?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="min-w-0"><span className="block text-sm font-medium text-slate-900">{title}</span><span className="mt-0.5 block text-xs text-slate-500">{description}</span></span>
        <span className="flex shrink-0 items-center gap-2"><span className="text-xs text-slate-500">{summary}</span><ChevronDown className={cn("size-4 text-slate-500 transition-transform", open && "rotate-180")} /></span>
      </button>
      {open ? <div className="space-y-3.5 border-t border-slate-100 px-4 py-3">{children}</div> : null}
    </section>
  );
}

export function KeyboardAppearance({ config, onUpdate }: { config: KeyFeedbackConfig; onUpdate: (patch: Partial<KeyFeedbackConfig>) => void }) {
  const [showMore, setShowMore] = useState(false);
  const visiblePresets = KEYBOARD_PRESETS.filter((preset) => showMore || !preset.more);
  return (
    <Card className="keyboard-appearance-card">
      <CardHeader title="外观" description="先挑一个预设，再微调" />
      <div className="space-y-3.5 px-4 py-3">
        <div className="grid grid-cols-2 gap-2">
          {visiblePresets.map((preset) => {
            const active = isKeyboardPresetActive(config, preset);
            return <button key={preset.id} type="button" aria-pressed={active} onClick={() => onUpdate(preset.patch)} className={cn("relative rounded-xl border px-3 py-2.5 text-left transition-colors", active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300")}><span className="block text-xs font-semibold">{preset.name}</span><span className={cn("mt-0.5 block text-2xs", active ? "text-white/70" : "text-slate-500")}>{preset.description}</span>{active ? <CheckCircle2 className="absolute right-2 top-2 size-3.5" /> : null}</button>;
          })}
        </div>
        <button type="button" className="flex w-full items-center justify-center gap-1 rounded-lg py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800" aria-expanded={showMore} onClick={() => setShowMore((value) => !value)}>{showMore ? "收起更多预设" : "更多预设（4）"}<ChevronDown className={cn("size-3.5 transition-transform", showMore && "rotate-180")} /></button>
        <div className="border-t border-slate-100 pt-3.5">
          <Field label="颜色" value={config.color}>
            <ColorField compact value={config.color} palette={COLORS} label="字符颜色" onChange={(color) => onUpdate({ color })} />
          </Field>
        </div>
        <Field label="字号" value={`${config.fontSize} px`}><Slider compact showInput={false} label="字号" value={config.fontSize} min={16} max={120} defaultValue={defaultKeyFeedbackConfig.fontSize} onChange={(fontSize) => onUpdate({ fontSize })} /></Field>
        <Field label="不透明度" value={`${config.opacity}%`}><Slider compact showInput={false} label="不透明度" value={config.opacity} min={10} max={100} defaultValue={defaultKeyFeedbackConfig.opacity} onChange={(opacity) => onUpdate({ opacity })} /></Field>
      </div>
    </Card>
  );
}

function AnchorChoice({ active, icon: Icon, title, description, badge, onClick }: { active: boolean; icon: typeof Monitor; title: string; description: string; badge: ReactNode; onClick: () => void }) {
  return <button type="button" role="radio" aria-checked={active} onClick={onClick} className={cn("flex w-full items-start gap-3 rounded-xl border p-3 text-left", active ? "border-slate-950 bg-slate-50 ring-1 ring-slate-950" : "border-slate-200 hover:border-slate-300")}><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200"><Icon className="size-4" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-slate-800">{title}</span>{badge}</span><span className="mt-1 block text-2xs leading-relaxed text-slate-500">{description}</span></span></button>;
}

export function KeyboardPlacement({ config, accessibilityAuthorized, onUpdate }: { config: KeyFeedbackConfig; accessibilityAuthorized: boolean | null; onUpdate: (patch: Partial<KeyFeedbackConfig>) => void }) {
  const windowBadge = accessibilityAuthorized === false ? <span className="keyboard-badge keyboard-badge--warn">需要权限</span> : <span className="keyboard-badge keyboard-badge--ok">现在生效</span>;
  return (
    <div className="space-y-2.5">
      <InnerSection title="锚点" description="字符出现在哪儿" summary={{ screen: "屏幕", window: accessibilityAuthorized === false ? "前台窗口 · 需权限" : "前台窗口", caret: "插入点 · 待能力" }[config.anchor]}>
        <p className="text-2xs leading-relaxed text-slate-500">位置、距离与偏移都相对这里选中的锚点计算。</p>
        <div className="space-y-1.5" role="radiogroup" aria-label="键盘动效锚点">
          <AnchorChoice active={config.anchor === "screen"} icon={Monitor} title="屏幕" description="从整块屏幕的边缘出现，和当前窗口无关。" badge={<span className="keyboard-badge keyboard-badge--ok">现在生效</span>} onClick={() => onUpdate({ anchor: "screen" })} />
          <AnchorChoice active={config.anchor === "window"} icon={Wand2} title="前台窗口" description="跟着正在使用的窗口移动；取不到窗口时回落到屏幕。" badge={windowBadge} onClick={() => onUpdate({ anchor: "window" })} />
          <AnchorChoice active={config.anchor === "caret"} icon={TextCursorInput} title="文字插入点" description="配置会保存；当前桌面运行时取不到时回落到屏幕并记录诊断。" badge={<span className="keyboard-badge">待系统能力</span>} onClick={() => onUpdate({ anchor: "caret" })} />
        </div>
      </InnerSection>
      <InnerSection title="位置" description="也可以直接在预览里拖" summary={`${EDGE_LABELS[config.originEdge]} · ${{ keyboardLayout: "按键位", center: "固定", typewriter: "打字机" }[config.originMapping]}`}>
        <Field label="入场边"><Segmented fill ariaLabel="入场边" value={config.originEdge} onChange={(originEdge) => onUpdate({ originEdge })} disabled={config.anchor === "caret"} options={Object.entries(EDGE_LABELS).map(([value, label]) => ({ value: value as KeyFeedbackConfig["originEdge"], label }))} /></Field>
        <Field label="水平分布" note={{ keyboardLayout: "按 QWERTY 键位横向铺开。", center: "所有字符从同一个位置出现，可在预览中拖动。", typewriter: "字符依次排在前一个字符右侧，停顿后回到行首。" }[config.originMapping]}><Segmented fill ariaLabel="水平分布" value={config.originMapping} onChange={(originMapping) => onUpdate({ originMapping })} options={[{ value: "keyboardLayout", label: "按键位" }, { value: "center", label: "固定一处" }, { value: "typewriter", label: "打字机" }]} /></Field>
        <Field label={config.anchor === "screen" ? "停留距离" : "离锚点距离"} value={`${config.bounceHeight} px`}><Slider compact showInput={false} label="停留距离" value={config.bounceHeight} min={0} max={400} defaultValue={defaultKeyFeedbackConfig.bounceHeight} onChange={(bounceHeight) => onUpdate({ bounceHeight })} /></Field>
        {config.animationStyle === "raindrop" ? <><Field label="重力" value={config.gravity.toFixed(1)}><Slider compact showInput={false} label="重力" value={config.gravity} min={0} max={1} step={0.1} onChange={(gravity) => onUpdate({ gravity })} /></Field><Field label="风力" value={config.wind.toFixed(1)}><Slider compact showInput={false} bipolar label="风力" value={config.wind} min={-1} max={1} step={0.1} onChange={(wind) => onUpdate({ wind })} /></Field></> : null}
      </InnerSection>
    </div>
  );
}

const SEMANTIC_TIERS = [{ label: "关闭", value: 0 }, { label: "克制", value: 0.5 }, { label: "标准", value: 1 }, { label: "明显", value: 1.5 }] as const;

function SemanticTier({ label, sample, value, onChange }: { label: string; sample: string; value: number; onChange: (value: number) => void }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><div><span className="text-xs font-medium text-slate-700">{label}</span><span className="ml-2 text-sm font-bold text-slate-900">{sample}</span></div><div className="flex rounded-lg bg-white p-0.5 ring-1 ring-slate-200">{SEMANTIC_TIERS.map((tier) => <button key={tier.value} type="button" aria-pressed={value === tier.value} onClick={() => onChange(tier.value)} className={cn("rounded-md px-1.5 py-1 text-2xs font-medium", value === tier.value ? "bg-slate-950 text-white" : "text-slate-500")}>{tier.label}</button>)}</div></div></div>;
}

export function KeyboardMeaning({ config, onUpdate }: { config: KeyFeedbackConfig; onUpdate: (patch: Partial<KeyFeedbackConfig>) => void }) {
  return <div className="space-y-2.5">
    <InnerSection title="显示内容" description="决定按下的键显示成什么" summary={config.keyDisplayMode === "typed" ? "真实输入" : "物理键名"}>
      <Field label="显示模式" note={config.keyDisplayMode === "typed" ? "⇧+1 显示为 !，和实际输入一致。" : "显示键盘上的物理键名，适合快捷键训练。"}><Segmented fill ariaLabel="显示模式" value={config.keyDisplayMode} onChange={(keyDisplayMode) => onUpdate({ keyDisplayMode })} options={[{ value: "typed", label: "真实输入" }, { value: "physical", label: "物理键名" }]} /></Field>
      <div className="border-t border-slate-100 pt-2"><SwitchRow label="显示单独修饰键" checked={config.showModifierKeys} onChange={(showModifierKeys) => onUpdate({ showModifierKeys })} /><SwitchRow label="强制大写" checked={config.uppercase} onChange={(uppercase) => onUpdate({ uppercase })} /></div>
    </InnerSection>
    <InnerSection title="语义分层" description="不同按键用不同强度呈现" summary={config.semanticStyles ? "已开启" : "已关闭"}>
      <SwitchRow label="启用语义分层" description="字符、快捷键、修饰键和特殊键使用不同字号、时长与位置。" checked={config.semanticStyles} onChange={(semanticStyles) => onUpdate({ semanticStyles })} />
      {config.semanticStyles ? <div className="space-y-2 border-t border-slate-100 pt-3"><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><span className="text-xs font-medium text-slate-700">普通字符</span><span className="ml-2 text-sm font-bold">a</span><p className="mt-1 text-2xs text-slate-500">基准大小与时长</p></div><SemanticTier label="快捷键" sample="⌘K" value={config.semShortcut} onChange={(semShortcut) => onUpdate({ semShortcut })} /><SemanticTier label="单独修饰键" sample="⇧" value={config.semModifier} onChange={(semModifier) => onUpdate({ semModifier })} /><SemanticTier label="特殊键" sample="↩" value={config.semSpecial} onChange={(semSpecial) => onUpdate({ semSpecial })} /></div> : null}
    </InnerSection>
  </div>;
}

export function KeyboardAdvanced({ config, onUpdate }: { config: KeyFeedbackConfig; onUpdate: (patch: Partial<KeyFeedbackConfig>) => void }) {
  const hueUnavailable = config.colorMode === "solid" ? null : getHueShiftUnavailableReason(config.color);
  return <div className="space-y-2.5">
    <InnerSection title="上色" description="让颜色跟着内容变化" summary={config.gradient ? "渐变" : { solid: "单色", byKey: "按键位", byRhythm: "按节奏", bySemantic: "按语义" }[config.colorMode]}>
      <Field label="色相由什么决定"><Select value={config.colorMode} onChange={(colorMode) => onUpdate({ colorMode })} options={[{ value: "solid", label: "单色", description: "所有字符使用基准色" }, { value: "byKey", label: "按键位", description: "左右键位映射不同色相" }, { value: "byRhythm", label: "按节奏", description: "连击越快偏色越多" }, { value: "bySemantic", label: "按语义", description: "四类按键各占一个色相区间" }]} /></Field>
      {config.colorMode !== "solid" ? <Field label="色相跨度" value={`${config.hueSpread}°`} note={hueUnavailable ? `当前基准色${hueUnavailable}，运行时会保持原色。` : "基准色位于色相范围中间。"}><Slider compact showInput={false} label="色相跨度" value={config.hueSpread} min={0} max={360} defaultValue={140} onChange={(hueSpread) => onUpdate({ hueSpread })} /></Field> : null}
      <div className="border-t border-slate-100 pt-2"><SwitchRow label="渐变" description="单个字符内部由上到下过渡。" checked={config.gradient} onChange={(gradient) => onUpdate({ gradient })} />{config.gradient ? <div className="mt-2"><Field label="渐变止色" value={config.gradientTo}><ColorField compact value={config.gradientTo} palette={COLORS} label="渐变止色" onChange={(gradientTo) => onUpdate({ gradientTo })} /></Field></div> : null}</div>
    </InnerSection>
    <InnerSection title="字形" description="粗细、字体、发光、拖尾" summary={`${config.fontWeight}${config.glow ? " · 发光" : ""}${config.trail ? " · 拖尾" : ""}`}>
      <div className="grid grid-cols-2 gap-2"><Field label="粗细"><Select value={config.fontWeight} onChange={(fontWeight) => onUpdate({ fontWeight })} options={["标准", "中等", "半粗", "加粗"]} /></Field><Field label="字体"><Select value={config.fontFamily} onChange={(fontFamily) => onUpdate({ fontFamily })} options={FONTS.map(({ value }) => value)} /></Field></div>
      <div className="border-t border-slate-100 pt-2"><SwitchRow label="发光" description="浅色桌面上更容易看清。" checked={config.glow} onChange={(glow) => onUpdate({ glow })} />{config.glow ? <Field label="发光半径" value={`${config.glowRadius} px`}><Slider compact showInput={false} label="发光半径" value={config.glowRadius} min={1} max={30} onChange={(glowRadius) => onUpdate({ glowRadius })} /></Field> : null}</div>
      <div className="border-t border-slate-100 pt-2"><SwitchRow label="拖尾" description="留下几个逐渐变淡的残影，不计入最大同显。" checked={config.trail} onChange={(trail) => onUpdate({ trail })} />{config.trail ? <Field label="残影数" value={`${config.trailLength} 个`}><Slider compact showInput={false} label="残影数" value={config.trailLength} min={1} max={6} onChange={(trailLength) => onUpdate({ trailLength })} /></Field> : null}</div>
    </InnerSection>
    <InnerSection title="调制" description="打字越快，效果越强" summary={config.typingCombo ? `开 · ${config.comboGain}%` : "关闭"}>
      <SwitchRow label="启用节奏调制" checked={config.typingCombo} onChange={(typingCombo) => onUpdate({ typingCombo })} />
      {config.typingCombo ? <><Field label="强度" value={`${config.comboGain}%`} note="100% 是运行时基准系数；连击最高 5 级。"><Slider compact showInput={false} label="节奏调制强度" value={config.comboGain} min={0} max={200} defaultValue={100} onChange={(comboGain) => onUpdate({ comboGain })} /></Field><div className="border-t border-slate-100 pt-2"><span className="text-xs font-medium text-slate-600">作用于</span><SwitchRow label="字号" checked={config.comboScale} onChange={(comboScale) => onUpdate({ comboScale })} /><SwitchRow label="不透明度" checked={config.comboOpacity} onChange={(comboOpacity) => onUpdate({ comboOpacity })} /><SwitchRow label="发光（3 级以上）" checked={config.comboGlow} onChange={(comboGlow) => onUpdate({ comboGlow })} /></div></> : null}
    </InnerSection>
    <InnerSection title="精调" description="时长、缓动、节流上限" summary={`${config.duration} ms`}>
      <Field label="动画风格"><Segmented fill ariaLabel="动画风格" value={config.animationStyle} onChange={(animationStyle) => onUpdate({ animationStyle })} options={[{ value: "bounce", label: "弹跳" }, { value: "raindrop", label: "雨滴" }]} /></Field>
      <Field label="持续时长" value={`${config.duration} ms`}><Slider compact showInput={false} label="持续时长" value={config.duration} min={200} max={2000} defaultValue={defaultKeyFeedbackConfig.duration} onChange={(duration) => onUpdate({ duration })} /></Field>
      <Field label="入场缓动"><Select value={config.easing} onChange={(easing) => onUpdate({ easing })} options={EASING_NAMES} /></Field>
      <Field label="消散方式"><Select value={config.exitStyle} onChange={(exitStyle) => onUpdate({ exitStyle })} options={[{ value: "fade", label: "淡出" }, { value: "shrink", label: "缩小" }, { value: "rise", label: "上浮" }, { value: "blur", label: "模糊" }]} /></Field>
      <Field label="同键冷却" value={`${config.cooldownMs} ms`}><Slider compact showInput={false} label="同键冷却" value={config.cooldownMs} min={0} max={500} defaultValue={35} onChange={(cooldownMs) => onUpdate({ cooldownMs })} /></Field>
      <Field label="最大同显" value={`${config.maxSimultaneous} 个`}><Slider compact showInput={false} label="最大同显" value={config.maxSimultaneous} min={1} max={50} defaultValue={30} onChange={(maxSimultaneous) => onUpdate({ maxSimultaneous })} /></Field>
    </InnerSection>
  </div>;
}

const EDGE_LABELS = { bottom: "下", top: "上", left: "左", right: "右" } as const;

export function KeyboardGroup({ title, description, children, className }: { title: string; description: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return <section className={cn("keyboard-config-group", className)}><button type="button" className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm hover:bg-slate-50" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span><span className="block text-sm font-semibold text-slate-900">{title}</span><span className="mt-0.5 block text-xs text-slate-500">{description}</span></span><ChevronDown className={cn("size-4 shrink-0 text-slate-500 transition-transform", open && "rotate-180")} /></button>{open ? <div className="mt-2.5">{children}</div> : null}</section>;
}

export function AccessibilityNotice({ onOpenSettings }: { onOpenSettings?: () => void }) {
  return <div className="mb-2.5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-amber-600" /><div className="min-w-0"><div className="text-xs font-medium text-amber-900">仅预览模式 · 需要辅助功能权限</div><p className="mt-1 text-xs leading-relaxed text-amber-800/80">授权前动效只在下方预览里生效，桌面上不会出现。预览不需要权限，可以先把外观调好。</p>{onOpenSettings ? <button type="button" className="mt-2 text-xs font-medium text-amber-900 underline underline-offset-2" onClick={onOpenSettings}>打开系统设置 → 隐私与安全 → 辅助功能</button> : null}</div></div>;
}
