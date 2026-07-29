import { ipcRenderer } from "electron";
import {
  APP_GET_FIRST_RUN,
  APP_MARK_FIRST_RUN_COMPLETE,
  APP_OPEN_EXTERNAL,
} from "../../../shared/ipc-channels";
import { createOverlayAppBridge } from "./app";

export function createWorkbenchAppBridge() {
  return {
    ...createOverlayAppBridge(),
    async getFirstRun(): Promise<boolean> {
      return ipcRenderer.invoke(APP_GET_FIRST_RUN);
    },
    async markFirstRunComplete(): Promise<void> {
      await ipcRenderer.invoke(APP_MARK_FIRST_RUN_COMPLETE);
    },
    async openExternal(target: string): Promise<{ ok: boolean; error?: string }> {
      return ipcRenderer.invoke(APP_OPEN_EXTERNAL, target);
    },
  };
}
