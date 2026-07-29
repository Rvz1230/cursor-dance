import { ipcRenderer } from "electron";
import {
  LIVE_PREVIEW_CHANGED,
  STORE_CHANGED,
  STORE_GET,
} from "../../../shared/ipc-channels";
import { createIpcSubscription } from "./ipc-subscription";

function createStorageSubscriptions() {
  const configChanges = createIpcSubscription<unknown>(STORE_CHANGED);
  const livePreviewChanges = createIpcSubscription<unknown | null>(LIVE_PREVIEW_CHANGED);
  return {
    onChange: configChanges.on,
    onLivePreviewChange: livePreviewChanges.on,
  };
}

export function createOverlayStorageBridge() {
  return {
    async getConfig(): Promise<unknown | null> {
      return ipcRenderer.invoke(STORE_GET);
    },
    ...createStorageSubscriptions(),
  };
}
