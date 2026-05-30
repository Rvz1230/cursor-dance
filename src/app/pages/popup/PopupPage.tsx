import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, CircleDashed, Play, Settings, Sparkles, Type, Volume2, Wand2 } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { ICON_OPTIONS } from "../theme-workbench/model/workbenchSchema";
import { usePopupState } from "./usePopupState";

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
  return s;
}

function particleDirLabel(dir) {
  const map = { "四周扩散": "扩散", up: "向上", down: "向下", left: "向左", right: "向右" };
  return map[dir] || "扩散";
}

// ── style icon maps (matched to content script enum) ─────────

const PARTICLE_ICONS = {
  "点状粒子": "●", 火花: "✦", "碎屑粒子": "◆",
  星光: "★", 钻石: "◇", 心形: "♡", 方块: "▣", 三角: "▲",
};

const RIPPLE_ICONS = {
  "单环": "○", 双环: "◎", "柔和面波": "◉",
  "脉冲波纹": "⦿", "回声环": "☯", "能量脉冲": "⚡",
};

// ── Toggle ────────────────────────────────────────────────────

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

// ── effect chips (type-distinct visual) ─────────────────────

function ParticleBlock({ ac, accent }) {
  if (!ac?.particle) return null;
  const style = ac.particleStyle || "点状粒子";
  const count = ac.particleCount || 0;
  const dir = particleDirLabel(ac.particleDirection);

  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium"
      style={{ backgroundColor: `${accent}12`, color: accent }}
    >
      <Sparkles className="size-3.5" />
      <span>{style}</span>
      <span className="text-[9px] opacity-60">·</span>
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
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium"
      style={{ boxShadow: `inset 0 0 0 1px ${accent}28`, color: accent }}
    >
      <CircleDashed className="size-3.5" />
      <span>{style}</span>
      <span className="text-[9px] opacity-60">·</span>
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
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium"
      style={{ backgroundColor: `${color}10`, color }}
    >
      <Type className="size-3.5" />
      <span className="font-medium truncate max-w-[80px]">"{text}"</span>
      {size > 0 && <><span className="text-[9px] opacity-60">·</span><span className="tabular-nums">{size}px</span></>}
    </span>
  );
}

function SoundBlock({ ac }) {
  if (!ac?.sound) return null;
  const vol = ac.soundVolume != null ? ac.soundVolume : 0;

  return (
    <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium bg-slate-100 text-slate-500">
      <Volume2 className="size-3.5" />
      <span className="tabular-nums">{vol}%</span>
    </span>
  );
}

// ── HeroPreview — visual centerpiece ────────────────────────

function HeroPreview({ actionConfig, accent, Icon: ThemeIcon }) {
  const text = actionConfig?.textContent;
  const hasText = actionConfig?.textEnabled && text;

  const pStyle = actionConfig?.particle ? (actionConfig.particleStyle || "点状粒子") : null;
  const pIcon = pStyle ? (PARTICLE_ICONS[pStyle] || "●") : null;

  const showIcon = !hasText && !pIcon;

  if (!hasText && !pIcon && !ThemeIcon) return <div className="flex-1 min-h-0" />;

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center">
      {hasText ? (
        <span
          className="text-[28px] font-bold leading-none select-none"
          style={{ color: accent, textShadow: `0 2px 12px ${accent}22` }}
        >
          {text.length > 10 ? text.slice(0, 10) + "…" : text}
        </span>
      ) : pIcon ? (
        <span
          className="text-[32px] leading-none select-none"
          style={{ color: accent, opacity: 0.6 }}
        >
          {pIcon}
        </span>
      ) : (
        <ThemeIcon className="size-10" style={{ color: accent, opacity: 0.35 }} />
      )}
    </div>
  );
}

// ── IdentityCard ─────────────────────────────────────────────

function IdentityCard({ actionConfig, accent, name, Icon: ThemeIcon }) {
  const tags = effectSummary(actionConfig);
  const hasEffects = tags.length > 0;

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

      {/* accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: accent }}
      />

      <div className="flex h-full flex-col px-4 py-3.5">
        {/* theme icon + name — always visible */}
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${accent}14` }}
          >
            <ThemeIcon className="size-[15px]" style={{ color: accent }} />
          </div>
          <h2 className="text-sm font-bold truncate" style={{ color: accent }}>{name}</h2>
        </div>

        {!hasEffects ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2">
            <p className="text-xs text-slate-400">暂无特效配置</p>
            <p className="text-[10px] text-slate-300">可前往工作台配置效果</p>
          </div>
        ) : (
          <>
            {/* hero preview — visual centerpiece */}
            <HeroPreview actionConfig={actionConfig} accent={accent} Icon={ThemeIcon} />

            {/* effect chips — 2-column grid */}
            {(actionConfig?.particle || actionConfig?.ripple || actionConfig?.textEnabled || actionConfig?.sound) && (
              <div className="shrink-0 grid grid-cols-2 gap-1 mt-2">
                <ParticleBlock ac={actionConfig} accent={accent} />
                <RippleBlock ac={actionConfig} accent={accent} />
                <TextBlock ac={actionConfig} />
                <SoundBlock ac={actionConfig} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
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
                    className="text-base font-bold"
                    style={{ color: active ? tAccent : "#94a3b8" }}
                  >
                    {t.name.length <= 2 ? t.name : t.name.slice(0, 2)}
                  </span>
                )}
              </div>
              <span
                className="text-[9px] font-semibold"
                style={{
                  color: active ? tAccent : "#cbd5e1",
                  opacity: active ? 1 : 0,
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
              className="absolute left-0.5 z-10 flex size-6 items-center justify-center rounded-full bg-white/80 shadow-sm ring-1 ring-slate-200 backdrop-blur-sm hover:bg-white active:scale-[0.95]"
            >
              <ChevronLeft className="size-3 text-slate-500" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelect(themes[(idx + 1 + n) % n].id); }}
              aria-label="下一个主题"
              className="absolute right-0.5 z-10 flex size-6 items-center justify-center rounded-full bg-white/80 shadow-sm ring-1 ring-slate-200 backdrop-blur-sm hover:bg-white active:scale-[0.95]"
            >
              <ChevronRight className="size-3 text-slate-500" />
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
                width: i === idx ? 5 : 2.5,
                height: i === idx ? 5 : 2.5,
                backgroundColor: i === idx ? accent : "#d1d5db",
                opacity: i === idx ? 1 : 0.4,
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
    ready, enabled,
    setEnabled, setThemeId, openOptionsPage, previewCurrentTheme,
    activeThemeChoice, themeChoices, busyKey,
  } = usePopupState();

  const [previewingId, setPreviewingId] = useState(null);

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
      setThemeId(themeId);
    },
    [activeId, setThemeId]
  );

  const handlePreview = useCallback(async () => {
    if (busyKey || previewingId) return;
    setPreviewingId("previewing");
    try { await previewCurrentTheme(); } catch {}
    setTimeout(() => setPreviewingId(null), 600);
  }, [busyKey, previewingId, previewCurrentTheme]);

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
        <span className="text-[13px] font-bold text-slate-900">CursorDance</span>
        <div className="ml-auto flex items-center">
          <Toggle checked={enabled} onChange={setEnabled} />
        </div>
      </header>

      {/* ── identity card ── */}
      <div className="flex-1 min-h-0 px-4 pt-2 pb-2">
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
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                <p className="text-xs text-slate-400">还没有主题，去工作台创建一个</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

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
          className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 active:scale-[0.97]"
          aria-label="打开工作台"
        >
          <Settings className="size-3.5" />
          工作台
        </button>
        <button
          type="button"
          onClick={handlePreview}
          disabled={busyKey === "preview" || busyKey === "theme" || previewingId != null || !enabled}
          className="flex h-9 items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold text-white shadow-sm transition-colors active:scale-[0.97] disabled:opacity-40"
          aria-label="预览当前主题效果"
          style={{
            backgroundColor: enabled && !busyKey ? accent : "#94a3b8",
          }}
        >
          <Play className="size-3.5" />
          {busyKey === "preview" ? "预览中…" : "预览效果"}
        </button>
      </footer>
    </div>
  );
}
