import type { BrowserWindow } from "electron";

type WorkbenchWindow = Pick<
  BrowserWindow,
  "focus" | "isDestroyed" | "isMinimized" | "restore" | "show"
> & {
  once(event: "closed", listener: () => void): unknown;
};

type CreateWorkbenchWindow = () => WorkbenchWindow;

export interface WorkbenchWindowController {
  open(): WorkbenchWindow;
  getCurrent(): WorkbenchWindow | null;
}

/**
 * Owns the single Workbench window reference.
 *
 * Overlay windows live for the whole application session, so callers must not
 * infer Workbench state from BrowserWindow.getAllWindows(). Keeping ownership
 * here also gives tray, Dock activation and second-instance handling one
 * idempotent entry point.
 */
export function createWorkbenchWindowController(
  createWindow: CreateWorkbenchWindow,
): WorkbenchWindowController {
  let current: WorkbenchWindow | null = null;

  function open(): WorkbenchWindow {
    if (current && !current.isDestroyed()) {
      if (current.isMinimized()) current.restore();
      current.show();
      current.focus();
      return current;
    }

    const next = createWindow();
    current = next;
    next.once("closed", () => {
      if (current === next) current = null;
    });
    return next;
  }

  return {
    open,
    getCurrent: () => current,
  };
}
