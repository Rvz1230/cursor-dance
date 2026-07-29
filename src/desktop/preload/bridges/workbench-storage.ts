import { ipcRenderer } from "electron";
import {
  STORE_CLEAR_LIVE_PREVIEW,
  STORE_GET_LIVE_PREVIEW,
  STORE_SET,
  STORE_SET_LIVE_PREVIEW,
} from "../../../shared/ipc-channels";
import { createOverlayStorageBridge } from "./storage";

export function createWorkbenchStorageBridge() {
  return {
    ...createOverlayStorageBridge(),
    async setConfig(config: unknown): Promise<void> {
      await ipcRenderer.invoke(STORE_SET, config);
    },
    async getLivePreview(): Promise<unknown | null> {
      return ipcRenderer.invoke(STORE_GET_LIVE_PREVIEW);
    },
    async setLivePreview(config: unknown): Promise<void> {
      await ipcRenderer.invoke(STORE_SET_LIVE_PREVIEW, config);
    },
    async clearLivePreview(): Promise<void> {
      await ipcRenderer.invoke(STORE_CLEAR_LIVE_PREVIEW);
    },
  };
}
