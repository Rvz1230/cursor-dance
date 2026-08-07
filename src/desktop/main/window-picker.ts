import { BrowserWindow, ipcMain, type WebContents } from "electron";
import type { ActiveWindowSnapshot } from "../../shared/app-rules";
import type { PickWindowResult } from "../../shared/desktop-ipc-contracts";
import { APP_PICK_WINDOW } from "../../shared/ipc-channels";
import type { NativeCursorEvent, NativeKeyboardEvent } from "./native-events";
import { assertIpcSender } from "./ipc-security";

const ESCAPE_KEYCODE = 1;
const PICK_TIMEOUT_MS = 60_000;
const ACTIVE_WINDOW_SETTLE_MS = 100;

type PendingPick = {
  sender: WebContents;
  window: BrowserWindow;
  resolve: (result: PickWindowResult) => void;
  timeout: ReturnType<typeof setTimeout>;
  settling: boolean;
};

export interface WindowPickerController {
  begin(sender: WebContents): Promise<PickWindowResult>;
  handleCursorEvent(event: NativeCursorEvent): void;
  handleKeyboardEvent(event: NativeKeyboardEvent): void;
  cancel(): void;
}

export function createWindowPickerController({
  readSnapshot,
  timeoutMs = PICK_TIMEOUT_MS,
  settleMs = ACTIVE_WINDOW_SETTLE_MS,
}: {
  readSnapshot: () => ActiveWindowSnapshot;
  timeoutMs?: number;
  settleMs?: number;
}): WindowPickerController {
  let pending: PendingPick | null = null;

  function restoreWorkbench(current: PendingPick): void {
    if (current.window.isDestroyed()) return;
    if (current.window.isMinimized()) current.window.restore();
    current.window.show();
    current.window.focus();
  }

  function finish(result: PickWindowResult): void {
    const current = pending;
    if (!current) return;
    pending = null;
    clearTimeout(current.timeout);
    restoreWorkbench(current);
    current.resolve(result);
  }

  function cancel(): void {
    finish({ status: "cancelled" });
  }

  function begin(sender: WebContents): Promise<PickWindowResult> {
    cancel();
    const window = BrowserWindow.fromWebContents(sender);
    if (!window) return Promise.resolve({ status: "failed", message: "找不到工作台窗口。" });
    return new Promise((resolve) => {
      const timeout = setTimeout(cancel, timeoutMs);
      pending = { sender, window, resolve, timeout, settling: false };
      window.minimize();
    });
  }

  function handleCursorEvent(event: NativeCursorEvent): void {
    const current = pending;
    if (!current || current.settling || event.type !== "mousedown" || event.button !== 0) return;
    current.settling = true;
    setTimeout(() => {
      if (pending !== current || current.sender.isDestroyed()) {
        cancel();
        return;
      }
      const snapshot = readSnapshot();
      if (!("message" in snapshot)) {
        finish({ status: "picked", snapshot });
      } else {
        finish({ status: "failed", message: snapshot.message });
      }
    }, settleMs);
  }

  function handleKeyboardEvent(event: NativeKeyboardEvent): void {
    if (event.type === "keydown" && event.keycode === ESCAPE_KEYCODE) cancel();
  }

  return { begin, handleCursorEvent, handleKeyboardEvent, cancel };
}

export function registerWindowPickerIpc(controller: WindowPickerController): void {
  ipcMain.handle(APP_PICK_WINDOW, (event) => {
    assertIpcSender(event, APP_PICK_WINDOW);
    return controller.begin(event.sender);
  });
}

export function unregisterWindowPickerIpc(controller: WindowPickerController): void {
  controller.cancel();
  ipcMain.removeHandler(APP_PICK_WINDOW);
}
