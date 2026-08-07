import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { defaultKeyFeedbackConfig, type KeyFeedbackConfig } from "@/shared/config/key-feedback";
import { KeyboardPreview } from "./keyboard/KeyboardPreview";
import {
  AccessibilityNotice,
  KeyboardAdvanced,
  KeyboardAppearance,
  KeyboardGroup,
  KeyboardMeaning,
  KeyboardPlacement,
} from "./keyboard/KeyboardSections";

interface KeyboardPanelProps {
  config: KeyFeedbackConfig;
  themeName?: string;
  accessibilityAuthorized?: boolean | null;
  hasPendingChanges?: boolean;
  onOpenAccessibilitySettings?: () => void;
  onCaptureChange?: (active: boolean) => void;
  onUpdate: (patch: Partial<KeyFeedbackConfig>) => void;
}

export function KeyboardPanel({
  config,
  themeName,
  accessibilityAuthorized = null,
  hasPendingChanges = false,
  onOpenAccessibilitySettings,
  onCaptureChange,
  onUpdate,
}: KeyboardPanelProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editWhileOff, setEditWhileOff] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  useEffect(() => {
    if (config.enabled) setEditWhileOff(false);
  }, [config.enabled]);

  const showEditor = config.enabled || editWhileOff;

  return (
    <div className="keyboard-workspace h-full overflow-y-auto bg-slate-50 px-3 py-3">
      <div className="mx-auto w-full max-w-[1480px]">
        <header className="mb-2.5 flex min-h-8 items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-slate-900">键盘动效</h1>
            {themeName ? <p className="mt-0.5 truncate text-2xs text-slate-500">当前主题 · {themeName}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" role="switch" aria-checked={config.enabled} onClick={() => onUpdate({ enabled: !config.enabled })} className="flex h-8 items-center gap-2 rounded-xl bg-white px-2.5 text-xs text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
              <span aria-hidden="true" className={cn("inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors", config.enabled ? "bg-slate-950" : "bg-slate-200")}><span className={cn("size-4 rounded-full bg-white shadow-sm transition-transform", config.enabled && "translate-x-4")} /></span>
              <span className="font-medium">启用动效</span>
            </button>
            <div ref={menuRef} className="relative">
              <button type="button" aria-label="更多操作" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)} className="grid size-8 place-items-center rounded-xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-800"><MoreHorizontal className="size-4" /></button>
              {menuOpen ? <div className="absolute right-0 top-10 z-30 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"><button type="button" className="flex h-8 w-full items-center rounded-lg px-2.5 text-left text-xs text-slate-600 hover:bg-slate-50" onClick={() => { onUpdate({ ...defaultKeyFeedbackConfig }); setMenuOpen(false); }}>恢复当前主题默认</button></div> : null}
            </div>
          </div>
        </header>

        {accessibilityAuthorized === false ? <AccessibilityNotice onOpenSettings={onOpenAccessibilitySettings} /> : null}
        {hasPendingChanges ? <div className="mb-2.5 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800 ring-1 ring-sky-200">页面预览已更新；桌面实际效果需点击顶部「应用到桌面」。</div> : null}

        {!showEditor ? (
          <section className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0"><h2 className="text-sm font-medium text-slate-900">当前主题的键盘动效已关闭</h2><p className="mt-1 text-xs leading-relaxed text-slate-500">配置仍然保留，重新开启后会立即恢复。</p></div>
              <button type="button" className="h-8 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50" onClick={() => setEditWhileOff(true)}>继续调整</button>
            </div>
          </section>
        ) : (
          <div className="keyboard-layout grid gap-2.5">
            <div className="keyboard-preview-column min-w-0">
              <KeyboardPreview config={config} onUpdate={onUpdate} onCaptureChange={onCaptureChange} />
              <KeyboardGroup title="内容与语义" description="显示什么，以及不同按键如何区分" className="keyboard-group-meaning"><KeyboardMeaning config={config} onUpdate={onUpdate} /></KeyboardGroup>
            </div>
            <aside className="keyboard-settings-column min-w-0">
              <KeyboardAppearance config={config} onUpdate={onUpdate} />
              <KeyboardGroup title="出现位置" description="锚点、入场方向与停留位置" className="keyboard-group-placement"><KeyboardPlacement config={config} accessibilityAuthorized={accessibilityAuthorized} onUpdate={onUpdate} /></KeyboardGroup>
              <KeyboardGroup title="高级动效" description="字形、上色、节奏与动画细节" className="keyboard-group-advanced"><KeyboardAdvanced config={config} onUpdate={onUpdate} /></KeyboardGroup>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
