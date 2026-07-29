import {
  APP_GET_FIRST_RUN,
  APP_MARK_FIRST_RUN_COMPLETE,
  APP_OPEN_EXTERNAL,
} from "../../../shared/ipc-channels";
import { createOverlayAppBridge } from "./app";
import { invokeDesktop } from "./typed-invoke";

export function createWorkbenchAppBridge() {
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
  };
}
