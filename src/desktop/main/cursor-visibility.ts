import { ipcMain } from "electron";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { CURSOR_VISIBILITY_SET_HIDDEN } from "../../shared/ipc-channels";

let hidden = false;
let quartzHelper: ChildProcessWithoutNullStreams | null = null;
const hiddenRequesters = new Set<number>();
const trackedRequesters = new Set<number>();

const QUARTZ_HELPER_SCRIPT = String.raw`
import atexit
import ctypes
import sys

application_services = ctypes.cdll.LoadLibrary('/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices')
hidden = False

def set_hidden(next_hidden):
    global hidden
    if next_hidden and not hidden:
        application_services.CGDisplayHideCursor(0)
        hidden = True
    elif hidden and not next_hidden:
        application_services.CGDisplayShowCursor(0)
        hidden = False

def restore():
    set_hidden(False)

atexit.register(restore)

for line in sys.stdin:
    command = line.strip()
    if command == 'hide':
        set_hidden(True)
    elif command == 'show':
        set_hidden(False)
    elif command == 'quit':
        restore()
        break
`;

function ensureQuartzHelper(): ChildProcessWithoutNullStreams | null {
  if (process.platform !== "darwin") return null;
  if (quartzHelper && !quartzHelper.killed) return quartzHelper;

  try {
    quartzHelper = spawn("python3", ["-u", "-c", QUARTZ_HELPER_SCRIPT], {
      stdio: ["pipe", "ignore", "pipe"],
    });
  } catch (error) {
    console.error("[cursordance] macOS cursor helper 启动失败:", error);
    quartzHelper = null;
    return null;
  }

  const helper = quartzHelper;

  helper.once("error", (error) => {
    console.error("[cursordance] macOS cursor helper 启动失败:", error);
    if (quartzHelper === helper) quartzHelper = null;
    hidden = false;
  });

  helper.stderr.on("data", (chunk) => {
    console.error("[cursordance] macOS cursor helper 错误:", String(chunk).trim());
  });

  helper.on("exit", (code, signal) => {
    if (hidden) {
      console.error("[cursordance] macOS cursor helper 意外退出:", { code, signal });
    }
    if (quartzHelper === helper) {
      quartzHelper = null;
      hidden = false;
    }
  });

  return helper;
}

function sendQuartzCommand(command: "hide" | "show" | "quit"): boolean {
  const helper = command === "hide" ? ensureQuartzHelper() : quartzHelper;
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
  if (sendQuartzCommand(nextHidden ? "hide" : "show")) {
    hidden = nextHidden;
    console.info("[cursordance] macOS native cursor hidden:", hidden);
  }
}

export function restoreNativeCursor(): void {
  if (process.platform !== "darwin") return;
  hiddenRequesters.clear();
  if (hidden) {
    if (sendQuartzCommand("show")) {
      hidden = false;
    }
  }
  if (quartzHelper && !quartzHelper.killed) {
    sendQuartzCommand("quit");
    const helper = quartzHelper;
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
  restoreNativeCursor();
}
