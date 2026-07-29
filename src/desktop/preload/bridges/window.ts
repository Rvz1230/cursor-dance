import {
  WINDOW_CLOSE,
  WINDOW_GET_STATE,
  WINDOW_MINIMIZE,
  WINDOW_STATE_CHANGED,
  WINDOW_TOGGLE_MAXIMIZE,
} from "../../../shared/ipc-channels";
import type { WindowStateSnapshot } from "../../../shared/desktop-ipc-contracts";
import { createIpcSubscription } from "./ipc-subscription";
import { invokeDesktop } from "./typed-invoke";

export function createWindowBridge() {
  const stateChanges = createIpcSubscription<WindowStateSnapshot>(WINDOW_STATE_CHANGED);
  return {
    platform: process.platform,
    async minimize(): Promise<void> {
      await invokeDesktop(WINDOW_MINIMIZE);
    },
    async toggleMaximize(): Promise<void> {
      await invokeDesktop(WINDOW_TOGGLE_MAXIMIZE);
    },
    async close(): Promise<void> {
      await invokeDesktop(WINDOW_CLOSE);
    },
    async getState(): Promise<WindowStateSnapshot> {
      return invokeDesktop(WINDOW_GET_STATE);
    },
    onStateChanged: stateChanges.on,
  };
}
