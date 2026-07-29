import type { ActiveWindowSnapshot } from "../../../shared/app-rules";
import {
  APP_ACTIVE_WINDOW_CHANGED,
  APP_GET_ACTIVE_WINDOW,
} from "../../../shared/ipc-channels";
import { createIpcSubscription } from "./ipc-subscription";
import { invokeDesktop } from "./typed-invoke";

function createActiveAppBridge() {
  const activeWindowChanges = createIpcSubscription<ActiveWindowSnapshot>(APP_ACTIVE_WINDOW_CHANGED);
  return {
    async getActiveWindow(): Promise<ActiveWindowSnapshot> {
      return invokeDesktop(APP_GET_ACTIVE_WINDOW);
    },
    onActiveWindowChanged: activeWindowChanges.on,
  };
}

export function createOverlayAppBridge() {
  return createActiveAppBridge();
}
