// 任务 3.1：主题导入导出走原生对话框
//
// 把扩展端「Blob + <a download>」/「<input type=file>」这套 web 化路径，
// 在桌面端替换成 dialog.showSaveDialog / showOpenDialog + Node fs。
// renderer 仍只负责构造序列化好的字符串和默认文件名，磁盘 IO 完全交给主进程。

import { promises as fs } from "node:fs";
import { dialog, ipcMain, BrowserWindow } from "electron";
import {
  DIALOG_SAVE_THEME_FILE,
  DIALOG_OPEN_THEME_FILE,
} from "../../shared/ipc-channels";

const THEME_FILE_FILTERS = [
  { name: "CursorDance Theme", extensions: ["cursordance-theme.json", "json"] },
  { name: "All Files", extensions: ["*"] },
];

export type SaveThemeFileRequest = {
  defaultFileName: string;
  contents: string;
};

export type SaveThemeFileResult =
  | { ok: true; canceled: false; filePath: string }
  | { ok: true; canceled: true }
  | { ok: false; canceled: false; error: string };

export type OpenThemeFileResult =
  | { ok: true; canceled: false; filePath: string; contents: string }
  | { ok: true; canceled: true }
  | { ok: false; canceled: false; error: string };

function resolveOwnerWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  const sender = event.sender;
  const found = BrowserWindow.fromWebContents(sender);
  return found && !found.isDestroyed() ? found : null;
}

export function registerDialogIpc(): void {
  ipcMain.handle(DIALOG_SAVE_THEME_FILE, async (
    event,
    payload: SaveThemeFileRequest
  ): Promise<SaveThemeFileResult> => {
    if (!payload || typeof payload.contents !== "string") {
      return { ok: false, canceled: false, error: "导出主题失败：缺少文件内容。" };
    }
    const owner = resolveOwnerWindow(event);
    try {
      const result = owner
        ? await dialog.showSaveDialog(owner, {
            defaultPath: payload.defaultFileName,
            filters: THEME_FILE_FILTERS,
          })
        : await dialog.showSaveDialog({
            defaultPath: payload.defaultFileName,
            filters: THEME_FILE_FILTERS,
          });
      if (result.canceled || !result.filePath) {
        return { ok: true, canceled: true };
      }
      await fs.writeFile(result.filePath, payload.contents, "utf8");
      return { ok: true, canceled: false, filePath: result.filePath };
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存主题文件失败。";
      return { ok: false, canceled: false, error: message };
    }
  });

  ipcMain.handle(DIALOG_OPEN_THEME_FILE, async (event): Promise<OpenThemeFileResult> => {
    const owner = resolveOwnerWindow(event);
    try {
      const result = owner
        ? await dialog.showOpenDialog(owner, {
            properties: ["openFile"],
            filters: THEME_FILE_FILTERS,
          })
        : await dialog.showOpenDialog({
            properties: ["openFile"],
            filters: THEME_FILE_FILTERS,
          });
      if (result.canceled || result.filePaths.length === 0) {
        return { ok: true, canceled: true };
      }
      const filePath = result.filePaths[0];
      const contents = await fs.readFile(filePath, "utf8");
      return { ok: true, canceled: false, filePath, contents };
    } catch (error) {
      const message = error instanceof Error ? error.message : "读取主题文件失败。";
      return { ok: false, canceled: false, error: message };
    }
  });
}

export function unregisterDialogIpc(): void {
  ipcMain.removeHandler(DIALOG_SAVE_THEME_FILE);
  ipcMain.removeHandler(DIALOG_OPEN_THEME_FILE);
}
