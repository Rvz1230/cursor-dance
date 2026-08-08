import { useCallback, useMemo, useRef, useState } from "react";
import { Loader2, Monitor, Settings, X } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { usePopupState } from "./usePopupState";
import { ThemeCarousel } from "./components/ThemeCarousel";
import { ThemeIdentityCard, themeAccent, themeIcon } from "./components/ThemeIdentityCard";
import "./popup-motion.css";

// ═══════════════════════════════════════════════════════════════
// "Theme Identity" — shows what makes each theme unique
// ═══════════════════════════════════════════════════════════════

const W = 360;
const H = 540;

function Toggle({ checked, disabled = false, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      aria-label="全局开关"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-150 ease-out disabled:cursor-wait disabled:opacity-50",
        checked ? "bg-slate-900" : "bg-slate-200"
      )}
    >
      <span
        className="inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${checked ? 18 : 2}px)` }}
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
    <div
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
    </div>
  );
}
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
      if (busyKey || themeId === activeId) return;
      void setThemeId(themeId);
    },
    [activeId, busyKey, setThemeId]
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
          <Toggle checked={enabled} disabled={Boolean(busyKey)} onChange={setEnabled} />
        </div>
      </header>

      {/* ── notice bar ── */}
      {effectiveNotice && (
        <NoticeBar notice={effectiveNotice} onDismiss={() => setDismissedNotice(true)} />
      )}

      {/* ── identity card ── */}
      <div className={cn("flex-1 min-h-0 px-4 pt-1.5 pb-2", !enabled && "opacity-35")}>
        <div key={current?.theme?.id || "empty"} className="h-full">
          {current ? (
            <ThemeIdentityCard
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
        </div>
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
            disabled={Boolean(busyKey)}
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
