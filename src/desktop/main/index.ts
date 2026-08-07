import { app, BrowserWindow, nativeImage } from "electron";
import { join } from "path";
import type { NativeKeyboardEvent } from "./native-events";
import { broadcastToWindows, sendToWindow } from "./broadcast";
import {
  createOverlayWindow,
  destroyAllOverlays,
  destroyOverlayWindow,
  getOverlayWindows,
  setOverlayWindowVisibility,
  syncOverlayBounds,
} from "./overlay-window";
import { createWorkbenchWindow } from "./workbench-window";
import { createWorkbenchWindowController } from "./workbench-window-controller";
import {
  registerInstalledApplicationsIpc,
  unregisterInstalledApplicationsIpc,
} from "./installed-applications";
import { getAllDisplays, getKeyboardTargetDisplayId, nativePointToDip, onDisplayChanges } from "./screen-utils";
import { createCursorEventRouter, type CursorEventRouter, type RoutedCursorEvent } from "./cursor-event-router";
import { registerStoreIpc, unregisterStoreIpc } from "./ipc-handlers";
import { registerDialogIpc, unregisterDialogIpc } from "./dialog-handlers";
import { createActiveWindowMonitor, getActiveWindowSnapshot, registerActiveWindowIpc, unregisterActiveWindowIpc } from "./active-window";
import { createWindowPickerController, registerWindowPickerIpc, unregisterWindowPickerIpc } from "./window-picker";
import { registerWindowControlsIpc, unregisterWindowControlsIpc } from "./window-controls";
import { registerFirstRunIpc, unregisterFirstRunIpc } from "./first-run";
import { registerAiIpc, unregisterAiIpc } from "./ai-ipc";
import { registerCursorVisibilityIpc, restoreNativeCursor, unregisterCursorVisibilityIpc } from "./cursor-visibility";
import { shouldKeepOverlaysVisible } from "./overlay-visibility";
import { registerAutoUpdater } from "./auto-updater";
import { registerUpdateIpc } from "./update-ipc";
import { createTray, destroyTray } from "./tray";
import {
  onConfigChange,
  onLivePreviewChange,
  readConfig,
  readLivePreview,
  writeConfig,
} from "./electron-store";
import { APP_ACTIVE_WINDOW_CHANGED, APP_UPDATE_STATE_CHANGED, CURSOR_EVENT, KEYBOARD_EVENT } from "../../shared/ipc-channels";
import {
  registerAssetProtocol,
  registerAssetSchemePrivileges,
  unregisterAssetProtocol,
} from "./asset-protocol";
import type { ActiveWindowSnapshot } from "../../shared/app-rules";

let stopMouseCapture: (() => void) | null = null;
let stopDisplayWatcher: (() => void) | null = null;
let stopVisibilityWatchers: (() => void) | null = null;
let stopAutoUpdater: (() => void) | null = null;
let stopActiveWindowMonitor: (() => void) | null = null;
let cursorEventRouter: CursorEventRouter | null = null;
let cursorIpcMessageCount = 0;
let activeWindowSnapshot: ActiveWindowSnapshot | null = null;
const windowPickerController = createWindowPickerController({ readSnapshot: getActiveWindowSnapshot });

const isDesktopSmokeTest = process.env.CURSORDANCE_DESKTOP_SMOKE === "1";
const smokeUserDataPath = process.env.CURSORDANCE_DESKTOP_SMOKE_USER_DATA;

// Electron smoke uses an isolated profile and avoids touching global input,
// tray and network services. Window creation, IPC, persistence and overlay
// visibility still run through the production code paths.
if (isDesktopSmokeTest && smokeUserDataPath) {
  app.setPath("userData", smokeUserDataPath);
}

registerAssetSchemePrivileges();

const workbenchWindowController = createWorkbenchWindowController(createWorkbenchWindow);

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
}

function sendCursorEventToDisplay(displayId: number, event: RoutedCursorEvent): void {
  const target = getOverlayWindows().get(displayId);
  if (target?.isVisible()) {
    sendToWindow(target, CURSOR_EVENT, event);
    if (isDesktopSmokeTest) cursorIpcMessageCount += 1;
  }
}

function routeKeyboardEvent(event: NativeKeyboardEvent): void {
  windowPickerController.handleKeyboardEvent(event);
  const displayId = getKeyboardTargetDisplayId() ?? cursorEventRouter?.getActiveDisplayId();
  if (displayId === null || displayId === undefined) return;
  const target = getOverlayWindows().get(displayId);
  if (target?.isVisible()) sendToWindow(target, KEYBOARD_EVENT, event);
}

function ensureOverlayPerDisplay(): void {
  for (const display of getAllDisplays()) {
    createOverlayWindow(display, shouldShowOverlays);
  }
}

// ----------------------------------------------------------------
// 全局 enabled 开关 —— tray / workbench 共用一份
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

function shouldShowOverlays(): boolean {
  return shouldKeepOverlaysVisible(readLivePreview() ?? readConfig(), activeWindowSnapshot);
}

function setOverlayVisibility(visible: boolean): void {
  for (const win of getOverlayWindows().values()) {
    setOverlayWindowVisibility(win, visible);
  }
  if (!visible) restoreNativeCursor();
}

function publishActiveWindowSnapshot(snapshot: ActiveWindowSnapshot): void {
  activeWindowSnapshot = snapshot;
  broadcastToWindows(() => BrowserWindow.getAllWindows(), APP_ACTIVE_WINDOW_CHANGED, snapshot);
  setOverlayVisibility(shouldShowOverlays());
}

function toggleEnabled(): void {
  const current = readConfig() as Record<string, unknown> | null;
  const next = { ...(current ?? {}), enabled: !getEnabledFromStore() };
  writeConfig(next);
  // 写盘后 STORE_CHANGED 会被 ipc-handlers 广播给所有 renderer；
  // 我们只关心副作用：同步 overlay 显隐 + 重建 tray 菜单（onConfigChange 兜底）。
  setOverlayVisibility(shouldShowOverlays());
}

function openWorkbench(): void {
  workbenchWindowController.open();
}

void app.whenReady().then(async () => {
  registerAssetProtocol();

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
  const activeWindowMonitor = createActiveWindowMonitor({
    publish: publishActiveWindowSnapshot,
  });
  registerActiveWindowIpc(() => activeWindowMonitor.getCurrent());
  registerInstalledApplicationsIpc();
  registerWindowPickerIpc(windowPickerController);
  if (isDesktopSmokeTest) {
    activeWindowMonitor.poll();
  } else {
    stopActiveWindowMonitor = activeWindowMonitor.start();
  }
  registerWindowControlsIpc();
  registerFirstRunIpc();
  registerAiIpc();
  registerCursorVisibilityIpc();
  const updateController = registerAutoUpdater({
    isPackaged: app.isPackaged && !isDesktopSmokeTest,
    publish: (state) => {
      broadcastToWindows(() => BrowserWindow.getAllWindows(), APP_UPDATE_STATE_CHANGED, state);
    },
  });
  const unregisterUpdateIpc = registerUpdateIpc(updateController);
  stopAutoUpdater = () => {
    unregisterUpdateIpc();
    updateController.stop();
  };

  // 1) Workbench 配置窗口
  openWorkbench();

  // 2) 每个 display 一个 overlay
  ensureOverlayPerDisplay();
  cursorEventRouter = createCursorEventRouter({
    getDisplays: getAllDisplays,
    toDipPoint: nativePointToDip,
    sendToDisplay: sendCursorEventToDisplay,
  });
  if (isDesktopSmokeTest) {
    const testingGlobal = globalThis as typeof globalThis & {
      __cursorDanceMainTesting?: {
        routeCursorEvent: (event: RoutedCursorEvent) => void;
        routeKeyboardEvent: (event: NativeKeyboardEvent) => void;
        flushPendingMove: () => void;
        getActiveDisplayId: () => number | null;
        resetCursorIpcCount: () => void;
        getCursorIpcCount: () => number;
        publishActiveWindowSnapshot: (snapshot: ActiveWindowSnapshot) => void;
      };
    };
    testingGlobal.__cursorDanceMainTesting = {
      routeCursorEvent: (event) => {
        if (event.type !== "leave") {
          windowPickerController.handleCursorEvent(event);
          cursorEventRouter?.route(event);
        }
      },
      routeKeyboardEvent,
      flushPendingMove: () => cursorEventRouter?.flushPendingMove(),
      getActiveDisplayId: () => cursorEventRouter?.getActiveDisplayId() ?? null,
      resetCursorIpcCount: () => { cursorIpcMessageCount = 0; },
      getCursorIpcCount: () => cursorIpcMessageCount,
      publishActiveWindowSnapshot,
    };
  }
  stopDisplayWatcher = onDisplayChanges(({ added, removed, changed }) => {
    for (const d of added) createOverlayWindow(d, shouldShowOverlays);
    for (const d of removed) {
      cursorEventRouter?.removeDisplay(d.id);
      destroyOverlayWindow(d.id);
    }
    for (const d of changed) syncOverlayBounds(d);
  });

  // 3) uiohook 全局鼠标捕获 → IPC 广播
  if (!isDesktopSmokeTest) {
    try {
      const { startGlobalMouseCapture } = await import("./native-events");
      stopMouseCapture = startGlobalMouseCapture(
        (event) => {
          windowPickerController.handleCursorEvent(event);
          cursorEventRouter?.route(event);
        },
        routeKeyboardEvent,
      );
    } catch (error) {
      console.error("[CursorDance] failed to start global mouse capture:", error);
    }
  }

  // 4) 系统托盘 + 全局 enabled 同步
  //    onConfigChange 是 store 变更的回调，tray 借此重建菜单；
  //    同时这里订阅一份用来同步 overlay 显隐——无论是 tray 触发还是 workbench
  //    触发的 enabled 翻转都会走到这里。
  setOverlayVisibility(shouldShowOverlays());
  const stopConfigVisibilityWatcher = onConfigChange(() => {
    setOverlayVisibility(shouldShowOverlays());
  });
  const stopPreviewVisibilityWatcher = onLivePreviewChange(() => {
    setOverlayVisibility(shouldShowOverlays());
  });
  stopVisibilityWatchers = () => {
    stopConfigVisibilityWatcher();
    stopPreviewVisibilityWatcher();
  };
  if (!isDesktopSmokeTest) {
    createTray({
      openWorkbench,
      quitApp: () => app.quit(),
      isEnabled: getEnabledFromStore,
      toggleEnabled,
      onEnabledChange: (cb) => onConfigChange(() => cb(getEnabledFromStore())),
    });
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
  cursorEventRouter?.stop();
  cursorEventRouter = null;
  delete (globalThis as typeof globalThis & { __cursorDanceMainTesting?: unknown }).__cursorDanceMainTesting;
  stopDisplayWatcher?.();
  stopDisplayWatcher = null;
  stopVisibilityWatchers?.();
  stopVisibilityWatchers = null;
  stopAutoUpdater?.();
  stopAutoUpdater = null;
  stopActiveWindowMonitor?.();
  stopActiveWindowMonitor = null;
  destroyTray();
  unregisterStoreIpc();
  unregisterDialogIpc();
  unregisterActiveWindowIpc();
  unregisterInstalledApplicationsIpc();
  unregisterWindowPickerIpc(windowPickerController);
  unregisterWindowControlsIpc();
  unregisterFirstRunIpc();
  unregisterAiIpc();
  unregisterCursorVisibilityIpc();
  unregisterAssetProtocol();
  restoreNativeCursor();
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
