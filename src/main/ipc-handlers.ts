// 任务 3.0：注册 store / live preview 的 ipcMain.handle + 跨窗口广播。
//
// 调用时机：必须在 createOverlayWindow / createWorkbenchWindow 之前，
// 否则首批 renderer 在启动时调 invoke 会拿不到 handler。

import { ipcMain, type BrowserWindow } from "electron";
import {
  STORE_GET,
  STORE_SET,
  STORE_CHANGED,
  STORE_GET_LIVE_PREVIEW,
  STORE_SET_LIVE_PREVIEW,
  STORE_CLEAR_LIVE_PREVIEW,
  LIVE_PREVIEW_CHANGED,
} from "../shared/ipc-channels";
import {
  readConfig,
  writeConfig,
  readLivePreview,
  writeLivePreview,
  clearLivePreview,
} from "./electron-store";

type GetAllWindows = () => BrowserWindow[];

function broadcast(getAllWindows: GetAllWindows, channel: string, payload: unknown): void {
  for (const win of getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.webContents.send(channel, payload);
  }
}

export function registerStoreIpc(getAllWindows: GetAllWindows): void {
  ipcMain.handle(STORE_GET, () => readConfig());

  ipcMain.handle(STORE_SET, (_event, payload: unknown) => {
    writeConfig(payload);
    // 写后广播，包括 writer 自己——renderer 那边的 onChange 是幂等订阅，
    // 收到自己刚写的值时会用 normalizeStoredConfig 比对/重新 set，效果上无副作用。
    broadcast(getAllWindows, STORE_CHANGED, payload);
  });

  ipcMain.handle(STORE_GET_LIVE_PREVIEW, () => readLivePreview());

  ipcMain.handle(STORE_SET_LIVE_PREVIEW, (_event, payload: unknown) => {
    writeLivePreview(payload);
    broadcast(getAllWindows, LIVE_PREVIEW_CHANGED, payload);
  });

  ipcMain.handle(STORE_CLEAR_LIVE_PREVIEW, () => {
    clearLivePreview();
    broadcast(getAllWindows, LIVE_PREVIEW_CHANGED, null);
  });
}

export function unregisterStoreIpc(): void {
  ipcMain.removeHandler(STORE_GET);
  ipcMain.removeHandler(STORE_SET);
  ipcMain.removeHandler(STORE_GET_LIVE_PREVIEW);
  ipcMain.removeHandler(STORE_SET_LIVE_PREVIEW);
  ipcMain.removeHandler(STORE_CLEAR_LIVE_PREVIEW);
}
