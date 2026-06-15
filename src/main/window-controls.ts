// 任务 4.0：自绘标题栏的窗口控制 IPC
//
// 渲染进程的 TitleBar 通过 invoke 触发最小化 / 切换最大化 / 关闭，
// 主进程根据 event.sender 定位到对应 BrowserWindow。这样 renderer 不需要
// 知道任何 windowId，多窗口（workbench / popup）共用同一套桥。
//
// maximize/unmaximize 状态变化广播给该窗口的 webContents，让 TitleBar
// 切换图标（最大化 ↔ 还原）。close/maximize/minimize 都是 BrowserWindow
// 标准方法，主进程不做额外副作用。

import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from "electron";
import {
  WINDOW_CLOSE,
  WINDOW_GET_STATE,
  WINDOW_MINIMIZE,
  WINDOW_STATE_CHANGED,
  WINDOW_TOGGLE_MAXIMIZE,
} from "../shared/ipc-channels";

export interface WindowState {
  isMaximized: boolean;
  isFullScreen: boolean;
}

function senderWindow(event: IpcMainInvokeEvent): BrowserWindow | null {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win && !win.isDestroyed() ? win : null;
}

function snapshot(win: BrowserWindow): WindowState {
  return {
    isMaximized: win.isMaximized(),
    isFullScreen: win.isFullScreen(),
  };
}

/**
 * 给指定窗口绑定 maximize/unmaximize/enter-full-screen/leave-full-screen 监听，
 * 状态变更时通过 IPC 推送给同一个 webContents（让 TitleBar 切图标）。
 *
 * 返回 unbind 函数，窗口销毁前调用以避免泄漏（BrowserWindow 自身回收时
 * listener 也会一并清掉，但显式 off 更稳）。
 */
export function bindWindowStateBroadcast(win: BrowserWindow): () => void {
  const broadcast = () => {
    if (win.isDestroyed()) return;
    try {
      win.webContents.send(WINDOW_STATE_CHANGED, snapshot(win));
    } catch {
      // renderer 可能正在关闭/导航，IPC 管道已断，忽略即可。
    }
  };
  win.on("maximize", broadcast);
  win.on("unmaximize", broadcast);
  win.on("enter-full-screen", broadcast);
  win.on("leave-full-screen", broadcast);
  return () => {
    win.off("maximize", broadcast);
    win.off("unmaximize", broadcast);
    win.off("enter-full-screen", broadcast);
    win.off("leave-full-screen", broadcast);
  };
}

export function registerWindowControlsIpc(): void {
  ipcMain.handle(WINDOW_MINIMIZE, (event) => {
    const win = senderWindow(event);
    if (!win) return;
    win.minimize();
  });

  ipcMain.handle(WINDOW_TOGGLE_MAXIMIZE, (event) => {
    const win = senderWindow(event);
    if (!win) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.handle(WINDOW_CLOSE, (event) => {
    const win = senderWindow(event);
    if (!win) return;
    win.close();
  });

  ipcMain.handle(WINDOW_GET_STATE, (event): WindowState => {
    const win = senderWindow(event);
    if (!win) return { isMaximized: false, isFullScreen: false };
    return snapshot(win);
  });
}

export function unregisterWindowControlsIpc(): void {
  ipcMain.removeHandler(WINDOW_MINIMIZE);
  ipcMain.removeHandler(WINDOW_TOGGLE_MAXIMIZE);
  ipcMain.removeHandler(WINDOW_CLOSE);
  ipcMain.removeHandler(WINDOW_GET_STATE);
}

// 测试钩子：把 senderWindow / snapshot 暴露给单元测试，便于在没有真正
// BrowserWindow 的环境下验证逻辑。运行时不要使用。
export const __testing__ = {
  senderWindow,
  snapshot,
};
