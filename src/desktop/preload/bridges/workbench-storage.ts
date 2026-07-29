import {
  STORE_CLEAR_LIVE_PREVIEW,
  STORE_GET_LIVE_PREVIEW,
  STORE_SET,
  STORE_SET_LIVE_PREVIEW,
} from "../../../shared/ipc-channels";
import { createOverlayStorageBridge } from "./storage";
import { invokeDesktop } from "./typed-invoke";

export function createWorkbenchStorageBridge() {
  return {
    ...createOverlayStorageBridge(),
    async setConfig(config: unknown): Promise<unknown> {
      return invokeDesktop(STORE_SET, config);
    },
    async getLivePreview(): Promise<unknown | null> {
      return invokeDesktop(STORE_GET_LIVE_PREVIEW);
    },
    async setLivePreview(config: unknown): Promise<unknown> {
      return invokeDesktop(STORE_SET_LIVE_PREVIEW, config);
    },
    async clearLivePreview(): Promise<void> {
      await invokeDesktop(STORE_CLEAR_LIVE_PREVIEW);
    },
  };
}
