import { ipcMain } from "electron";
import {
  APP_UPDATE_CHECK,
  APP_UPDATE_DOWNLOAD,
  APP_UPDATE_GET_STATE,
  APP_UPDATE_INSTALL,
} from "../../shared/ipc-channels";
import type { AutoUpdateController } from "./auto-updater";
import { assertIpcSender } from "./ipc-security";

export function registerUpdateIpc(controller: AutoUpdateController): () => void {
  ipcMain.handle(APP_UPDATE_GET_STATE, (event) => {
    assertIpcSender(event, APP_UPDATE_GET_STATE);
    return controller.getState();
  });
  ipcMain.handle(APP_UPDATE_CHECK, (event) => {
    assertIpcSender(event, APP_UPDATE_CHECK);
    return controller.checkForUpdates();
  });
  ipcMain.handle(APP_UPDATE_DOWNLOAD, (event) => {
    assertIpcSender(event, APP_UPDATE_DOWNLOAD);
    return controller.downloadUpdate();
  });
  ipcMain.handle(APP_UPDATE_INSTALL, (event) => {
    assertIpcSender(event, APP_UPDATE_INSTALL);
    controller.installUpdate();
  });

  return () => {
    ipcMain.removeHandler(APP_UPDATE_GET_STATE);
    ipcMain.removeHandler(APP_UPDATE_CHECK);
    ipcMain.removeHandler(APP_UPDATE_DOWNLOAD);
    ipcMain.removeHandler(APP_UPDATE_INSTALL);
  };
}
