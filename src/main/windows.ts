// CursorDance 桌面 — overlay 窗口管理
//
// overlay 窗口的形态：
//   - 透明、无边框、置顶到 screen-saver 层
//   - 鼠标穿透（setIgnoreMouseEvents true + forward true，让鼠标位置仍能 forward
//     给主进程；实际的全局鼠标已经由 uiohook 抓，forward 主要是为了 cursor 不被吞）
//   - 全 workspace 可见 + 全屏可见
//   - backgroundThrottling 关闭，避免 alwaysOnTop 在不可见 workspace 时降帧
//   - type 用默认 'normal' —— macOS 上 toolbar/panel 会被 Mission Control 吞，
//     normal + alwaysOnTop:'screen-saver' 是兼容性最稳的组合
//
// 每个 display 一个窗口，bounds 跟随 display.bounds，windowsByDisplayId 对外暴露。

import { BrowserWindow, type Display } from "electron";
import { join } from "path";
import { fileURLToPath } from "url";
import { bindWindowStateBroadcast } from "./window-controls";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const HIDE_NATIVE_CURSOR_CSS = `
  *, *::before, *::after { cursor: none !important; }
  html, body { background: transparent !important; }
`;

const overlayWindows = new Map<number, BrowserWindow>();

export function getOverlayWindows(): ReadonlyMap<number, BrowserWindow> {
  return overlayWindows;
}

/**
 * 为指定 display 创建 overlay 窗口。已存在时返回现有实例（不重建）。
 */
export function createOverlayWindow(display: Display): BrowserWindow {
  const existing = overlayWindows.get(display.id);
  if (existing && !existing.isDestroyed()) return existing;

  const { x, y, width, height } = display.bounds;

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
    type: process.platform === "linux" ? undefined : "normal",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  // 鼠标穿透：forward:true 在 macOS 仍能让 hover 事件传递出去——但我们走的是
  // uiohook 全局抓事件，主要诉求只是「不要把点击吃掉」。
  win.setIgnoreMouseEvents(true, { forward: true });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // macOS：把窗口排除出 Mission Control 的应用窗口列表
  if (process.platform === "darwin") {
    try {
      win.setHiddenInMissionControl(true);
    } catch {
      // Electron 较老版本无此 API，吞掉即可
    }
  }

  win.webContents.on("did-finish-load", () => {
    win.webContents.insertCSS(HIDE_NATIVE_CURSOR_CSS).catch(() => {});
    win.showInactive(); // 不抢焦点
  });

  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    win.loadURL(`${devUrl}/overlay/index.html`);
  } else {
    win.loadFile(join(__dirname, "../renderer/overlay/index.html"));
  }

  overlayWindows.set(display.id, win);
  win.once("closed", () => {
    overlayWindows.delete(display.id);
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
}

/** 全部销毁——退出前清理。 */
export function destroyAllOverlays(): void {
  for (const win of overlayWindows.values()) {
    if (!win.isDestroyed()) win.destroy();
  }
  overlayWindows.clear();
}

// ============================================================
// Workbench 窗口（任务 4.0：自绘标题栏）
//
// macOS：titleBarStyle: 'hiddenInset' —— 系统仍渲染左上角红绿灯（trafficLights），
// 整个窗口顶部 40px 由 TitleBar 自绘且 -webkit-app-region: drag。trafficLightPosition
// 给红绿灯留 14/14 内边距，对齐 DESIGN-desktop.md 的「左侧 80px 留给红绿灯」。
//
// Windows / Linux：frame: false —— 完全无系统装饰，TitleBar 自绘 minimize / maximize /
// close 三个按钮（通过 cursordance:window-* IPC 调用 BrowserWindow 方法）。
//
// 两套都把 maximize/unmaximize/fullscreen 状态广播给 renderer，TitleBar 据此切换图标
// （最大化 ↔ 还原），见 window-controls.ts。
// ============================================================

export function createWorkbenchWindow(): BrowserWindow {
  const isMac = process.platform === "darwin";
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false,
    frame: isMac ? undefined : false,
    titleBarStyle: isMac ? "hiddenInset" : "default",
    trafficLightPosition: isMac ? { x: 14, y: 14 } : undefined,
    backgroundColor: "#f1f5f9",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.on("ready-to-show", () => win.show());

  const unbindStateBroadcast = bindWindowStateBroadcast(win);
  win.once("closed", () => {
    unbindStateBroadcast();
  });

  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    win.loadURL(`${devUrl}/workbench/index.html`);
  } else {
    win.loadFile(join(__dirname, "../renderer/workbench/index.html"));
  }

  return win;
}
