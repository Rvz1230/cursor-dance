import { ipcRenderer } from "electron";
import {
  WINDOW_CLOSE,
  WINDOW_GET_STATE,
  WINDOW_MINIMIZE,
  WINDOW_STATE_CHANGED,
  WINDOW_TOGGLE_MAXIMIZE,
} from "../../../shared/ipc-channels";
import { createIpcSubscription } from "./ipc-subscription";

type WindowStateSnapshot = {
  isMaximized: boolean;
  isFullScreen: boolean;
};

export function createWindowBridge() {
  const stateChanges = createIpcSubscription<WindowStateSnapshot>(WINDOW_STATE_CHANGED);
  return {
    platform: process.platform,
    async minimize(): Promise<void> {
      await ipcRenderer.invoke(WINDOW_MINIMIZE);
    },
    async toggleMaximize(): Promise<void> {
      await ipcRenderer.invoke(WINDOW_TOGGLE_MAXIMIZE);
    },
    async close(): Promise<void> {
      await ipcRenderer.invoke(WINDOW_CLOSE);
    },
    async getState(): Promise<WindowStateSnapshot> {
      return ipcRenderer.invoke(WINDOW_GET_STATE);
    },
    onStateChanged: stateChanges.on,
  };
}
