import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Globe2, Play, Settings, Zap } from "lucide-react";
import { Button } from "@/components/ui/button.jsx";
import { Switch } from "@/components/ui/switch.jsx";
import { cn } from "@/components/ui/utils.js";
import { createBuiltinCursorAsset } from "../theme-workbench/lib/cursorAssetPresets.js";
import { usePopupState } from "./usePopupState.js";

const POPUP_PREVIEW_KEYFRAMES = `
  @keyframes cursorDancePopupPulse {
    0% { opacity: 0.92; transform: translate3d(0, 0, 0) scale(0.96); }
    50% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
    100% { opacity: 0.92; transform: translate3d(0, 0, 0) scale(0.96); }
  }
  @keyframes cursorDancePopupRipple {
    0% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(0.82); }
    20% { opacity: 0.55; transform: translate3d(-50%, -50%, 0) scale(0.94); }
    100% { opacity: 0; transform: translate3d(-50%, -50%, 0) scale(1.08); }
  }
  @keyframes cursorDancePopupParticle {
    0% { opacity: 0; transform: translate3d(0, 0, 0) scale(0.72); }
    18% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
    100% { opacity: 0; transform: translate3d(var(--particle-x), var(--particle-y), 0) scale(0.82); }
  }
`;

const FALLBACK_DEFAULT_CURSOR = createBuiltinCursorAsset("default", "system");
const FALLBACK_POINTER_CURSOR = createBuiltinCursorAsset("pointer", "system");
const POPUP_WIDTH = 360;
const POPUP_HEIGHT = 540;

// ── helpers ───────────────────────────────────────────────────

function countEnabledEffects(actionConfig) {
  if (!actionConfig) return 0;
  return [actionConfig.textEnabled, actionConfig.particle, actionConfig.ripple, actionConfig.sound].filter(Boolean).length;
}

function resolveThemeCursorAsset(themePack, stateId = "default") {
  const cursorState = themePack?.cursorStates?.[stateId];
  if (cursorState?.imageDataUrl) return { imageDataUrl: cursorState.imageDataUrl };
  const fallback = stateId === "pointer" ? FALLBACK_POINTER_CURSOR : FALLBACK_DEFAULT_CURSOR;
  return { imageDataUrl: fallback.imageDataUrl };
}

function buildParticleDots(actionConfig) {
  if (!actionConfig?.particle) return [];
  const count = actionConfig.particleCount ?? 5;
  const spread = (actionConfig.particleSpread ?? 56) * 0.7;
  const dots = [];
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count;
    dots.push({
      x: Math.round(Math.cos(angle) * spread),
      y: Math.round(Math.sin(angle) * spread),
      delay: i * Math.round(180 / Math.max(count, 1)),
    });
  }
  return dots;
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(Boolean(mq?.matches));
    update();
    mq?.addEventListener?.("change", update);
    return () => mq?.removeEventListener?.("change", update);
  }, []);
  return reducedMotion;
}

function usePreviewTick(themeId, actionConfig) {
  const [tick, setTick] = useState(0);
  const reducedMotion = useReducedMotion();
  const effectCount = countEnabledEffects(actionConfig);

  useEffect(() => {
    if (!themeId) return;
    function handle(event) { if (event.detail?.themeId === themeId) setTick((v) => v + 1); }
    window.addEventListener("CURSORDANCE_POPUP_PREVIEW", handle);
    return () => window.removeEventListener("CURSORDANCE_POPUP_PREVIEW", handle);
  }, [themeId]);

  useEffect(() => {
    if (!themeId || reducedMotion || effectCount === 0) return;
    setTick((v) => v + 1);
    const timer = window.setInterval(() => setTick((v) => v + 1), 2600);
    return () => window.clearInterval(timer);
  }, [effectCount, reducedMotion, themeId]);

  return { tick, reducedMotion };
}

// ── HeroPreview ───────────────────────────────────────────────

function HeroPreview({ themePack, actionConfig, themeId }) {
  const defaultCursor = resolveThemeCursorAsset(themePack, "default");
  const particles = useMemo(() => buildParticleDots(actionConfig), [actionConfig]);
  const { tick, reducedMotion } = usePreviewTick(themeId, actionConfig);
  const hasRipple = Boolean(actionConfig?.ripple);
  const hasParticle = Boolean(actionConfig?.particle);
  const hasText = Boolean(actionConfig?.textEnabled && actionConfig?.textContent);
  const particleColor = actionConfig?.particlePalette?.[0] ?? "#94A3B8";
  const isDualRipple = actionConfig?.rippleStyle === "双环";
  const hasAnyEffect = hasRipple || hasParticle || hasText;

  return (
    <div className="relative flex h-[80px] items-center justify-center rounded-xl bg-slate-50">
      <style>{POPUP_PREVIEW_KEYFRAMES}</style>

      {hasRipple ? (
        <>
          <div key={`ra-${tick}`} className="absolute left-1/2 top-1/2 size-[56px] rounded-full border border-slate-300/50" style={{ animation: reducedMotion ? undefined : "cursorDancePopupRipple 1100ms ease-out forwards" }} />
          {isDualRipple ? (
            <div key={`rb-${tick}`} className="absolute left-1/2 top-1/2 size-[64px] rounded-full border border-slate-200/45" style={{ animation: reducedMotion ? undefined : "cursorDancePopupRipple 1100ms ease-out 110ms forwards" }} />
          ) : null}
        </>
      ) : null}

      {hasParticle
        ? particles.map((p, i) => (
          <span key={`pt-${tick}-${i}`} className="absolute left-1/2 top-1/2 size-2 rounded-full" style={{ backgroundColor: particleColor, opacity: 0.7, "--particle-x": `${p.x}px`, "--particle-y": `${p.y}px`, animation: reducedMotion ? undefined : `cursorDancePopupParticle 920ms ease-out ${p.delay}ms forwards` }} />
        ))
        : null}

      {hasText ? (
        <span key={`txt-${tick}`} className="absolute left-1/2 top-[8px] z-20 -translate-x-1/2 text-xs font-semibold text-slate-600" style={{ opacity: 0, animation: reducedMotion ? undefined : `cursorDancePopupParticle 1100ms ease-out 50ms forwards` }}>
          {actionConfig.textContent}
        </span>
      ) : null}

      {!hasAnyEffect ? (
        <span className="absolute z-10 text-xs text-slate-400">无特效</span>
      ) : null}

      <div className="relative z-10 flex size-[44px] items-center justify-center rounded-full border border-white bg-white shadow-sm" style={{ animation: reducedMotion ? undefined : "cursorDancePopupPulse 1800ms ease-in-out infinite" }}>
        <img src={defaultCursor.imageDataUrl} alt="光标预览" className="max-h-[30px] max-w-[30px] object-contain" />
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────

function Header({ enabled, siteHost, siteAction, busyKey, setEnabled }) {
  const siteActionActive = siteAction !== null;
  const siteDisabled = siteAction === "disable";
  return (
    <header className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
          <img src="logo.svg" alt="CursorDance" className="size-full object-contain" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold leading-tight text-slate-900 text-balance">CursorDance</h1>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 truncate">
            {siteHost ? <Globe2 className="size-3 shrink-0" /> : null}
            <span className="truncate">{siteHost || "主题切换器"}</span>
            {siteActionActive ? (
              <span className={cn(
                "ml-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px text-xs font-medium",
                siteDisabled
                  ? "bg-rose-100 text-rose-600"
                  : "bg-amber-100 text-amber-700"
              )}>
                {siteDisabled ? (
                  <><AlertTriangle className="size-2.5" />站点已禁用</>
                ) : (
                  <><Zap className="size-2.5" />站点专属</>
                )}
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center">
        <Switch checked={enabled} disabled={busyKey === "enabled"} onCheckedChange={setEnabled} aria-label="全局启用开关" />
      </div>
    </header>
  );
}

// ── CurrentThemeHero ──────────────────────────────────────────

function CurrentThemeHero({ theme, themePack, actionConfig, actionLabel }) {
  const effectCount = countEnabledEffects(actionConfig);

  return (
    <AnimatePresence mode="wait">
      <motion.section
        key={theme?.id || "empty"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm"
      >
        <div className="flex items-center gap-2.5 p-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
            <img
              src={resolveThemeCursorAsset(themePack, "default").imageDataUrl}
              alt={`${theme?.name || "当前"} 光标`}
              className="max-h-[22px] max-w-[22px] object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-slate-900 text-balance">{theme?.name || "未选择主题"}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{actionLabel}</span>
              {effectCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  {effectCount} 个特效
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <HeroPreview themePack={themePack} actionConfig={actionConfig} themeId={theme?.id} />
      </motion.section>
    </AnimatePresence>
  );
}

// ── ThemeListCard ─────────────────────────────────────────────

function ThemeListCard({ theme, themePack, actionConfig, selected, onSelect, disabled }) {
  const cursorAsset = resolveThemeCursorAsset(themePack, "default");

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      layout
      whileTap={{ scale: 0.985 }}
      className={cn(
        "relative w-full overflow-hidden rounded-xl text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? "border border-slate-300 bg-slate-50 shadow-sm"
          : "border border-slate-200/60 bg-white hover:border-slate-300 hover:shadow-sm"
      )}
    >
      {selected ? <div className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-emerald-500" aria-hidden="true" /> : null}
      <div className={cn("flex items-center gap-2.5 py-2.5", selected ? "pl-3.5 pr-2.5" : "px-2.5")}>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
          <img src={cursorAsset.imageDataUrl} alt={`${theme.name} 光标`} className="max-h-[22px] max-w-[22px] object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-900">{theme.name}</div>
          <div className="mt-0.5 truncate text-xs text-slate-500">{theme.summary}</div>
        </div>
      </div>
    </motion.button>
  );
}

// ── ThemeListSection ──────────────────────────────────────────

function ThemeListSection({ items, activeThemeId, siteAction, busyKey, setThemeId }) {
  const siteActionEnabled = siteAction && siteAction.enable;
  const siteActionDisabled = siteAction === "disable";
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-1.5 flex items-center justify-between gap-3 px-0.5">
        <h3 className="text-xs font-semibold text-slate-400">
          主题列表
          <span className="ml-1 font-normal normal-case text-slate-400">{items.length} 个</span>
        </h3>
      </div>
      {siteActionEnabled ? (
        <div className="mb-1.5 rounded-lg border border-amber-200/60 bg-amber-50/70 px-2.5 py-1.5 text-xs text-amber-700">
          此站点已绑定专属主题，切换将更新站点规则。
        </div>
      ) : null}
      {siteActionDisabled ? (
        <div className="mb-1.5 rounded-lg border border-rose-200/60 bg-rose-50/70 px-2.5 py-1.5 text-xs text-rose-700">
          此站点的特效已禁用，切换主题将重新启用。
        </div>
      ) : null}
      <div className="h-0 min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
        <div className="space-y-1">
          {items.map(({ theme, themePack, actionConfig }) => (
            <ThemeListCard key={theme.id} theme={theme} themePack={themePack} actionConfig={actionConfig} selected={theme.id === activeThemeId} onSelect={() => setThemeId(theme.id)} disabled={busyKey === "theme"} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── FooterActions ─────────────────────────────────────────────

function FooterActions({ notice, canPreview, busyKey, previewCurrentTheme, openOptionsPage }) {
  const showNotice = notice.tone !== "slate";
  return (
    <footer className="mt-auto shrink-0">
      <AnimatePresence>
        {showNotice ? (
          <motion.div
            key={notice.message}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn("mb-2 rounded-xl border px-3 py-2 text-xs", notice.tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700")}
          >
            {notice.message}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-2">
        <Button className="h-9 rounded-xl bg-slate-950 text-sm font-semibold text-white shadow-sm hover:bg-slate-800" disabled={!canPreview || busyKey === "preview"} onClick={previewCurrentTheme}>
          <Play className="mr-1.5 size-4" />
          测试效果
        </Button>
        <Button variant="outline" className="h-9 rounded-xl border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50" disabled={busyKey === "options"} onClick={openOptionsPage}>
          <Settings className="mr-1.5 size-4" />
          打开工作台
        </Button>
      </div>
    </footer>
  );
}

// ── LoadingShell ──────────────────────────────────────────────

function LoadingShell() {
  return (
    <div className="flex items-center justify-center" style={{ width: POPUP_WIDTH, height: POPUP_HEIGHT }}>
      <div className="h-full w-full bg-white p-3">
        <div className="animate-pulse space-y-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-slate-100" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-20 rounded-md bg-slate-100" />
              <div className="h-2.5 w-28 rounded-md bg-slate-100" />
            </div>
          </div>
          <div className="h-[168px] rounded-2xl bg-slate-100" />
          <div className="space-y-1">
            <div className="h-[46px] rounded-xl bg-slate-100" />
            <div className="h-[46px] rounded-xl bg-slate-100" />
            <div className="h-[46px] rounded-xl bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PopupPage ─────────────────────────────────────────────────

export default function PopupPage() {
  const { ready, site, enabled, busyKey, notice, activeAction, activeThemeChoice, themeChoices, siteAction, setEnabled, setThemeId, previewCurrentTheme, openOptionsPage } = usePopupState();
  if (!ready) return <LoadingShell />;

  return (
    <div
      className="overflow-hidden text-slate-700"
      style={{ width: POPUP_WIDTH, height: POPUP_HEIGHT, fontFamily: '"SF Pro Display","SF Pro Text","PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif' }}
    >
      <div className="flex h-full w-full flex-col gap-2.5 bg-white p-3">
        <Header enabled={enabled} siteHost={site.host} siteAction={siteAction} busyKey={busyKey} setEnabled={setEnabled} />

        <CurrentThemeHero
          theme={activeThemeChoice?.theme}
          themePack={activeThemeChoice?.themePack}
          actionConfig={activeThemeChoice?.actionConfig}
          actionLabel={activeAction?.label || "左键单击"}
        />

        <ThemeListSection items={themeChoices} activeThemeId={activeThemeChoice?.theme?.id} siteAction={siteAction} busyKey={busyKey} setThemeId={setThemeId} />

        <FooterActions notice={notice} canPreview={site.isSupportedPage} busyKey={busyKey} previewCurrentTheme={previewCurrentTheme} openOptionsPage={openOptionsPage} />
      </div>
    </div>
  );
}
