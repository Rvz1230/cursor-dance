import { app, BrowserWindow, nativeImage } from "electron";
import { join } from "path";
import type { NativeCursorEvent, NativeKeyboardEvent } from "./native-events";
import { broadcastToWindows } from "./broadcast";
import {
  createOverlayWindow,
  destroyAllOverlays,
  destroyOverlayWindow,
  getOverlayWindows,
  syncOverlayBounds,
} from "./overlay-window";
import { createWorkbenchWindow } from "./workbench-window";
import { createWorkbenchWindowController } from "./workbench-window-controller";
import { getAllDisplays, onDisplayChanges } from "./screen-utils";
import { registerStoreIpc, unregisterStoreIpc } from "./ipc-handlers";
import { registerDialogIpc, unregisterDialogIpc } from "./dialog-handlers";
import { registerActiveWindowIpc, unregisterActiveWindowIpc } from "./active-window";
import { registerWindowControlsIpc, unregisterWindowControlsIpc } from "./window-controls";
import { registerFirstRunIpc, unregisterFirstRunIpc } from "./first-run";
import { registerAiIpc, unregisterAiIpc } from "./ai-ipc";
import { registerCursorVisibilityIpc, restoreNativeCursor, unregisterCursorVisibilityIpc } from "./cursor-visibility";
import { startEmbeddedAiServer, stopEmbeddedAiServer } from "./api-server";
import { registerAutoUpdater } from "./auto-updater";
import { createTray, destroyTray } from "./tray";
import {
  onConfigChange,
  readConfig,
  writeConfig,
} from "./electron-store";
import { CURSOR_EVENT, KEYBOARD_EVENT } from "../../shared/ipc-channels";

let stopMouseCapture: (() => void) | null = null;
let stopDisplayWatcher: (() => void) | null = null;
let stopEnableWatcher: (() => void) | null = null;
let stopAutoUpdater: (() => void) | null = null;

const isDesktopSmokeTest = process.env.CURSORDANCE_DESKTOP_SMOKE === "1";
const smokeUserDataPath = process.env.CURSORDANCE_DESKTOP_SMOKE_USER_DATA;

// Electron smoke uses an isolated profile and avoids touching global input,
// tray and network services. Window creation, IPC, persistence and overlay
// visibility still run through the production code paths.
if (isDesktopSmokeTest && smokeUserDataPath) {
  app.setPath("userData", smokeUserDataPath);
}

const workbenchWindowController = createWorkbenchWindowController(createWorkbenchWindow);

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
}

function broadcastCursorEvent(event: NativeCursorEvent): void {
  broadcastToWindows(() => [...getOverlayWindows().values()], CURSOR_EVENT, event);
}

function broadcastKeyboardEvent(event: NativeKeyboardEvent): void {
  broadcastToWindows(() => [...getOverlayWindows().values()], KEYBOARD_EVENT, event);
}

function ensureOverlayPerDisplay(): void {
  for (const display of getAllDisplays()) {
    createOverlayWindow(display);
  }
}

// ----------------------------------------------------------------
// 任务 4.1：全局 enabled 开关 —— tray / popup / workbench 共用一份
//
// 真值来自 electron-store 的 cursordance.config.enabled。tray 不能直接读 store——
// 通过 isEnabled / toggleEnabled / onEnabledChange 三个回调注入。
//
// toggleEnabled 写回 store 后会经 STORE_CHANGED 广播给所有 renderer，所以
// workbench 的 enabled toggle 和 tray 菜单是双向同步的。
// 同时驱动 overlay 窗口的 show/hide：禁用时不渲染粒子，但保留窗口对象
// （setIgnoreMouseEvents + 透明，hide 比 destroy 便宜）。
// ----------------------------------------------------------------

function getEnabledFromStore(): boolean {
  const config = readConfig() as { enabled?: boolean } | null;
  // 未写入过的 fresh 状态默认开启，与扩展端 normalizeStoredConfig 的默认值一致。
  return config?.enabled !== false;
}

function setOverlayVisibility(visible: boolean): void {
  for (const win of getOverlayWindows().values()) {
    if (win.isDestroyed()) continue;
    if (visible) {
      // 不抢焦点，保持原有 showInactive 语义
      if (!win.isVisible()) win.showInactive();
    } else if (win.isVisible()) {
      win.hide();
    }
  }
  if (!visible) restoreNativeCursor();
}

function toggleEnabled(): void {
  const current = readConfig() as Record<string, unknown> | null;
  const next = { ...(current ?? {}), enabled: !getEnabledFromStore() };
  writeConfig(next);
  // 写盘后 STORE_CHANGED 会被 ipc-handlers 广播给所有 renderer；
  // 我们只关心副作用：同步 overlay 显隐 + 重建 tray 菜单（onConfigChange 兜底）。
  setOverlayVisibility(next.enabled as boolean);
}

function openWorkbench(): void {
  workbenchWindowController.open();
}

void app.whenReady().then(async () => {
  if (process.platform === "darwin" && !app.isPackaged && app.dock) {
    const iconPath = join(app.getAppPath(), "build/icon.png");
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      app.dock.setIcon(icon);
    }
  }

  // 0) 在所有窗口创建之前注册 store/live preview 的 ipcMain.handle，
  //    否则 renderer 启动时第一波 invoke 会拿不到 handler 直接挂。
  registerStoreIpc(() => BrowserWindow.getAllWindows());
  registerDialogIpc();
  registerActiveWindowIpc();
  registerWindowControlsIpc();
  registerFirstRunIpc();
  registerAiIpc();
  registerCursorVisibilityIpc();

  // 1) workbench 配置窗口（系统标题栏，任务 4.0 再改自绘）
  openWorkbench();

  // 2) 每个 display 一个 overlay
  ensureOverlayPerDisplay();
  stopDisplayWatcher = onDisplayChanges(({ added, removed, changed }) => {
    for (const d of added) createOverlayWindow(d);
    for (const d of removed) destroyOverlayWindow(d.id);
    for (const d of changed) syncOverlayBounds(d);
  });

  // 3) uiohook 全局鼠标捕获 → IPC 广播
  if (!isDesktopSmokeTest) {
    try {
      const { startGlobalMouseCapture } = await import("./native-events");
      stopMouseCapture = startGlobalMouseCapture(broadcastCursorEvent, broadcastKeyboardEvent);
    } catch (error) {
      console.error("[CursorDance] failed to start global mouse capture:", error);
    }
  }

  // 4) 系统托盘 + 全局 enabled 同步
  //    onConfigChange 是 store 变更的回调，tray 借此重建菜单；
  //    同时这里订阅一份用来同步 overlay 显隐——无论是 tray 触发还是 workbench
  //    触发的 enabled 翻转都会走到这里。
  setOverlayVisibility(getEnabledFromStore());
  stopEnableWatcher = onConfigChange(() => {
    setOverlayVisibility(getEnabledFromStore());
  });
  if (!isDesktopSmokeTest) {
    createTray({
      openWorkbench,
      quitApp: () => app.quit(),
      isEnabled: getEnabledFromStore,
      toggleEnabled,
      onEnabledChange: (cb) => onConfigChange(() => cb(getEnabledFromStore())),
    });
  }

  // 5) 嵌入式 AI 服务：在 IPC + 托盘都就位后启动。失败不阻塞主流程——
  //    AiSchemePanel 在请求失败时会显示错误信息，用户去设置面板填 API key 再重试。
  if (!isDesktopSmokeTest) {
    startEmbeddedAiServer().catch((error) => {
      console.error("[cursordance] failed to start embedded AI server:", error);
    });
  }

  // 6) 自动更新（任务 6.1）：仅在 packaged 模式下启用，dev 跳过。
  //    立即检查一次，之后 4h 轮询；下载完成等到下次正常退出再安装。
  if (!isDesktopSmokeTest) {
    stopAutoUpdater = registerAutoUpdater();
  }

  app.on("activate", () => {
    openWorkbench();
    ensureOverlayPerDisplay();
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
  stopEnableWatcher?.();
  stopEnableWatcher = null;
  stopAutoUpdater?.();
  stopAutoUpdater = null;
  destroyTray();
  unregisterStoreIpc();
  unregisterDialogIpc();
  unregisterActiveWindowIpc();
  unregisterWindowControlsIpc();
  unregisterFirstRunIpc();
  unregisterAiIpc();
  unregisterCursorVisibilityIpc();
  restoreNativeCursor();
  stopEmbeddedAiServer().catch(() => undefined);
  destroyAllOverlays();
});

app.on("second-instance", () => {
  if (app.isReady()) {
    openWorkbench();
  } else {
    void app.whenReady().then(openWorkbench);
  }
});

// 仅给测试 / 工具脚本使用
export const __mainTesting__ = { getOverlayWindows };
