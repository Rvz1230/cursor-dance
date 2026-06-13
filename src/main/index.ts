import { app, BrowserWindow } from "electron";
import { startGlobalMouseCapture, type NativeCursorEvent } from "./native-events";
import {
  createOverlayWindow,
  createWorkbenchWindow,
  destroyAllOverlays,
  destroyOverlayWindow,
  getOverlayWindows,
  syncOverlayBounds,
} from "./windows";
import { getAllDisplays, onDisplayChanges } from "./screen-utils";
import { CURSOR_EVENT } from "../shared/ipc-channels";

let workbenchWindow: BrowserWindow | null = null;
let stopMouseCapture: (() => void) | null = null;
let stopDisplayWatcher: (() => void) | null = null;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
}

function broadcastCursorEvent(event: NativeCursorEvent): void {
  // overlay 窗口和 workbench 都订阅同一个频道；发到所有 BrowserWindow，
  // 渲染进程自行决定是否消费（overlay 走 engine 渲染，workbench 走预览面板）。
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.webContents.send(CURSOR_EVENT, event);
  }
}

function ensureOverlayPerDisplay(): void {
  for (const display of getAllDisplays()) {
    createOverlayWindow(display);
  }
}

app.whenReady().then(() => {
  // 1) workbench 配置窗口（系统标题栏，任务 4.0 再改自绘）
  workbenchWindow = createWorkbenchWindow();

  // 2) 每个 display 一个 overlay
  ensureOverlayPerDisplay();
  stopDisplayWatcher = onDisplayChanges(({ added, removed, changed }) => {
    for (const d of added) createOverlayWindow(d);
    for (const d of removed) destroyOverlayWindow(d.id);
    for (const d of changed) syncOverlayBounds(d);
  });

  // 3) uiohook 全局鼠标捕获 → IPC 广播
  try {
    stopMouseCapture = startGlobalMouseCapture(broadcastCursorEvent);
  } catch (error) {
    console.error("[CursorDance] failed to start global mouse capture:", error);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      workbenchWindow = createWorkbenchWindow();
      ensureOverlayPerDisplay();
    }
  });
});

app.on("window-all-closed", () => {
  // overlay 窗口是 closable:false / focusable:false，不会被普通关闭路径触发；
  // 真正驱动 quit 的是 workbench 关闭。但 macOS 习惯保留 dock 图标——这里不强制 quit。
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopMouseCapture?.();
  stopMouseCapture = null;
  stopDisplayWatcher?.();
  stopDisplayWatcher = null;
  destroyAllOverlays();
});

app.on("second-instance", () => {
  if (workbenchWindow && !workbenchWindow.isDestroyed()) {
    if (workbenchWindow.isMinimized()) workbenchWindow.restore();
    workbenchWindow.focus();
  }
});

// 仅给测试 / 工具脚本使用
export const __mainTesting__ = { getOverlayWindows };
