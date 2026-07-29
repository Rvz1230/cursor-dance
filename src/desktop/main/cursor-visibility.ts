import { app, ipcMain } from "electron";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { CURSOR_VISIBILITY_SET_HIDDEN } from "../../shared/ipc-channels";
import { createCursorVisibilityController, type CursorVisibilityController } from "./cursor-visibility-controller";
import { assertIpcSender } from "./ipc-security";

let cursorVisibilityController: CursorVisibilityController | null = null;
const hiddenRequesters = new Set<number>();
const trackedRequesters = new Set<number>();

const CURSOR_HELPER_NAME = process.platform === "win32"
  ? "cursordance-cursor-helper.exe"
  : "cursordance-cursor-helper";

function resolveCursorHelperPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "native", CURSOR_HELPER_NAME);
  }
  return join(app.getAppPath(), "build", "native", process.arch, CURSOR_HELPER_NAME);
}

function getCursorVisibilityController(): CursorVisibilityController | null {
  const enabled = process.platform === "darwin"
    || (process.platform === "win32" && process.env.CURSORDANCE_ENABLE_WINDOWS_CURSOR_HELPER === "1");
  if (!enabled) return null;
  cursorVisibilityController ??= createCursorVisibilityController({
    spawnHelper: () => spawn(resolveCursorHelperPath(), [], {
      stdio: ["pipe", "pipe", "pipe"],
    }),
    onUnavailable: () => {
      hiddenRequesters.clear();
    },
    platformLabel: process.platform === "win32" ? "Windows" : "macOS",
  });
  return cursorVisibilityController;
}

export function setNativeCursorHidden(nextHidden: boolean): void {
  if (nextHidden) getCursorVisibilityController()?.setHidden(true);
  else cursorVisibilityController?.setHidden(false);
}

export function restoreNativeCursor(): void {
  hiddenRequesters.clear();
  cursorVisibilityController?.stop();
  cursorVisibilityController = null;
}

export function registerCursorVisibilityIpc(): void {
  ipcMain.handle(CURSOR_VISIBILITY_SET_HIDDEN, (event, nextHidden: unknown) => {
    assertIpcSender(event, CURSOR_VISIBILITY_SET_HIDDEN);
    if (typeof nextHidden !== "boolean") throw new Error("cursor visibility payload must be a boolean");
    const webContentsId = event.sender.id;
    if (nextHidden === true) hiddenRequesters.add(webContentsId);
    else hiddenRequesters.delete(webContentsId);

    if (!trackedRequesters.has(webContentsId)) {
      trackedRequesters.add(webContentsId);
      event.sender.once("destroyed", () => {
        trackedRequesters.delete(webContentsId);
        hiddenRequesters.delete(webContentsId);
        setNativeCursorHidden(hiddenRequesters.size > 0);
      });
    }

    setNativeCursorHidden(hiddenRequesters.size > 0);
  });
}

export function unregisterCursorVisibilityIpc(): void {
  ipcMain.removeHandler(CURSOR_VISIBILITY_SET_HIDDEN);
  trackedRequesters.clear();
  restoreNativeCursor();
}
