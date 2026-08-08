import { ipcMain } from "electron";
import {
  APP_ACCESSIBILITY_GET_STATE,
  APP_ACCESSIBILITY_REQUEST,
} from "../../shared/ipc-channels";
import type { AccessibilityController } from "./accessibility-controller";
import { assertIpcSender } from "./ipc-security";

export function registerAccessibilityIpc(controller: AccessibilityController): void {
  ipcMain.handle(APP_ACCESSIBILITY_GET_STATE, (event) => {
    assertIpcSender(event, APP_ACCESSIBILITY_GET_STATE);
    return controller.getState();
  });
  ipcMain.handle(APP_ACCESSIBILITY_REQUEST, (event) => {
    assertIpcSender(event, APP_ACCESSIBILITY_REQUEST);
    return controller.requestAccess();
  });
}

export function unregisterAccessibilityIpc(): void {
  ipcMain.removeHandler(APP_ACCESSIBILITY_GET_STATE);
  ipcMain.removeHandler(APP_ACCESSIBILITY_REQUEST);
}
