import { app, BrowserWindow } from "electron";
import { join } from "path";
import { fileURLToPath } from "url";
import { startGlobalMouseCapture, type NativeCursorEvent } from "./native-events";
import { CURSOR_EVENT } from "../shared/ipc-channels";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

let mainWindow: BrowserWindow | null = null;
let stopMouseCapture: (() => void) | null = null;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (devUrl) {
    mainWindow.loadURL(`${devUrl}/workbench/index.html`);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/workbench/index.html"));
  }
}

function broadcastCursorEvent(event: NativeCursorEvent): void {
  // 当前阶段还没有 overlay 窗口（任务 2.7 创建），先广播给所有 BrowserWindow，
  // overlay 窗口落地后通过 preload 监听同一个频道即可。
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.webContents.send(CURSOR_EVENT, event);
  }
}

app.whenReady().then(() => {
  createMainWindow();

  // 启动全局鼠标捕获（uiohook-napi）。出错降级：main 进程继续跑，但 overlay 不会收事件。
  try {
    stopMouseCapture = startGlobalMouseCapture(broadcastCursorEvent);
  } catch (error) {
    console.error("[CursorDance] failed to start global mouse capture:", error);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  stopMouseCapture?.();
  stopMouseCapture = null;
});

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});
