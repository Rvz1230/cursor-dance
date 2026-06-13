// 任务 4.0：Workbench 自绘标题栏
//
// 替换桌面端 WorkbenchHeader 的角色，把 workspace tabs / 全局启用开关 / 保存 /
// 恢复默认 / AI 助手按钮 + Brand mark 全部塞进 40px(macOS) / 32px(Windows/Linux)
// 高度的标题栏。整条 -webkit-app-region: drag 可拖拽，所有交互元素显式 no-drag。
//
// 拖拽规则：drag 写在最外层容器，no-drag 必须打在「具体的可点击元素」上，
// 不能打在容器上——否则容器内的 gap/padding/空白也会变成 no-drag，
// 整条标题栏就会丢失大片可拖区域（早期版本踩过这个坑）。
//
// macOS：titleBarStyle: 'hiddenInset' 下系统在左上角渲染红绿灯（trafficLights），
// 给 80px 左侧留白避让；右侧不渲染窗口控制按钮（系统已提供）。
// Windows/Linux：frame: false，标题栏右侧自绘 minimize / maximize / close 三按钮，
// 通过 cursorDanceWindow.* IPC 调用主进程操作 BrowserWindow。
//
// 状态：通过 cursorDanceWindow.onStateChanged 订阅 maximize/unmaximize/fullscreen，
// 切换最大化按钮的图标（最大化 ↔ 还原）。

import { useEffect, useState } from "react";
import { Bot, Loader2, Maximize2, Minimize2, Minus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/ui/brand-mark";
import { Switch } from "@/components/ui/switch";
import { WorkspaceItem } from "@/app/pages/theme-workbench/components/WorkbenchControls";
import { cn } from "@/components/ui/utils";

type WorkspaceItemDescriptor = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
};

interface TitleBarProps {
  workspaceItems: WorkspaceItemDescriptor[];
  workspaceId: string;
  setWorkspaceId: (id: string) => void;
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  unsaved: boolean;
  isSaving: boolean;
  saveError?: string | null;
  saveChanges: () => void;
  resetCurrentTheme: () => void;
  aiPanelOpen?: boolean;
  setAiPanelOpen?: (value: boolean) => void;
}

const NO_DRAG_STYLE: React.CSSProperties = { WebkitAppRegion: "no-drag" } as React.CSSProperties;
const DRAG_STYLE: React.CSSProperties = { WebkitAppRegion: "drag" } as React.CSSProperties;

export function TitleBar({
  workspaceItems,
  workspaceId,
  setWorkspaceId,
  enabled,
  setEnabled,
  unsaved,
  isSaving,
  saveError,
  saveChanges,
  resetCurrentTheme,
  aiPanelOpen,
  setAiPanelOpen,
}: TitleBarProps) {
  const bridge = typeof window !== "undefined" ? window.cursorDanceWindow : undefined;
  const isMac = bridge?.platform === "darwin";
  const [isMaximized, setIsMaximized] = useState(false);

  // 初始状态 + 订阅。useEffect 而非 useLayoutEffect:图标切换非关键路径，
  // 避免阻塞首屏渲染。
  useEffect(() => {
    if (!bridge) return;
    let alive = true;
    bridge.getState().then((state) => {
      if (alive) setIsMaximized(state.isMaximized);
    });
    const unsubscribe = bridge.onStateChanged((state) => {
      if (alive) setIsMaximized(state.isMaximized);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [bridge]);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div
        className={cn(
          "flex items-stretch",
          isMac ? "h-10 pl-[80px]" : "h-8 pl-3",
        )}
        style={DRAG_STYLE}
      >
        {/* 品牌区:全程可拖（兜底死区，确保中间被填满时仍然有地方拖窗口）。
            BrandMark 是 SVG，no-drag 不需要——它没有 click handler。 */}
        <div className="flex shrink-0 items-center gap-2 pr-2">
          <BrandMark size="sm" />
          <div className="hidden min-w-0 sm:block">
            <div className="text-xs font-semibold leading-tight text-slate-950">CursorDance</div>
            <div className="text-[10px] leading-tight text-slate-500">主题工作台</div>
          </div>
        </div>

        {/* tabs 容器本身保持 drag（gap / padding / 空白处都能拖窗口），
            no-drag 只贴在每个 WorkspaceItem 按钮自己身上。 */}
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-2 py-1">
          {workspaceItems.map((item) => (
            <span key={item.id} style={NO_DRAG_STYLE} className="inline-flex">
              <WorkspaceItem
                item={item}
                active={workspaceId === item.id}
                onClick={() => setWorkspaceId(item.id)}
                compact
              />
            </span>
          ))}
        </div>

        {/* 右侧按钮组容器同样保持 drag，no-drag 下放到具体按钮 / 开关包装块。 */}
        <div className="flex shrink-0 items-center gap-2 pr-2">
          {workspaceId === "workbench" ? (
            <Button
              variant={aiPanelOpen ? "default" : "outline"}
              className="h-7 px-2.5 text-xs"
              style={NO_DRAG_STYLE}
              onClick={() => setAiPanelOpen?.(!aiPanelOpen)}
            >
              <Bot className="mr-1.5 h-3.5 w-3.5" />
              AI 助手
            </Button>
          ) : null}
          <div
            className="hidden h-7 items-center gap-2 rounded-xl bg-slate-50 px-2.5 text-xs text-slate-600 xl:flex"
            style={NO_DRAG_STYLE}
          >
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="全局启用开关" />
            <span>全局启用</span>
          </div>
          <Button
            className="h-7 bg-slate-950 px-2.5 text-xs text-white hover:bg-slate-800"
            style={NO_DRAG_STYLE}
            onClick={saveChanges}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
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
            className="h-7 px-2.5 text-xs"
            style={NO_DRAG_STYLE}
            onClick={resetCurrentTheme}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            恢复默认
          </Button>
        </div>

        {/* 非 macOS:自绘窗口控制按钮（minimize / maximize / close）。
            macOS 下系统已渲染红绿灯，不需要重复。这里也只在按钮上 no-drag。 */}
        {!isMac && bridge ? (
          <div className="flex shrink-0 items-stretch">
            <WindowControlButton
              ariaLabel="最小化"
              onClick={() => bridge.minimize()}
            >
              <Minus className="h-3.5 w-3.5" />
            </WindowControlButton>
            <WindowControlButton
              ariaLabel={isMaximized ? "还原" : "最大化"}
              onClick={() => bridge.toggleMaximize()}
            >
              {isMaximized ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </WindowControlButton>
            <WindowControlButton
              ariaLabel="关闭"
              onClick={() => bridge.close()}
              variant="close"
            >
              <X className="h-3.5 w-3.5" />
            </WindowControlButton>
          </div>
        ) : null}
      </div>
      {saveError ? (
        <div
          className="border-t border-rose-100 bg-rose-50 px-3 py-1.5 text-xs text-rose-700"
          style={NO_DRAG_STYLE}
        >
          {saveError}
        </div>
      ) : null}
    </header>
  );
}

interface WindowControlButtonProps {
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
  variant?: "default" | "close";
}

function WindowControlButton({
  ariaLabel,
  onClick,
  children,
  variant = "default",
}: WindowControlButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={NO_DRAG_STYLE}
      className={cn(
        "inline-flex w-11 items-center justify-center text-slate-600 transition-colors",
        variant === "close"
          ? "hover:bg-rose-500 hover:text-white"
          : "hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      {children}
    </button>
  );
}
