import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bot, ChevronLeft, ChevronRight, Loader2, Redo2, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { WorkspaceNavigationItem } from "./WorkspaceNavigationItem";
import { useThemeWorkbenchState } from "../hooks/useThemeWorkbenchState";

export interface WorkbenchHeaderProps {
  workspaceItems: ReturnType<typeof useThemeWorkbenchState>["workspaceItems"];
  workspaceId: string;
  setWorkspaceId: (id: string) => void;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  unsaved: boolean;
  /** 撤销 / 重做。快捷键之外必须有可见入口——只有快捷键的功能等于隐藏功能。 */
  undo?: { run: () => void; label: string | null };
  redo?: { run: () => void; label: string | null };
  isSaving: boolean;
  saveError?: string | null;
  saveChanges: () => void;
  resetCurrentTheme: () => void;
  aiPanelOpen?: boolean;
  setAiPanelOpen?: (value: boolean) => void;
  /** 桌面端：打开 AI 服务设置（API key / baseUrl / model）。扩展端不传。 */
  openAiSettings?: () => void;
}

export type WorkbenchHeaderRenderer = (props: WorkbenchHeaderProps) => ReactNode;

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
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 rounded-lg text-slate-500 hover:text-slate-900"
          onClick={() => scrollByPage(-1)}
          aria-label="向左滚动工作区"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
        </Button>
      ) : null}
      <div
        ref={scrollRef}
        className="flex min-w-0 items-center gap-1.5 overflow-x-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {workspaceItems.map((item) => (
          <WorkspaceNavigationItem
            key={item.id}
            item={item}
            active={workspaceId === item.id}
            onClick={() => setWorkspaceId(item.id)}
            compact
          />
        ))}
      </div>
      {scrollState.right ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 rounded-lg text-slate-500 hover:text-slate-900"
          onClick={() => scrollByPage(1)}
          aria-label="向右滚动工作区"
        >
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
export function DesktopWorkbenchToolbar({
  workspaceItems,
  workspaceId,
  setWorkspaceId,
  enabled,
  setEnabled,
  unsaved,
  undo,
  redo,
  isSaving,
  saveError,
  saveChanges,
  resetCurrentTheme,
  aiPanelOpen,
  setAiPanelOpen,
}: WorkbenchHeaderProps) {
  return (
    <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <WorkspaceTabsScroller
          workspaceItems={workspaceItems}
          workspaceId={workspaceId}
          setWorkspaceId={setWorkspaceId}
        />

        <div className="flex min-w-0 items-center justify-end gap-2">
          {workspaceId === "workbench" ? (
            <Button
              variant={aiPanelOpen ? "default" : "outline"}
              className="h-8 shrink-0 px-3 text-xs"
              onClick={() => setAiPanelOpen?.(!aiPanelOpen)}
            >
              <Bot className="mr-1.5 size-3.5" aria-hidden="true" />
              AI 助手
            </Button>
          ) : null}
          {undo || redo ? (
            <div className="flex h-8 shrink-0 items-center rounded-xl bg-white px-1 shadow-sm ring-1 ring-slate-200">
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
            </div>
          ) : null}
          <div className="flex h-8 shrink-0 items-center gap-2 rounded-xl bg-white px-2.5 text-xs text-slate-600 shadow-sm ring-1 ring-slate-200">
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="全局启用开关" />
            <span className="font-medium">全局启用</span>
          </div>
          {saveError ? (
            <span className="max-w-[220px] truncate text-xs text-rose-700" role="status">
              {saveError}
            </span>
          ) : null}
          <Button
            className="h-8 px-3 text-xs"
            onClick={saveChanges}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />
                保存中...
              </>
            ) : (
              <>
                保存
                {unsaved ? (
                  <span
                    className="ml-1.5 size-1.5 rounded-full bg-amber-400"
                    aria-label="有未保存的更改"
                  />
                ) : null}
              </>
            )}
          </Button>
          <Button
            variant="outline"
            className="h-8 px-3 text-xs"
            onClick={resetCurrentTheme}
          >
            <RotateCcw className="mr-1.5 size-3.5" aria-hidden="true" />
            恢复主题默认
          </Button>
        </div>
      </div>
    </div>
  );
}
