import {
  APP_GET_FIRST_RUN,
  APP_MARK_FIRST_RUN_COMPLETE,
  APP_OPEN_EXTERNAL,
  APP_UPDATE_CHECK,
  APP_UPDATE_DOWNLOAD,
  APP_UPDATE_GET_STATE,
  APP_UPDATE_INSTALL,
  APP_UPDATE_STATE_CHANGED,
} from "../../../shared/ipc-channels";
import type { DesktopUpdateState } from "../../../shared/desktop-update";
import { createOverlayAppBridge } from "./app";
import { createIpcSubscription } from "./ipc-subscription";
import { invokeDesktop } from "./typed-invoke";

export function createWorkbenchAppBridge() {
  const updateChanges = createIpcSubscription<DesktopUpdateState>(APP_UPDATE_STATE_CHANGED);
  return {
    ...createOverlayAppBridge(),
    async getFirstRun(): Promise<boolean> {
      return invokeDesktop(APP_GET_FIRST_RUN);
    },
    async markFirstRunComplete(): Promise<void> {
      await invokeDesktop(APP_MARK_FIRST_RUN_COMPLETE);
    },
    async openExternal(target: string): Promise<{ ok: boolean; error?: string }> {
      return invokeDesktop(APP_OPEN_EXTERNAL, target);
    },
    async getUpdateState(): Promise<DesktopUpdateState> {
      return invokeDesktop(APP_UPDATE_GET_STATE);
    },
    async checkForUpdates(): Promise<DesktopUpdateState> {
      return invokeDesktop(APP_UPDATE_CHECK);
    },
    async downloadUpdate(): Promise<DesktopUpdateState> {
      return invokeDesktop(APP_UPDATE_DOWNLOAD);
    },
    async installUpdate(): Promise<void> {
      await invokeDesktop(APP_UPDATE_INSTALL);
    },
    onUpdateStateChanged: updateChanges.on,
  };
}
