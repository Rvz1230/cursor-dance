import { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, CircleDashed, ImagePlus, Loader2, Monitor, MousePointer2, Settings, Sparkles, Type, Volume2, Wand2, X } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { ICON_OPTIONS } from "../theme-workbench/model/workbenchSchema";
import { usePopupState } from "./usePopupState";
import AnimatedPreview from "./AnimatedPreview";

// ═══════════════════════════════════════════════════════════════
// "Theme Identity" — shows what makes each theme unique
// ═══════════════════════════════════════════════════════════════

const W = 360;
const H = 540;

// ── helpers ───────────────────────────────────────────────────

function themeIcon(theme) {
  if (!theme?.icon) return Wand2;
  return ICON_OPTIONS.find((opt) => opt.name === theme.icon)?.Icon || Wand2;
}

function themeAccent(ac) {
  if (ac?.particlePalette?.[0]) return ac.particlePalette[0];
  if (ac?.rippleColor) return ac.rippleColor;
  if (ac?.textColor) return ac.textColor;
  return "#94A3B8";
}

function effectSummary(ac) {
  if (!ac) return [];
  const s = [];
  if (ac.textEnabled) s.push("飘字");
  if (ac.ripple) s.push("波纹");
  if (ac.particle) s.push("粒子");
  if (ac.sound) s.push("音效");
  if (ac.animationEnabled) s.push("动效");
  if (ac.imageEnabled) s.push("图片");
  if (ac.cursorGlowColor?.trim()) s.push("光晕");
  return s;
}

function particleDirLabel(dir) {
  const map = { "四周扩散": "扩散", up: "向上", down: "向下", left: "向左", right: "向右" };
  return map[dir] || "扩散";
}

// ── effect chips (grouped: Motion / Feedback) ────────────────

function ParticleBlock({ ac, accent }) {
  if (!ac?.particle) return null;
  const style = ac.particleStyle || "点状粒子";
  const count = ac.particleCount || 0;
  const dir = particleDirLabel(ac.particleDirection);

  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-medium"
      style={{ backgroundColor: `${accent}12`, color: accent }}
    >
      <Sparkles className="size-3.5" />
      <span>{style}</span>
      <span className="text-2xs opacity-60">·</span>
      <span className="tabular-nums">{count}</span>
      <span className="opacity-60">{dir}</span>
    </span>
  );
}

function RippleBlock({ ac, accent }) {
  if (!ac?.ripple) return null;
  const style = ac.rippleStyle || "单环";
  const size = ac.rippleSize || 0;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-medium"
      style={{ boxShadow: `inset 0 0 0 1px ${accent}28`, color: accent }}
    >
      <CircleDashed className="size-3.5" />
      <span>{style}</span>
      <span className="text-2xs opacity-60">·</span>
      <span className="tabular-nums">{size}px</span>
    </span>
  );
}

function TextBlock({ ac }) {
  if (!ac?.textEnabled) return null;
  const text = ac.textContent || "✦";
  const color = ac.textColor || "#94A3B8";
  const size = ac.textSize || 0;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-medium"
      style={{ backgroundColor: `${color}10`, color }}
    >
      <Type className="size-3.5" />
      <span className="font-medium truncate max-w-[72px]">"{text}"</span>
      {size > 0 && <><span className="text-2xs opacity-60">·</span><span className="tabular-nums">{size}px</span></>}
    </span>
  );
}

function SoundBlock({ ac }) {
  if (!ac?.sound) return null;
  const vol = ac.volume != null ? ac.volume : 0;

  return (
    <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-medium bg-slate-100 text-slate-500">
      <Volume2 className="size-3.5" />
      <span className="tabular-nums">{vol}%</span>
    </span>
  );
}

function AnimationBlock({ ac, accent }) {
  if (!ac?.animationEnabled) return null;
  const style = ac.animationStyle || "聚焦脉冲";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-medium"
      style={{ backgroundColor: `${accent}12`, color: accent }}
    >
      <Wand2 className="size-3.5" />
      <span>{style}</span>
    </span>
  );
}

function ImageBlock({ ac, accent }) {
  if (!ac?.imageEnabled) return null;
  const size = ac.imageSize || 56;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-medium"
      style={{ boxShadow: `inset 0 0 0 1px ${accent}28`, color: accent }}
    >
      <ImagePlus className="size-3.5" />
      <span>图片</span>
      <span className="text-2xs opacity-60">·</span>
      <span className="tabular-nums">{size}px</span>
    </span>
  );
}

function CursorFeedbackBlock({ ac, accent }) {
  const hasGlow = ac?.cursorGlowColor?.trim();
  const hasShake = ac?.shake;
  const hasTrail = ac?.cursorTrailEnabled;
  if (!hasGlow && !hasShake && !hasTrail) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-medium"
      style={{ backgroundColor: `${accent}08`, color: accent }}
    >
      <MousePointer2 className="size-3.5" />
      {hasGlow && <span>光晕</span>}
      {hasShake && !hasGlow && <span>震动</span>}
      {hasTrail && !hasGlow && !hasShake && <span>拖尾</span>}
    </span>
  );
}

// ── BubbleBackground — breathing background orbs ─────────────

function BubbleBackground({ accent }) {
  const bubbles = useMemo(() => {
    const seed = [...accent].reduce((a, c) => a + c.charCodeAt(0), 1);
    // sine hash — reliably uniform, no linear correlation
    const r = (i) => {
      const x = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    return Array.from({ length: 14 }, (_, i) => ({
      left: r(i * 7 + 1) * 92 + 4,
      top: r(i * 11 + 3) * 86 + 5,
      size: 4 + r(i * 13 + 5) * 72,
      opacityBase: 0.008 + r(i * 17 + 7) * 0.05,
      opacityPeak: 0.02 + r(i * 19 + 9) * 0.10,
      floatDuration: 10 + r(i * 23 + 11) * 18,
      floatAmount: 3 + r(i * 29 + 13) * 11,
      breathAmount: 0.02 + r(i * 31 + 15) * 0.07,
      initX: -6 + r(i * 37 + 17) * 12,
      initY: -6 + r(i * 41 + 19) * 12,
      delay: r(i * 43 + 21) * 10,
    }));
  }, [accent]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bubbles.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: b.size,
            height: b.size,
            left: `${b.left}%`,
            top: `${b.top}%`,
            backgroundColor: accent,
          }}
          animate={{
            x: [b.initX, b.initX - b.floatAmount * 0.5, b.initX + b.floatAmount * 0.6, b.initX - b.floatAmount * 0.4, b.initX],
            y: [b.initY, b.initY - b.floatAmount * 0.6, b.initY + b.floatAmount * 0.4, b.initY + b.floatAmount * 0.5, b.initY],
            scale: [1, 1 + b.breathAmount, 1 - b.breathAmount * 0.4, 1 + b.breathAmount * 0.3, 1],
            opacity: [b.opacityBase, b.opacityPeak, b.opacityBase * 0.5, b.opacityPeak * 0.7, b.opacityBase],
          }}
          transition={{
            duration: b.floatDuration,
            repeat: Infinity,
            delay: b.delay,
            ease: "easeInOut",
            times: [0, 0.25, 0.5, 0.75, 1],
          }}
        />
      ))}
    </div>
  );
}

// ── IdentityCard ─────────────────────────────────────────────

function IdentityCard({ actionConfig, accent, name, Icon: ThemeIcon, siteAction }) {
  const tags = effectSummary(actionConfig);
  const hasEffects = tags.length > 0;
  const hasSiteRule = siteAction?.enable;

  return (
    <div
      className="relative h-full overflow-hidden rounded-2xl border border-slate-200/80 shadow-sm"
      style={{ backgroundColor: `${accent}06` }}
    >
      {/* bg blob */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full opacity-[0.04]"
        style={{ backgroundColor: accent }}
      />

      {/* breathing bubbles */}
      <BubbleBackground accent={accent} />

      {/* accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: accent }}
      />

      <div className="flex h-full flex-col px-4 py-2">
        {/* theme icon + name + site badge — always visible */}
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${accent}14` }}
          >
            <ThemeIcon className="size-[15px]" style={{ color: accent }} />
          </div>
          <h2 className="text-base font-semibold truncate" style={{ color: accent }}>{name}</h2>
          {hasSiteRule && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-2xs font-medium text-slate-500">
              <Monitor className="size-2.5" />
              站点规则
            </span>
          )}
        </div>

        {!hasEffects ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2">
            <p className="text-xs text-slate-400">暂无特效配置</p>
            <p className="text-2xs text-slate-400">可前往工作台配置效果</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col min-h-0 pt-2 gap-2">
            {/* animated preview — compact */}
            <div className="flex-1 min-h-0 flex items-center justify-center">
              <AnimatedPreview actionConfig={actionConfig} accent={accent} />
            </div>

            {/* effect groups */}
            <div className="shrink-0 space-y-1">
              {/* Motion group */}
              {(actionConfig?.particle || actionConfig?.ripple || actionConfig?.animationEnabled) && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-xs font-semibold text-slate-400">动效</span>
                  <div className="flex flex-wrap gap-1">
                    <ParticleBlock ac={actionConfig} accent={accent} />
                    <RippleBlock ac={actionConfig} accent={accent} />
                    <AnimationBlock ac={actionConfig} accent={accent} />
                  </div>
                </div>
              )}
              {/* Feedback group */}
              {(actionConfig?.textEnabled || actionConfig?.sound || actionConfig?.imageEnabled || actionConfig?.cursorGlowColor?.trim() || actionConfig?.shake || actionConfig?.cursorTrailEnabled) && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold text-xs font-semibold text-slate-400">反馈</span>
                  <div className="flex flex-wrap gap-1">
                    <TextBlock ac={actionConfig} />
                    <SoundBlock ac={actionConfig} />
                    <ImageBlock ac={actionConfig} accent={accent} />
                    <CursorFeedbackBlock ac={actionConfig} accent={accent} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="全局开关"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-150 ease-out",
        checked ? "bg-slate-900" : "bg-slate-200"
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="inline-block size-4 rounded-full bg-white shadow-sm"
        style={{ x: checked ? 18 : 2 }}
      />
    </button>
  );
}

// ── NoticeBar ─────────────────────────────────────────────────

function NoticeBar({ notice, onDismiss }) {
  if (!notice) return null;
  const bgMap = { slate: "bg-slate-50", amber: "bg-amber-50", rose: "bg-rose-50" };
  const textMap = { slate: "text-slate-500", amber: "text-amber-700", rose: "text-rose-700" };
  const dotMap = { slate: "bg-slate-400", amber: "bg-amber-500", rose: "bg-rose-500" };
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className={cn("mx-4 mb-1 flex items-center gap-2 rounded-lg px-3 py-1.5", bgMap[notice.tone] || bgMap.slate)}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", dotMap[notice.tone])} />
      <span className={cn("text-2xs leading-tight", textMap[notice.tone])}>{notice.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-auto shrink-0 rounded p-0.5 opacity-40 transition-opacity hover:opacity-100"
        aria-label="关闭提示"
      >
        <X className="size-3" />
      </button>
    </motion.div>
  );
}

// ── Carousel ──────────────────────────────────────────────────

const CARD_SIZE = 56;
const CARD_GAP = 52;

function ThemeCarousel({ themes, activeId, onSelect, accent }) {
  const n = themes.length;
  const idx = Math.max(0, themes.findIndex((t) => t.id === activeId));

  if (!activeId || n === 0) return null;

  return (
    <div className="relative flex flex-col items-center" role="region" aria-label="主题轮播">
      <div className="relative flex h-[76px] w-full items-center justify-center overflow-hidden">
        {themes.map((t, i) => {
          let raw = i - idx;
          if (raw > n / 2) raw -= n;
          if (raw < -n / 2) raw += n;
          if (Math.abs(raw) > 2) return null;
          const active = raw === 0;
          const tAccent = themeAccent(t.actionConfig);
          const CardIcon = t.icon ? themeIcon(t) : null;

          return (
            <motion.button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              aria-label={`切换到 ${t.name}`}
              animate={{
                x: raw * CARD_GAP,
                scale: active ? 1 : 0.78,
                opacity: active ? 1 : Math.abs(raw) === 1 ? 0.4 : 0.15,
                zIndex: active ? 10 : 1,
                rotateY: raw * 22,
              }}
              transition={{ type: "spring", stiffness: 160, damping: 26 }}
              className="absolute flex shrink-0 flex-col items-center gap-1"
            >
              <div
                className="flex items-center justify-center rounded-xl"
                style={{
                  width: CARD_SIZE,
                  height: CARD_SIZE,
                  ...(active
                    ? {
                        backgroundColor: `${tAccent}10`,
                        boxShadow: `0 0 0 1.5px ${tAccent}28, 0 4px 12px ${tAccent}12`,
                      }
                    : {
                        backgroundColor: "#f1f5f9",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      }),
                }}
              >
                {CardIcon ? (
                  <CardIcon className="size-5" style={{ color: active ? tAccent : "#94a3b8" }} />
                ) : (
                  <span
                    className="text-base font-semibold"
                    style={{ color: active ? tAccent : "#94a3b8" }}
                  >
                    {t.name.length <= 2 ? t.name : t.name.slice(0, 2)}
                  </span>
                )}
              </div>
              <span
                className="text-xs font-semibold"
                style={{
                  color: active ? tAccent : "#cbd5e1",
                  opacity: active ? 1 : Math.abs(raw) <= 1 ? 0.6 : 0,
                }}
              >
                {t.name}
              </span>
            </motion.button>
          );
        })}

        {n > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelect(themes[(idx - 1 + n) % n].id); }}
              aria-label="上一个主题"
              className="absolute left-0.5 z-10 flex size-7 items-center justify-center rounded-full bg-white/80 shadow-sm ring-1 ring-slate-200 backdrop-blur-sm hover:bg-white active:scale-[0.95]"
            >
              <ChevronLeft className="size-3.5 text-slate-500" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelect(themes[(idx + 1 + n) % n].id); }}
              aria-label="下一个主题"
              className="absolute right-0.5 z-10 flex size-7 items-center justify-center rounded-full bg-white/80 shadow-sm ring-1 ring-slate-200 backdrop-blur-sm hover:bg-white active:scale-[0.95]"
            >
              <ChevronRight className="size-3.5 text-slate-500" />
            </button>
          </>
        )}
      </div>

      {n > 1 && (
        <div className="flex items-center gap-1 pt-1">
          {themes.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`第 ${i + 1} 个主题`}
              onClick={() => onSelect(themes[i].id)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === idx ? 6 : 3,
                height: i === idx ? 6 : 3,
                backgroundColor: i === idx ? accent : "#cbd5e1",
                opacity: i === idx ? 1 : 0.5,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Loading ──────────────────────────────────────────────────

function LoadingShell() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-white">
      <div className="size-6 animate-pulse rounded-full bg-slate-100" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PopupPage
// ═══════════════════════════════════════════════════════════════

export default function PopupPage() {
  const {
    ready, enabled, notice,
    setEnabled, setThemeId, openOptionsPage, previewCurrentTheme,
    activeThemeChoice, themeChoices, busyKey, siteAction,
  } = usePopupState();

  const [previewingId, setPreviewingId] = useState(null);
  const [dismissedNotice, setDismissedNotice] = useState(null);

  // auto-dismiss notice after 6s
  const effectiveNotice = dismissedNotice === true ? null : notice;

  // ── derived data ──
  const activeId = activeThemeChoice?.theme?.id;
  const current = activeThemeChoice;

  // flatten for carousel (needs flat { id, name, icon } access)
  const carouselThemes = useMemo(
    () => themeChoices.map((c) => ({
      id: c.theme.id,
      name: c.theme.name,
      icon: c.theme.icon,
      actionConfig: c.actionConfig,
    })),
    [themeChoices]
  );

  const accent = themeAccent(current?.actionConfig);

  // ── handlers ──
  const switchTo = useCallback(
    (themeId) => {
      if (themeId === activeId) return;
      void setThemeId(themeId);
    },
    [activeId, setThemeId]
  );

  const handlePreview = useCallback(async () => {
    if (busyKey || previewingId) return;
    setPreviewingId("previewing");
    try { await previewCurrentTheme(); } catch {}
    setTimeout(() => setPreviewingId(null), 600);
  }, [busyKey, previewingId, previewCurrentTheme]);

  // reset dismiss when notice changes
  const prevNoticeRef = useRef(null);
  if (notice !== prevNoticeRef.current) {
    prevNoticeRef.current = notice;
    if (dismissedNotice) setDismissedNotice(false);
  }

  if (!ready) return <LoadingShell />;

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden bg-white"
      style={{
        width: W, height: H,
        fontFamily: '"SF Pro Display","SF Pro Text","PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif',
      }}
    >
      {/* ── header ── */}
      <header className="flex shrink-0 items-center gap-2 px-4 pt-3.5 pb-2">
        <img src="logo.svg" alt="" className="size-6 rounded-md" />
        <span className="text-base font-semibold text-slate-900">CursorDance</span>
        <div className="ml-auto flex items-center">
          <Toggle checked={enabled} onChange={setEnabled} />
        </div>
      </header>

      {/* ── notice bar ── */}
      <AnimatePresence>
        {effectiveNotice && (
          <NoticeBar notice={effectiveNotice} onDismiss={() => setDismissedNotice(true)} />
        )}
      </AnimatePresence>

      {/* ── identity card ── */}
      <div className={cn("flex-1 min-h-0 px-4 pt-1.5 pb-2", !enabled && "opacity-35")}>
        <AnimatePresence mode="wait">
          <motion.div
            key={current?.theme?.id || "empty"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="h-full"
          >
            {current ? (
              <IdentityCard
                actionConfig={current.actionConfig}
                accent={accent}
                name={current.theme.name}
                Icon={themeIcon(current.theme)}
                siteAction={siteAction}
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <p className="text-xs text-slate-400">还没有主题，去工作台创建一个</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── disabled overlay label ── */}
      {!enabled && (
        <div className="absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center pointer-events-none">
          <span className="rounded-full bg-white/80 px-3 py-1 text-2xs font-semibold text-slate-400 shadow-sm ring-1 ring-slate-200/60 backdrop-blur-sm">
            全局特效已暂停
          </span>
        </div>
      )}

      {/* ── carousel ── */}
      {carouselThemes.length > 0 && (
        <div className="shrink-0 px-2 pb-1">
          <ThemeCarousel
            themes={carouselThemes}
            activeId={activeId}
            onSelect={switchTo}
            accent={accent}
          />
        </div>
      )}

      {/* ── footer ── */}
      <footer className="shrink-0 grid grid-cols-2 gap-2.5 px-4 pb-4">
        <button
          type="button"
          onClick={openOptionsPage}
          className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 active:scale-[0.97]"
          aria-label="打开工作台"
        >
          <Settings className="size-3.5" />
          工作台
        </button>
        <button
          type="button"
          onClick={handlePreview}
          disabled={busyKey === "preview" || busyKey === "theme" || previewingId != null || !enabled}
          className="flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-medium text-white shadow-sm transition-colors active:scale-[0.97] disabled:opacity-40"
          aria-label="在标签页预览"
          style={{
            backgroundColor: enabled && !busyKey ? accent : "#94a3b8",
          }}
        >
          {busyKey === "preview" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Monitor className="size-3.5" />
          )}
          {busyKey === "preview" ? "发送中…" : "预览至页面"}
        </button>
      </footer>
    </div>
  );
}
