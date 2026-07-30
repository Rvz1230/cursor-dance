// CursorDance 桌面 — overlay 窗口管理
//
// overlay 窗口的形态：
//   - 透明、无边框、置顶到 screen-saver 层
//   - 鼠标穿透（setIgnoreMouseEvents true + forward true，让鼠标位置仍能 forward
//     给主进程；实际的全局鼠标已经由 uiohook 抓，forward 主要是为了 cursor 不被吞）
//   - 全 workspace 可见 + 全屏可见
//   - 显示时关闭 backgroundThrottling，隐藏时恢复节流，避免禁用上下文空转
//   - macOS 使用 NSPanel；普通 NSWindow 在多显示器同时全屏时可能只加入普通
//     Space，panel + canJoinAllSpaces/fullScreenAuxiliary 才能稳定覆盖每块屏幕
//
// 每个 display 一个窗口，bounds 跟随 display.bounds，overlayWindows 统一持有。

import { BrowserWindow, type Display } from "electron";
import { join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { desktopWindowKindArgument } from "../../shared/desktop-window-kind";
import { registerIpcSender } from "./ipc-security";
import { applyOverlaySpacePolicy, getOverlayWindowType } from "./overlay-space-policy";
import { bindWindowSecurity } from "./window-security";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const overlayWindows = new Map<number, BrowserWindow>();
type ShouldShowOverlay = () => boolean;

export function getOverlayWindows(): ReadonlyMap<number, BrowserWindow> {
  return overlayWindows;
}

export function setOverlayWindowVisibility(win: BrowserWindow, visible: boolean): void {
  if (win.isDestroyed() || win.webContents.isDestroyed()) return;
  if (visible) {
    win.webContents.setBackgroundThrottling(false);
    if (!win.isVisible()) {
      applyOverlaySpacePolicy(win);
      win.showInactive();
    }
    return;
  }
  if (win.isVisible()) win.hide();
  win.webContents.setBackgroundThrottling(true);
}

/**
 * 为指定 display 创建 overlay 窗口。已存在时返回现有实例（不重建）。
 */
export function createOverlayWindow(
  display: Display,
  shouldShow: ShouldShowOverlay = () => true,
): BrowserWindow {
  const existing = overlayWindows.get(display.id);
  if (existing && !existing.isDestroyed()) {
    existing.setBounds(display.bounds);
    applyOverlaySpacePolicy(existing);
    setOverlayWindowVisibility(existing, shouldShow());
    return existing;
  }

  const { x, y, width, height } = display.bounds;
  const visibleOnLoad = shouldShow();

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    fullscreenable: false,
    focusable: false,
    skipTaskbar: true,
    show: false,
    backgroundColor: "#00000000",
    type: getOverlayWindowType(),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      additionalArguments: [desktopWindowKindArgument("overlay")],
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !visibleOnLoad,
    },
  });
  const unregisterIpcSender = registerIpcSender(win.webContents, "overlay");

  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  const entryUrl = devUrl
    ? new URL("overlay/index.html", `${devUrl.replace(/\/$/, "")}/`).href
    : pathToFileURL(join(__dirname, "../renderer/overlay/index.html")).href;
  const unbindWindowSecurity = bindWindowSecurity(win.webContents, entryUrl);

  // 鼠标穿透：forward:true 在 macOS 仍能让 hover 事件传递出去——但我们走的是
  // uiohook 全局抓事件，主要诉求只是「不要把点击吃掉」。
  win.setIgnoreMouseEvents(true, { forward: true });
  applyOverlaySpacePolicy(win);

  win.webContents.on("did-finish-load", () => {
    // Renderer load/reload can recreate native compositor state. Consult the
    // latest config here so a disabled overlay is not accidentally shown by a
    // late load after startup or display hot-plug.
    setOverlayWindowVisibility(win, shouldShow());
  });

  void win.loadURL(entryUrl);

  overlayWindows.set(display.id, win);
  win.once("closed", () => {
    unregisterIpcSender();
    unbindWindowSecurity();
    if (overlayWindows.get(display.id) === win) {
      overlayWindows.delete(display.id);
    }
  });

  return win;
}

/** 关闭并清理某个 display 对应的 overlay。 */
export function destroyOverlayWindow(displayId: number): void {
  const win = overlayWindows.get(displayId);
  if (!win) return;
  if (!win.isDestroyed()) {
    win.destroy();
  }
  overlayWindows.delete(displayId);
}

/** 同步 overlay 边界到给定 display（display-metrics-changed 时调用）。 */
export function syncOverlayBounds(display: Display): void {
  const win = overlayWindows.get(display.id);
  if (!win || win.isDestroyed()) return;
  win.setBounds(display.bounds);
  applyOverlaySpacePolicy(win);
}

/** 全部销毁——退出前清理。 */
export function destroyAllOverlays(): void {
  for (const win of overlayWindows.values()) {
    if (!win.isDestroyed()) win.destroy();
  }
  overlayWindows.clear();
}
