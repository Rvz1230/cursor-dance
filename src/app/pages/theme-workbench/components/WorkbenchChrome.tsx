import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns,
  Loader2,
  PanelLeft,
  PanelRight,
  Redo2,
  RotateCcw,
  Search,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { BrandMark } from "@/components/ui/brand-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { WorkspaceNavigationItem } from "./WorkspaceNavigationItem";
import type { WorkbenchLayoutPreset } from "../hooks/useWorkbenchColumnLayout";
import type { WorkbenchWorkspaceGroup } from "../model/workbenchSchema";

export interface WorkbenchWorkspaceItem {
  id: string;
  label: string;
  icon: LucideIcon;
  group: WorkbenchWorkspaceGroup;
}

export interface WorkbenchHeaderProps {
  workspaceItems: WorkbenchWorkspaceItem[];
  workspaceId: string;
  setWorkspaceId: (id: string) => void;
  themeName: string;
  themeScoped: boolean;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  unsaved: boolean;
  undo?: { run: () => void; label: string | null };
  redo?: { run: () => void; label: string | null };
  isSaving: boolean;
  saveError?: string | null;
  saveChanges: () => void;
  restoreAppliedChanges: () => void;
  resetCurrentTheme: () => void;
  aiPanelOpen?: boolean;
  setAiPanelOpen?: (value: boolean) => void;
  openAiSettings?: () => void;
  layoutPreset: WorkbenchLayoutPreset;
  setLayoutPreset: (preset: Exclude<WorkbenchLayoutPreset, "custom">) => void;
  openCommandPalette: () => void;
}

export type WorkbenchHeaderRenderer = (props: WorkbenchHeaderProps) => ReactNode;

const GROUP_LABELS: Record<WorkbenchWorkspaceItem["group"], string> = {
  personalization: "个性化",
  automation: "自动化",
  system: "系统",
};

function WorkspaceTabsScroller({
  workspaceItems,
  workspaceId,
  setWorkspaceId,
}: Pick<WorkbenchHeaderProps, "workspaceItems" | "workspaceId" | "setWorkspaceId">) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ left: false, right: false });

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const updateScrollState = () => {
      const maxScrollLeft = element.scrollWidth - element.clientWidth;
      setScrollState({
        left: element.scrollLeft > 1,
        right: element.scrollLeft < maxScrollLeft - 1,
      });
    };

    updateScrollState();
    element.addEventListener("scroll", updateScrollState, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(element);
    return () => {
      element.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
    };
  }, [workspaceItems.length]);

  const scrollByPage = (direction: -1 | 1) => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollBy({ left: direction * Math.max(120, element.clientWidth * 0.7), behavior: "smooth" });
  };

  return (
    <div className="flex min-w-0 items-center gap-1">
      {scrollState.left ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 rounded-lg text-slate-500"
          onClick={() => scrollByPage(-1)}
          aria-label="向左滚动工作区"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
        </Button>
      ) : null}
      <nav
        ref={scrollRef}
        className="flex min-w-0 items-center gap-1.5 overflow-x-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="工作区"
      >
        {workspaceItems.map((item, index) => {
          const previous = workspaceItems[index - 1];
          const startsGroup = index === 0 || previous.group !== item.group;
          return (
            <div key={item.id} className="contents">
              {startsGroup && index > 0 ? <span className="h-4 w-px shrink-0 bg-slate-200" aria-hidden="true" /> : null}
              {startsGroup ? (
                <span className="hidden shrink-0 text-xs font-medium text-slate-500 xl:inline">
                  {GROUP_LABELS[item.group]}
                </span>
              ) : null}
              <WorkspaceNavigationItem
                item={item}
                active={workspaceId === item.id}
                onClick={() => setWorkspaceId(item.id)}
                compact
              />
            </div>
          );
        })}
      </nav>
      {scrollState.right ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 rounded-lg text-slate-500"
          onClick={() => scrollByPage(1)}
          aria-label="向右滚动工作区"
        >
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

export function WorkbenchScopeHeader({
  themeName,
  themeScoped,
  enabled,
  setEnabled,
  unsaved,
  isSaving,
  saveError,
  saveChanges,
  restoreAppliedChanges,
}: Pick<
  WorkbenchHeaderProps,
  | "themeName"
  | "themeScoped"
  | "enabled"
  | "setEnabled"
  | "unsaved"
  | "isSaving"
  | "saveError"
  | "saveChanges"
  | "restoreAppliedChanges"
>) {
  return (
    <header className="shrink-0 border-b border-slate-200 bg-white px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <BrandMark size="sm" />
          <span className="text-sm font-semibold text-slate-900">CursorDance</span>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-xs">
          {themeScoped ? (
            <>
              <span className="truncate font-medium text-slate-700">正在编辑：{themeName}</span>
              {unsaved ? (
                <span className="shrink-0 rounded-lg bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 ring-1 ring-amber-200">
                  未应用
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 text-slate-500">
                  <Check className="size-3 text-emerald-500" aria-hidden="true" />
                  已应用到桌面
                </span>
              )}
            </>
          ) : (
            <>
              <span className="truncate font-medium text-slate-700">全局设置 · 不属于任何主题</span>
              {unsaved ? (
                <span className="shrink-0 rounded-lg bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 ring-1 ring-amber-200">
                  待应用
                </span>
              ) : null}
            </>
          )}
          {saveError ? <span className="truncate text-rose-700">{saveError}</span> : null}
        </div>
        {unsaved ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <Button className="h-7 px-2.5 text-xs" onClick={saveChanges} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-1.5 size-3 animate-spin" aria-hidden="true" /> : null}
              {isSaving ? "应用中" : themeScoped ? "应用到桌面" : "应用全局设置"}
            </Button>
            <Button variant="ghost" className="h-7 px-2 text-xs" onClick={restoreAppliedChanges} disabled={isSaving}>
              恢复已应用版本
            </Button>
          </div>
        ) : null}
        <Button
          variant="ghost"
          className={cn(
            "h-7 shrink-0 gap-1.5 px-2 text-xs",
            enabled ? "text-emerald-700" : "text-slate-500",
          )}
          onClick={() => setEnabled(!enabled)}
          aria-pressed={enabled}
        >
          <span className={cn("size-1.5 rounded-full", enabled ? "bg-emerald-500" : "bg-slate-400")} aria-hidden="true" />
          {enabled ? "效果开着" : "效果已暂停"}
        </Button>
      </div>
    </header>
  );
}

const LAYOUT_OPTIONS = [
  { id: "config", label: "专注配置", icon: PanelLeft },
  { id: "split", label: "对半", icon: Columns },
  { id: "preview", label: "专注预览", icon: PanelRight },
] as const;

export function WorkbenchToolbar({
  workspaceItems,
  workspaceId,
  setWorkspaceId,
  themeScoped,
  unsaved,
  undo,
  redo,
  resetCurrentTheme,
  aiPanelOpen,
  setAiPanelOpen,
  layoutPreset,
  setLayoutPreset,
  openCommandPalette,
}: WorkbenchHeaderProps) {
  return (
    <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <WorkspaceTabsScroller
            workspaceItems={workspaceItems}
            workspaceId={workspaceId}
            setWorkspaceId={setWorkspaceId}
          />
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          {workspaceId === "workbench" ? (
            <div className="flex h-8 shrink-0 items-center gap-0.5 rounded-xl bg-white px-1 shadow-sm ring-1 ring-slate-200">
              {LAYOUT_OPTIONS.map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  variant="ghost"
                  size="icon"
                  className={cn("size-6 rounded-lg", layoutPreset === id && "bg-slate-900 text-white hover:bg-slate-800 hover:text-white")}
                  onClick={() => setLayoutPreset(id)}
                  aria-label={label}
                  title={label}
                  aria-pressed={layoutPreset === id}
                >
                  <Icon className="size-3.5" aria-hidden="true" />
                </Button>
              ))}
            </div>
          ) : null}

          {themeScoped ? (
            <div className="flex h-8 shrink-0 items-center gap-1 rounded-xl bg-white px-1 shadow-sm ring-1 ring-slate-200">
              <span className={cn("inline-flex items-center gap-1.5 px-1.5 text-xs font-medium", unsaved ? "text-amber-700" : "text-slate-500") }>
                {unsaved ? <span className="size-1.5 rounded-full bg-amber-400" aria-hidden="true" /> : <Check className="size-3 text-emerald-500" aria-hidden="true" />}
                <span className="hidden lg:inline">{unsaved ? "草稿待应用" : "草稿已同步"}</span>
              </span>
              <span className="h-3 w-px bg-slate-200" aria-hidden="true" />
              <Button
                variant="ghost"
                size="icon"
                className="size-6 rounded-lg"
                onClick={undo?.run}
                disabled={!undo?.label}
                title={undo?.label ? `撤销：${undo.label}（⌘Z）` : "没有可撤销的改动"}
                aria-label={undo?.label ? `撤销：${undo.label}` : "没有可撤销的改动"}
              >
                <Undo2 className="size-3.5" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 rounded-lg"
                onClick={redo?.run}
                disabled={!redo?.label}
                title={redo?.label ? `重做：${redo.label}（⌘⇧Z）` : "没有可重做的改动"}
                aria-label={redo?.label ? `重做：${redo.label}` : "没有可重做的改动"}
              >
                <Redo2 className="size-3.5" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 rounded-lg"
                onClick={resetCurrentTheme}
                title="恢复当前主题默认"
                aria-label="恢复当前主题默认"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          ) : null}

          {workspaceId === "workbench" ? (
            <Button
              variant={aiPanelOpen ? "default" : "outline"}
              className="h-8 shrink-0 px-2.5 text-xs"
              onClick={() => setAiPanelOpen?.(!aiPanelOpen)}
            >
              <Bot className="mr-1.5 size-3.5" aria-hidden="true" />
              <span className="hidden md:inline">AI 助手</span>
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="h-8 shrink-0 px-2.5 text-xs"
            onClick={openCommandPalette}
            aria-label="命令面板"
          >
            <Search className="mr-1.5 size-3.5" aria-hidden="true" />
            <span className="hidden md:inline">命令</span>
            <kbd className="ml-1.5 hidden rounded-md bg-slate-100 px-1 py-0.5 text-2xs text-slate-500 md:inline">⌘K</kbd>
          </Button>
        </div>
      </div>
    </div>
  );
}
