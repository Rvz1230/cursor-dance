import { app, ipcMain } from "electron";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { CURSOR_VISIBILITY_SET_HIDDEN } from "../../shared/ipc-channels";
import { createCursorVisibilityController, type CursorVisibilityController } from "./cursor-visibility-controller";

let cursorVisibilityController: CursorVisibilityController | null = null;
const hiddenRequesters = new Set<number>();
const trackedRequesters = new Set<number>();

const CURSOR_HELPER_NAME = "cursordance-cursor-helper";

function resolveCursorHelperPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "native", CURSOR_HELPER_NAME);
  }
  return join(app.getAppPath(), "build", "native", process.arch, CURSOR_HELPER_NAME);
}

function getCursorVisibilityController(): CursorVisibilityController | null {
  if (process.platform !== "darwin") return null;
  cursorVisibilityController ??= createCursorVisibilityController({
    spawnHelper: () => spawn(resolveCursorHelperPath(), [], {
      stdio: ["pipe", "pipe", "pipe"],
    }),
    onUnavailable: () => {
      hiddenRequesters.clear();
    },
  });
  return cursorVisibilityController;
}

export function setNativeCursorHidden(nextHidden: boolean): void {
  if (nextHidden) getCursorVisibilityController()?.setHidden(true);
  else cursorVisibilityController?.setHidden(false);
}

export function restoreNativeCursor(): void {
  if (process.platform !== "darwin") return;
  hiddenRequesters.clear();
  cursorVisibilityController?.stop();
  cursorVisibilityController = null;
}

export function registerCursorVisibilityIpc(): void {
  ipcMain.handle(CURSOR_VISIBILITY_SET_HIDDEN, (event, nextHidden: unknown) => {
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
