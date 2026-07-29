import { app, ipcMain } from "electron";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { join } from "node:path";
import { CURSOR_VISIBILITY_SET_HIDDEN } from "../../shared/ipc-channels";

let hidden = false;
let cursorHelper: ChildProcessWithoutNullStreams | null = null;
const hiddenRequesters = new Set<number>();
const trackedRequesters = new Set<number>();

const CURSOR_HELPER_NAME = "cursordance-cursor-helper";

function resolveCursorHelperPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "native", CURSOR_HELPER_NAME);
  }
  return join(app.getAppPath(), "build", "native", process.arch, CURSOR_HELPER_NAME);
}

function ensureCursorHelper(): ChildProcessWithoutNullStreams | null {
  if (process.platform !== "darwin") return null;
  if (cursorHelper && !cursorHelper.killed) return cursorHelper;

  try {
    cursorHelper = spawn(resolveCursorHelperPath(), [], {
      stdio: ["pipe", "ignore", "pipe"],
    });
  } catch (error) {
    console.error("[cursordance] macOS cursor helper 启动失败:", error);
    cursorHelper = null;
    return null;
  }

  const helper = cursorHelper;

  helper.once("error", (error) => {
    console.error("[cursordance] macOS cursor helper 启动失败:", error);
    if (cursorHelper === helper) cursorHelper = null;
    hidden = false;
  });

  helper.stderr.on("data", (chunk) => {
    console.error("[cursordance] macOS cursor helper 错误:", String(chunk).trim());
  });

  helper.on("exit", (code, signal) => {
    if (hidden) {
      console.error("[cursordance] macOS cursor helper 意外退出:", { code, signal });
    }
    if (cursorHelper === helper) {
      cursorHelper = null;
      hidden = false;
    }
  });

  return helper;
}

function sendCursorCommand(command: "hide" | "show" | "quit"): boolean {
  const helper = command === "hide" ? ensureCursorHelper() : cursorHelper;
  if (!helper || helper.killed) return false;
  helper.stdin.write(`${command}\n`, (error) => {
    if (error) {
      console.error("[cursordance] macOS cursor helper 写入失败:", error);
    }
  });
  return true;
}

export function setNativeCursorHidden(nextHidden: boolean): void {
  if (process.platform !== "darwin") return;
  if (hidden === nextHidden) return;
  if (sendCursorCommand(nextHidden ? "hide" : "show")) {
    hidden = nextHidden;
    console.info("[cursordance] macOS native cursor hidden:", hidden);
  }
}

export function restoreNativeCursor(): void {
  if (process.platform !== "darwin") return;
  hiddenRequesters.clear();
  if (hidden) {
    if (sendCursorCommand("show")) {
      hidden = false;
    }
  }
  if (cursorHelper && !cursorHelper.killed) {
    const helper = cursorHelper;
    sendCursorCommand("quit");
    // Do not reuse a helper that is already shutting down if a new renderer
    // requests cursor hiding before the child process emits its exit event.
    cursorHelper = null;
    setTimeout(() => {
      if (!helper.killed) helper.kill();
    }, 1000).unref();
  }
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
