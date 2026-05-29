import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ChevronLeft, ChevronRight, Play, Settings, Zap } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { createBuiltinCursorAsset } from "../theme-workbench/lib/cursorAssetPresets";
import { usePopupState } from "./usePopupState";
import { previewThemePack } from "../theme-workbench/lib/extensionStorage";

// ═══════════════════════════════════════════════════════════════
// "Quick Switch v4" — theme detail card + coverflow carousel
// ═══════════════════════════════════════════════════════════════

const W = 360;
const H = 540;
const FALLBACK = createBuiltinCursorAsset("default", "system");

// ── helpers ───────────────────────────────────────────────────

function cursorUrl(pack, stateId = "default") {
  return pack?.cursorStates?.[stateId]?.imageDataUrl || FALLBACK.imageDataUrl;
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

// ── build detail rows from action config ──────────────────────

const DIR_LABELS = { spread: "扩散", up: "向上", down: "向下", left: "向左", right: "向右" };

function buildDetails(ac) {
  if (!ac) return [];
  const items = [];

  if (ac.textEnabled) {
    items.push({
      key: "text",
      icon: "T",
      label: "飘字反馈",
      values: [
        ac.textContent ? `"${ac.textContent.slice(0, 6)}"` : null,
        ac.textSize ? `${ac.textSize}px` : null,
      ].filter(Boolean),
      color: ac.textColor || undefined,
    });
  }
  if (ac.ripple) {
    items.push({
      key: "ripple",
      icon: "◉",
      label: "波纹反馈",
      values: [
        ac.rippleSize ? `${ac.rippleSize}px` : null,
        ac.rippleDuration ? `${ac.rippleDuration}ms` : null,
      ].filter(Boolean),
      color: ac.rippleColor || undefined,
    });
  }
  if (ac.particle) {
    const dir = DIR_LABELS[ac.particleDirection] || null;
    items.push({
      key: "particle",
      icon: "◆",
      label: "粒子反馈",
      values: [
        ac.particleShape || null,
        ac.particleCount ? `${ac.particleCount}个` : null,
        dir,
      ].filter(Boolean),
      color: ac.particlePalette?.[0] || undefined,
    });
  }
  if (ac.sound) {
    const file = ac.soundFile ? ac.soundFile.replace(/\.[^.]+$/, "") : null;
    items.push({
      key: "sound",
      icon: "♪",
      label: "音频反馈",
      values: [
        file ? (file.length > 12 ? file.slice(0, 11) + "…" : file) : null,
        ac.soundVolume != null ? `${ac.soundVolume}%` : null,
      ].filter(Boolean),
      color: undefined,
    });
  }

  return items;
}

// ── ThemeDetail — replaces the old preview canvas ─────────────

function ThemeDetail({ actionConfig, cursorImg, accent }) {
  const details = buildDetails(actionConfig);
  const noop = details.length === 0;

  return (
    <div className="relative h-full w-full" style={{ perspective: "600px" }}>
      {/* ── outer 3D card shell ── */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: "linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.9) 100%)",
          boxShadow: [
            "0 1px 2px rgba(0,0,0,0.04)",
            "0 4px 8px rgba(0,0,0,0.04)",
            "0 8px 24px rgba(0,0,0,0.06)",
            "0 0 0 1px rgba(0,0,0,0.05)",
          ].join(", "),
          transform: "rotateX(1.5deg)",
          transformOrigin: "center center",
        }}
      />
      {/* ── top highlight ── */}
      <div
        className="absolute inset-x-3 top-0 z-10 h-px rounded-full"
        style={{ background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 20%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0.6) 80%, transparent 100%)" }}
      />

      {/* ── inner content ── */}
      <div className="relative mx-auto mt-1.5 flex h-[calc(100%-7px)] w-[calc(100%-10px)] flex-col items-center justify-center rounded-xl bg-slate-50/80 px-5 py-3">
        {noop ? (
          <span className="text-xs text-slate-400">暂无特效配置</span>
        ) : (
          <>
            {/* cursor icon + accent glow */}
            <div className="relative mb-3 flex items-center justify-center">
              <div
                className="absolute size-14 rounded-full blur-xl"
                style={{ backgroundColor: accent, opacity: 0.18 }}
              />
              <div
                className="absolute size-10 rounded-full blur-md"
                style={{ backgroundColor: accent, opacity: 0.1 }}
              />
              <img
                src={cursorImg}
                alt=""
                className="relative size-11 object-contain drop-shadow-sm"
              />
            </div>

            {/* detail rows */}
            <div className="w-full space-y-1.5">
              {details.map((d) => (
                <div
                  key={d.key}
                  className="flex items-center gap-2 rounded-lg bg-white/60 px-3 py-1.5"
                >
                  {/* icon */}
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-bold"
                    style={{
                      backgroundColor: d.color ? `${d.color}18` : `${accent}14`,
                      color: d.color || accent,
                    }}
                  >
                    {d.icon}
                  </span>
                  {/* label */}
                  <span className="text-[11px] font-medium text-slate-600">{d.label}</span>
                  {/* values */}
                  <span className="ml-auto text-[10px] tracking-tight text-slate-400">
                    {d.values.join(" · ")}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── ThemeCarousel — infinite 3D coverflow ──────────────────────

const CARD_SIZE = 60;
const CARD_GAP = 64; // center-to-center spacing

function ThemeCarousel({ themes, activeId, onSelect }) {
  const n = themes.length;
  const activeIdx = Math.max(0, themes.findIndex((t) => t.id === activeId));
  const active = themes[activeIdx];
  const accent = themeAccent(active?.actionConfig);

  if (!active) return null;

  return (
    <div
      className="relative flex h-[108px] items-center justify-center overflow-hidden"
      style={{ perspective: "900px" }}
    >
      {/* ── cards ── */}
      <AnimatePresence mode="popLayout">
        {themes.map((t, i) => {
          // signed offset from active — wrap for infinite loop
          let raw = i - activeIdx;
          if (raw > n / 2) raw -= n;
          if (raw < -n / 2) raw += n;

          const abs = Math.abs(raw);
          if (abs > 2) return null;

          const isActive = raw === 0;
          const img = cursorUrl(t.pack);
          const tAccent = themeAccent(t.actionConfig);

          // visual falloff — no blur, all cards crisp
          const scale = isActive ? 1 : abs === 1 ? 0.82 : 0.62;
          const opacity = isActive ? 1 : abs === 1 ? 0.5 : 0.22;
          const zIdx = 10 - abs;
          const rotY = raw * 28;

          return (
            <motion.button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{
                x: raw * CARD_GAP,
                scale,
                opacity,
                zIndex: zIdx,
                rotateY: rotY,
              }}
              exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.18 } }}
              transition={{ type: "spring", stiffness: 140, damping: 24 }}
              className="absolute flex shrink-0 flex-col items-center gap-1.5"
            >
            {/* card body */}
            <div
              className="flex items-center justify-center rounded-2xl transition-shadow duration-300"
              style={{
                width: CARD_SIZE,
                height: CARD_SIZE,
                ...(isActive
                  ? {
                      background: `linear-gradient(145deg, ${tAccent}18 0%, ${tAccent}08 100%)`,
                      boxShadow: [
                        `0 1px 3px rgba(0,0,0,0.04)`,
                        `0 6px 18px rgba(0,0,0,0.08)`,
                        `0 0 0 1px ${tAccent}20`,
                        `0 0 22px ${tAccent}10`,
                      ].join(", "),
                    }
                  : {
                      background: "linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%)",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.04)",
                    }),
              }}
            >
              <img src={img} alt="" className="max-h-[26px] max-w-[26px] object-contain" />
            </div>

            {/* label */}
            <span
              className="text-[11px] font-semibold tracking-tight"
              style={{ color: isActive ? tAccent : "#94a3b8" }}
            >
              {t.name.length > 4 ? t.name.slice(0, 4) : t.name}
            </span>

            {/* active dot */}
            {isActive && (
              <motion.div
                layoutId="carousel-dot"
                className="h-1 w-1 rounded-full"
                style={{ backgroundColor: accent }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
              />
            )}
          </motion.button>
        );
      })}
      </AnimatePresence>

      {/* ── navigation arrows ── */}
      {n > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(themes[(activeIdx - 1 + n) % n].id);
            }}
            className="absolute left-1 z-20 flex size-7 items-center justify-center rounded-full bg-white/85 shadow-sm ring-1 ring-slate-200 backdrop-blur-sm transition-all hover:bg-white"
          >
            <ChevronLeft className="size-3 text-slate-500" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(themes[(activeIdx + 1) % n].id);
            }}
            className="absolute right-1 z-20 flex size-7 items-center justify-center rounded-full bg-white/85 shadow-sm ring-1 ring-slate-200 backdrop-blur-sm transition-all hover:bg-white"
          >
            <ChevronRight className="size-3 text-slate-500" />
          </button>
        </>
      )}

      {/* ── dot indicators ── */}
      {n > 1 && (
        <div className="absolute bottom-1 z-20 flex items-center gap-1">
          {themes.map((_, i) => (
            <span
              key={i}
              className="block rounded-full transition-all duration-300"
              style={{
                width: i === activeIdx ? 5 : 3,
                height: i === activeIdx ? 5 : 3,
                backgroundColor: i === activeIdx ? accent : "#d1d5db",
                opacity: i === activeIdx ? 1 : 0.45,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── SiteBadge — only shown when there's a relevant rule ───────

function SiteBadge({ site, siteAction }) {
  if (!site.host) return null;
  const disabled = siteAction === "disable";
  const themed = siteAction?.enable && siteAction?.theme;

  // only show if the site has a non-default rule
  if (!disabled && !themed) return null;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-medium",
        disabled ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-700"
      )}
    >
      {disabled ? <AlertTriangle className="size-3" /> : <Zap className="size-3" />}
      {disabled ? `${site.host} 已禁用特效` : `${site.host} 已绑定专属主题`}
    </div>
  );
}

// ── Loading ───────────────────────────────────────────────────

function LoadingShell() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-white">
      <div className="size-6 animate-pulse rounded-full bg-slate-100" />
    </div>
  );
}

// ── PopupPage ─────────────────────────────────────────────────

export default function PopupPage() {
  const {
    ready, site, enabled, siteAction,
    hydrated, effectiveConfig,
    setEnabled, setThemeId, openOptionsPage,
  } = usePopupState();

  const [previewingId, setPreviewingId] = useState(null);

  // build theme data
  const themes = useMemo(() => {
    if (!hydrated) return [];
    return hydrated.themeLibrary.map((t) => {
      const pack = effectiveConfig?.themePacks?.find((p) => p.id === t.id) ?? null;
      const draft = hydrated.draftsByTheme?.[t.id];
      const ac = draft?.actionConfigs?.leftClick ?? null;
      return { ...t, pack, actionConfig: ac };
    });
  }, [hydrated, effectiveConfig]);

  const activeId = hydrated?.selection?.themeId;
  const current = themes.find((t) => t.id === activeId) ?? themes[0];
  const accent = themeAccent(current?.actionConfig);
  const effects = effectSummary(current?.actionConfig);

  const switchTo = useCallback(
    (themeId) => {
      if (themeId === activeId) return;
      setThemeId(themeId);
    },
    [activeId, setThemeId]
  );

  const previewCurrent = useCallback(async () => {
    if (!current?.pack || previewingId) return;
    setPreviewingId(current.id);
    try { await previewThemePack(current.id, current.pack, "leftClick"); } catch {}
    setTimeout(() => setPreviewingId(null), 600);
  }, [current, previewingId]);

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
        <span className="text-[13px] font-bold tracking-tight text-slate-900">CursorDance</span>
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          className={cn(
            "ml-auto flex h-7 items-center rounded-full px-3 text-[11px] font-semibold transition-all active:scale-95",
            enabled ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-400"
          )}
        >
          {enabled ? "已开启" : "已暂停"}
        </button>
      </header>

      {/* ── site rule badge (conditional) ── */}
      <div className="shrink-0 px-4 pb-1">
        <SiteBadge site={site} siteAction={siteAction} />
      </div>

      {/* ── theme detail card ── */}
      <div className="mx-4 flex-1 min-h-0" style={{ maxHeight: 196 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={current?.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="h-full w-full"
          >
            <ThemeDetail
              actionConfig={current?.actionConfig}
              cursorImg={cursorUrl(current?.pack)}
              accent={accent}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── theme info ── */}
      <div className="shrink-0 px-4 pt-2.5 pb-0.5 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={current?.id}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.15 }}
          >
            <p className="text-sm font-bold text-slate-800">{current?.name}</p>
            {effects.length > 0 && (
              <p className="mt-0.5 text-[11px] text-slate-400">{effects.join(" · ")}</p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── theme carousel ── */}
      <div className="shrink-0 px-2 pt-2 pb-1">
        <ThemeCarousel themes={themes} activeId={activeId} onSelect={switchTo} />
      </div>

      {/* ── footer ── */}
      <footer className="shrink-0 grid grid-cols-2 gap-2.5 px-4 pb-4">
        <button
          type="button"
          onClick={openOptionsPage}
          className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          <Settings className="size-3.5" />
          工作台
        </button>
        <button
          type="button"
          onClick={previewCurrent}
          disabled={!current?.pack || previewingId != null || !site.isSupportedPage}
          className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-40"
        >
          <Play className="size-3.5" />
          预览效果
        </button>
      </footer>
    </div>
  );
}
