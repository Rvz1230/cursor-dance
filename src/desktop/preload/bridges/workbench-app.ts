import {
  APP_GET_FIRST_RUN,
  APP_ACCESSIBILITY_GET_STATE,
  APP_ACCESSIBILITY_REQUEST,
  APP_ACCESSIBILITY_STATE_CHANGED,
  APP_LIST_INSTALLED_APPLICATIONS,
  APP_PICK_WINDOW,
  APP_MARK_FIRST_RUN_COMPLETE,
  APP_OPEN_EXTERNAL,
  APP_UPDATE_CHECK,
  APP_UPDATE_DOWNLOAD,
  APP_UPDATE_GET_STATE,
  APP_UPDATE_INSTALL,
  APP_UPDATE_STATE_CHANGED,
} from "../../../shared/ipc-channels";
import type { DesktopUpdateState } from "../../../shared/desktop-update";
import type { DesktopAccessibilityState } from "../../../shared/desktop-accessibility";
import type { InstalledApplication, PickWindowResult } from "../../../shared/desktop-ipc-contracts";
import { createOverlayAppBridge } from "./app";
import { createIpcSubscription } from "./ipc-subscription";
import { invokeDesktop } from "./typed-invoke";

export function createWorkbenchAppBridge() {
  const updateChanges = createIpcSubscription<DesktopUpdateState>(APP_UPDATE_STATE_CHANGED);
  const accessibilityChanges = createIpcSubscription<DesktopAccessibilityState>(APP_ACCESSIBILITY_STATE_CHANGED);
  return {
    ...createOverlayAppBridge(),
    async getFirstRun(): Promise<boolean> {
      return invokeDesktop(APP_GET_FIRST_RUN);
    },
    async getAccessibilityState(): Promise<DesktopAccessibilityState> {
      return invokeDesktop(APP_ACCESSIBILITY_GET_STATE);
    },
    async requestAccessibility(): Promise<DesktopAccessibilityState> {
      return invokeDesktop(APP_ACCESSIBILITY_REQUEST);
    },
    onAccessibilityStateChanged: accessibilityChanges.on,
    async markFirstRunComplete(): Promise<void> {
      await invokeDesktop(APP_MARK_FIRST_RUN_COMPLETE);
    },
    async openExternal(target: string): Promise<{ ok: boolean; error?: string }> {
      return invokeDesktop(APP_OPEN_EXTERNAL, target);
    },
    async listInstalledApplications(): Promise<InstalledApplication[]> {
      return invokeDesktop(APP_LIST_INSTALLED_APPLICATIONS);
    },
    async pickWindow(): Promise<PickWindowResult> {
      return invokeDesktop(APP_PICK_WINDOW);
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
