import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Eye, Globe2 } from "lucide-react";
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
  @keyframes cursorDancePopupText {
    0% { opacity: 0; transform: translate3d(0, 8px, 0) scale(0.96); }
    18% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
    100% { opacity: 0; transform: translate3d(0, -14px, 0) scale(1.02); }
  }
`;

const FALLBACK_DEFAULT_CURSOR = createBuiltinCursorAsset("default", "system");
const FALLBACK_POINTER_CURSOR = createBuiltinCursorAsset("pointer", "system");
const POPUP_WIDTH = 408;
const POPUP_HEIGHT = 600;

function BrandMark() {
  return (
    <div className="relative flex size-12 items-center justify-center">
      <div className="size-10 rounded-full border-[6px] border-emerald-600 border-r-transparent" />
      <div className="absolute right-1 top-2 h-3.5 w-3.5 text-amber-400">
        <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 0.8 9.4 5.1 13.7 6.5 9.4 7.9 8 12.2 6.6 7.9 2.3 6.5 6.6 5.1 8 0.8Z" />
        </svg>
      </div>
    </div>
  );
}

function countEnabledEffects(actionConfig) {
  if (!actionConfig) return 0;
  return [
    actionConfig.textEnabled,
    actionConfig.particle,
    actionConfig.ripple,
    actionConfig.sound,
  ].filter(Boolean).length;
}

function resolveThemeCursorAsset(themePack, stateId = "default") {
  const cursorState = themePack?.cursorStates?.[stateId];
  if (cursorState?.imageDataUrl) {
    return {
      imageDataUrl: cursorState.imageDataUrl,
      size: cursorState.size ?? 48,
      mimeLabel: getMimeLabel(cursorState.imageDataUrl),
    };
  }

  const fallbackAsset = stateId === "pointer" ? FALLBACK_POINTER_CURSOR : FALLBACK_DEFAULT_CURSOR;
  return {
    imageDataUrl: fallbackAsset.imageDataUrl,
    size: fallbackAsset.size ?? 48,
    mimeLabel: "内置",
  };
}

function getMimeLabel(dataUrl = "") {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  if (dataUrl.startsWith("data:image/svg+xml")) return "SVG";
  return "内置";
}

function buildParticleDots(actionConfig) {
  if (!actionConfig?.particle) return [];
  return [
    { x: -54, y: -28, delay: 0 },
    { x: 50, y: -16, delay: 60 },
    { x: -26, y: 52, delay: 120 },
    { x: 42, y: 44, delay: 180 },
  ];
}

function getPreviewText(actionConfig) {
  if (!actionConfig?.textEnabled) return "";
  const primaryText = typeof actionConfig.textContent === "string" ? actionConfig.textContent.trim() : "";
  if (primaryText) return primaryText;
  const firstTag = Array.isArray(actionConfig.textTags) ? actionConfig.textTags.find(Boolean) : "";
  return firstTag || "";
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(Boolean(mediaQuery?.matches));
    updatePreference();
    mediaQuery?.addEventListener?.("change", updatePreference);
    return () => mediaQuery?.removeEventListener?.("change", updatePreference);
  }, []);

  return reducedMotion;
}

function usePreviewTick(themeId, actionConfig) {
  const [tick, setTick] = useState(0);
  const reducedMotion = useReducedMotion();
  const effectCount = countEnabledEffects(actionConfig);

  useEffect(() => {
    if (!themeId) return undefined;

    function handlePreview(event) {
      if (event.detail?.themeId !== themeId) return;
      setTick((value) => value + 1);
    }

    window.addEventListener("CURSORDANCE_POPUP_PREVIEW", handlePreview);
    return () => window.removeEventListener("CURSORDANCE_POPUP_PREVIEW", handlePreview);
  }, [themeId]);

  useEffect(() => {
    if (!themeId || reducedMotion || effectCount === 0) return undefined;
    setTick((value) => value + 1);
    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [effectCount, reducedMotion, themeId]);

  return { tick, reducedMotion };
}

function HeroPreview({ themePack, actionConfig, themeId }) {
  const defaultCursor = resolveThemeCursorAsset(themePack, "default");
  const pointerCursor = resolveThemeCursorAsset(themePack, "pointer");
  const particles = useMemo(() => buildParticleDots(actionConfig), [actionConfig]);
  const { tick, reducedMotion } = usePreviewTick(themeId, actionConfig);

  return (
    <div className="relative flex h-[118px] items-center justify-center rounded-[18px] border border-slate-200/90 bg-[#fbfbf8]">
      <style>{POPUP_PREVIEW_KEYFRAMES}</style>

      <div className="absolute inset-4 rounded-full border border-slate-200/75" />
      <div className="absolute inset-[27px] rounded-full border border-slate-100" />

      <span className="absolute left-[24%] top-[27%] size-1.5 rounded-full bg-slate-200" />
      <span className="absolute right-[21%] top-[30%] size-1.5 rounded-full bg-slate-300" />
      <span className="absolute left-[22%] bottom-[31%] size-1.5 rounded-full bg-slate-200" />
      <span className="absolute right-[28%] bottom-[24%] size-1 rounded-full bg-slate-300" />

      {actionConfig?.ripple ? (
        <>
          <div
            key={`ripple-a-${tick}`}
            className="absolute left-1/2 top-1/2 size-[82px] rounded-full border border-emerald-300/55"
            style={{
              animation: reducedMotion ? undefined : "cursorDancePopupRipple 1100ms ease-out forwards",
            }}
          />
          <div
            key={`ripple-b-${tick}`}
            className="absolute left-1/2 top-1/2 size-[94px] rounded-full border border-emerald-200/50"
            style={{
              animation: reducedMotion ? undefined : "cursorDancePopupRipple 1100ms ease-out 110ms forwards",
            }}
          />
        </>
      ) : null}

      {actionConfig?.particle
        ? particles.map((particle, index) => (
          <span
            key={`particle-${tick}-${index}`}
            className="absolute left-1/2 top-1/2 size-2 rounded-full bg-emerald-400/80"
            style={{
              "--particle-x": `${particle.x}px`,
              "--particle-y": `${particle.y}px`,
              animation: reducedMotion ? undefined : `cursorDancePopupParticle 920ms ease-out ${particle.delay}ms forwards`,
            }}
          />
        ))
        : null}

      <div
        className="relative z-10 flex size-[72px] items-center justify-center rounded-full border border-white bg-white shadow-sm"
        style={{
          animation: reducedMotion ? undefined : "cursorDancePopupPulse 1800ms ease-in-out infinite",
        }}
      >
        <img
          src={defaultCursor.imageDataUrl}
          alt={`${themePack?.name || "当前主题"} 默认光标`}
          className="max-h-[50px] max-w-[50px] object-contain"
        />
      </div>

      <div className="absolute bottom-4 right-4 flex size-[28px] items-center justify-center rounded-full border border-slate-200 bg-white">
        <img
          src={pointerCursor.imageDataUrl}
          alt="指针预览"
          className="max-h-4 max-w-4 object-contain"
        />
      </div>
    </div>
  );
}

function CurrentThemeHero({ theme, themePack, actionConfig, actionLabel }) {
  return (
    <section className="rounded-[18px] border border-slate-200/90 bg-[#fcfcfa] p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_118px] items-center gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            当前主题
          </div>

          <h2 className="mt-2 text-[18px] font-semibold leading-tight text-slate-900 text-balance">
            {theme?.name || "未选择主题"}
          </h2>
          <p className="mt-1.5 max-w-[168px] text-[11px] leading-[1.45] text-slate-500 text-pretty">
            {theme?.summary || theme?.description || "切换后会立即使用当前主题的默认光标与点击反馈。"}
          </p>

          <div className="mt-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-500">
            当前预览动作：{actionLabel}
          </div>
        </div>

        <HeroPreview themePack={themePack} actionConfig={actionConfig} themeId={theme?.id} />
      </div>
    </section>
  );
}

function ThemeListCard({ theme, themePack, selected, onSelect, disabled }) {
  const cursorAsset = resolveThemeCursorAsset(themePack, "default");

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "w-full rounded-[16px] border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? "border-emerald-400 bg-emerald-50/60"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
      )}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "flex size-[34px] items-center justify-center rounded-[10px] border",
            selected ? "border-emerald-100 bg-white" : "border-slate-200 bg-slate-50"
          )}
        >
          <img
            src={cursorAsset.imageDataUrl}
            alt={`${theme.name} 默认光标`}
            className="max-h-[22px] max-w-[22px] object-contain"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-slate-900">{theme.name}</div>
          <div className="mt-0.5 truncate text-[11px] text-slate-500">{theme.summary}</div>
        </div>

        <div
          className={cn(
            "flex size-6 items-center justify-center rounded-full border transition-colors",
            selected ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-transparent"
          )}
          aria-hidden="true"
        >
          <Check className="h-3.5 w-3.5" />
        </div>
      </div>
    </button>
  );
}

function ThemeListSection({ items, activeThemeId, setThemeId, busyKey }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-950">快速切换主题</h3>
        </div>
      </div>

      <div className="h-0 min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
        <div className="space-y-1.5">
        {items.map(({ theme, themePack }) => (
          <ThemeListCard
            key={theme.id}
            theme={theme}
            themePack={themePack}
            selected={theme.id === activeThemeId}
            onSelect={() => setThemeId(theme.id)}
            disabled={busyKey === "theme"}
          />
        ))}
        </div>
      </div>
    </section>
  );
}

function FooterActions({ notice, canPreview, busyKey, previewCurrentTheme, openOptionsPage }) {
  const showNotice = notice.tone !== "slate";
  return (
    <footer className="mt-auto shrink-0">
      {showNotice ? (
        <div
          className={cn(
            "mb-3 rounded-2xl border px-3 py-2 text-[11px]",
            notice.tone === "rose"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          )}
        >
          {notice.message}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Button
          className="h-[38px] rounded-[14px] bg-emerald-600 text-[13px] font-semibold text-white hover:bg-emerald-700"
          disabled={!canPreview || busyKey === "preview"}
          onClick={previewCurrentTheme}
        >
          <Eye className="mr-2 h-4.5 w-4.5" />
          立即预览
        </Button>
        <Button
          variant="outline"
          className="h-[38px] rounded-[14px] border-slate-200 bg-white text-[13px] font-semibold text-slate-900 hover:bg-slate-50"
          disabled={busyKey === "options"}
          onClick={openOptionsPage}
        >
          <ExternalLink className="mr-2 h-4.5 w-4.5" />
          打开工作台
        </Button>
      </div>
    </footer>
  );
}

function Header({ enabled, busyKey, setEnabled }) {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <BrandMark />
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-none text-slate-900 text-balance">CursorDance</h1>
          <p className="mt-1 text-[11px] text-slate-500 text-pretty">主题切换器</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 rounded-full bg-emerald-600 px-2 py-1.5 text-white">
        <div className="flex size-[22px] items-center justify-center rounded-full bg-white/18">
          <Globe2 className="h-4 w-4" />
        </div>
        <Switch
          checked={enabled}
          disabled={busyKey === "enabled"}
          onCheckedChange={setEnabled}
          aria-label="全局启用开关"
          className={enabled ? "bg-white/30" : "bg-emerald-500/60"}
        />
      </div>
    </header>
  );
}

function LoadingShell() {
  return (
    <div className="flex items-center justify-center bg-white" style={{ width: POPUP_WIDTH, height: POPUP_HEIGHT }}>
      <div className="h-full w-full rounded-none border-0 bg-white p-3.5 shadow-none">
        <div className="animate-pulse space-y-4">
          <div className="h-10 rounded-[16px] bg-slate-100" />
          <div className="h-32 rounded-[18px] bg-slate-100" />
          <div className="h-40 rounded-[18px] bg-slate-100" />
          <div className="h-10 rounded-[16px] bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

export default function PopupPage() {
  const {
    ready,
    site,
    enabled,
    busyKey,
    notice,
    activeAction,
    activeThemeChoice,
    themeChoices,
    setEnabled,
    setThemeId,
    previewCurrentTheme,
    openOptionsPage,
  } = usePopupState();

  if (!ready) return <LoadingShell />;

  return (
    <div
      className="overflow-hidden bg-white text-slate-900"
      style={{
        width: POPUP_WIDTH,
        height: POPUP_HEIGHT,
        fontFamily: '"SF Pro Display","SF Pro Text","PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif',
      }}
    >
      <div className="flex h-full w-full flex-col rounded-[24px] border border-slate-200 bg-white p-3.5">
        <Header enabled={enabled} busyKey={busyKey} setEnabled={setEnabled} />

        <div className="mt-2.5 shrink-0">
          <CurrentThemeHero
            theme={activeThemeChoice?.theme}
            themePack={activeThemeChoice?.themePack}
            actionConfig={activeThemeChoice?.actionConfig}
            actionLabel={activeAction?.label || "左键单击"}
          />
        </div>

        <div className="mt-2.5 min-h-0 flex-1 overflow-hidden">
          <ThemeListSection
            items={themeChoices}
            activeThemeId={activeThemeChoice?.theme?.id}
            setThemeId={setThemeId}
            busyKey={busyKey}
          />
        </div>

        <div className="mt-2 shrink-0 border-t border-slate-100 pt-2.5">
          <FooterActions
            notice={notice}
            canPreview={site.isSupportedPage}
            busyKey={busyKey}
            previewCurrentTheme={previewCurrentTheme}
            openOptionsPage={openOptionsPage}
          />
        </div>
      </div>
    </div>
  );
}
