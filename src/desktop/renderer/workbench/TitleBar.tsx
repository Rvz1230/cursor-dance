// Workbench 自绘标题栏
//
// 标题栏只承载窗口拖拽和品牌；workspace tabs、保存 / 恢复 / AI / 全局启用等
// 操作放到 Workbench 内容区操作栏，避免 macOS 32px 标题栏被按钮挤压。
// 整条 -webkit-app-region: drag 可拖拽，所有交互元素显式 no-drag。
//
// 拖拽规则：drag 写在最外层容器，no-drag 必须打在「具体的可点击元素」上，
// 不能打在容器上——否则容器内的 gap/padding/空白也会变成 no-drag，
// 整条标题栏就会丢失大片可拖区域（早期版本踩过这个坑）。
//
// macOS：titleBarStyle: 'hiddenInset' 下系统在左上角渲染红绿灯（trafficLights），
// 给 72px 左侧留白避让；右侧不渲染窗口控制按钮（系统已提供）。
// Windows/Linux：frame: false，标题栏右侧自绘 minimize / maximize / close 三按钮，
// 通过 cursorDanceWindow.* IPC 调用主进程操作 BrowserWindow。
//
// 状态：通过 cursorDanceWindow.onStateChanged 订阅 maximize/unmaximize/fullscreen，
// 切换最大化按钮的图标（最大化 ↔ 还原）。

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Loader2, Maximize2, Minimize2, Minus, RefreshCw, X } from "lucide-react";
import { BrandMark } from "@/components/ui/brand-mark";
import { cn } from "@/components/ui/utils";
import type { DesktopUpdateState } from "../../../shared/desktop-update";
import { useDesktopUpdate } from "./useDesktopUpdate";

const NO_DRAG_STYLE: React.CSSProperties = { WebkitAppRegion: "no-drag" } as React.CSSProperties;
const DRAG_STYLE: React.CSSProperties = { WebkitAppRegion: "drag" } as React.CSSProperties;

export function TitleBar() {
  const bridge = typeof window !== "undefined" ? window.cursorDanceWindow : undefined;
  const isMac = bridge?.platform === "darwin";
  const [isMaximized, setIsMaximized] = useState(false);
  const update = useDesktopUpdate();

  // 初始状态 + 订阅。useEffect 而非 useLayoutEffect:图标切换非关键路径，
  // 避免阻塞首屏渲染。
  useEffect(() => {
    if (!bridge) return;
    let alive = true;
    void bridge.getState().then((state) => {
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
          isMac ? "h-8 pl-[72px]" : "h-8 pl-3",
        )}
        style={DRAG_STYLE}
      >
        <div className="flex shrink-0 items-center gap-2 pr-2">
          <BrandMark size="sm" />
          <div className="hidden min-w-0 sm:block">
            <div className="text-sm font-semibold leading-tight text-slate-900 text-balance">CursorDance</div>
            <div className="text-xs leading-tight text-slate-500 text-pretty">主题工作台</div>
          </div>
        </div>

        <div className="min-w-0 flex-1" />

        <UpdateControl state={update.state} onAction={update.runPrimaryAction} />

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
    </header>
  );
}

function UpdateControl({
  state,
  onAction,
}: {
  state: DesktopUpdateState;
  onAction: () => Promise<void>;
}) {
  if (state.status === "unsupported") return null;

  const isBusy = state.status === "checking" || state.status === "downloading";
  const content = (() => {
    switch (state.status) {
      case "checking":
        return { icon: Loader2, label: "检查更新中", spin: true };
      case "available":
        return { icon: Download, label: state.version ? `下载 v${state.version}` : "下载更新" };
      case "downloading":
        return { icon: Loader2, label: `下载中 ${state.percent ?? 0}%`, spin: true };
      case "downloaded":
        return { icon: RefreshCw, label: "重启更新" };
      case "up-to-date":
        return { icon: CheckCircle2, label: "已是最新" };
      case "error":
        return { icon: AlertTriangle, label: "更新失败，重试" };
      default:
        return { icon: RefreshCw, label: "检查更新" };
    }
  })();
  const Icon = content.icon;

  return (
    <button
      type="button"
      onClick={() => { void onAction(); }}
      disabled={isBusy}
      title={state.message || content.label}
      style={NO_DRAG_STYLE}
      className={cn(
        "mr-2 inline-flex h-6 shrink-0 items-center gap-1.5 self-center rounded-lg px-2 text-[11px] font-medium transition-colors",
        state.status === "error"
          ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
          : state.status === "available" || state.status === "downloaded"
            ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
        isBusy && "cursor-default opacity-80",
      )}
    >
      <Icon className={cn("size-3", content.spin && "animate-spin")} aria-hidden="true" />
      <span>{content.label}</span>
    </button>
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
