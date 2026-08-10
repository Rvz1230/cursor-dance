// 主题导入导出走原生对话框
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
import type {
  OpenThemeFileResult,
  SaveThemeFileResult,
} from "../../shared/desktop-ipc-contracts";
import {
  MAX_THEME_FILE_BYTES,
  validateSaveThemeFileRequest,
  validateThemeFileContents,
} from "./ipc-contracts";
import { assertIpcSender } from "./ipc-security";
import { hydrateThemeExportContents } from "./asset-repository";

const THEME_FILE_FILTERS = [
  { name: "CursorDance JSON", extensions: ["cursordance-theme.json", "cursordance-trail.json", "json"] },
  { name: "All Files", extensions: ["*"] },
];

function resolveOwnerWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  const sender = event.sender;
  const found = BrowserWindow.fromWebContents(sender);
  return found && !found.isDestroyed() ? found : null;
}

export function registerDialogIpc(): void {
  ipcMain.handle(DIALOG_SAVE_THEME_FILE, async (
    event,
    payload: unknown,
  ): Promise<SaveThemeFileResult> => {
    assertIpcSender(event, DIALOG_SAVE_THEME_FILE);
    const owner = resolveOwnerWindow(event);
    try {
      const request = validateSaveThemeFileRequest(payload);
      const result = owner
        ? await dialog.showSaveDialog(owner, {
            defaultPath: request.defaultFileName,
            filters: THEME_FILE_FILTERS,
          })
        : await dialog.showSaveDialog({
            defaultPath: request.defaultFileName,
            filters: THEME_FILE_FILTERS,
          });
      if (result.canceled || !result.filePath) {
        return { ok: true, canceled: true };
      }
      const portableContents = await hydrateThemeExportContents(request.contents);
      if (Buffer.byteLength(portableContents, "utf8") > MAX_THEME_FILE_BYTES) {
        throw new Error(`导出主题超过 ${MAX_THEME_FILE_BYTES} bytes 限制。`);
      }
      validateThemeFileContents(portableContents);
      await fs.writeFile(result.filePath, portableContents, "utf8");
      return { ok: true, canceled: false, filePath: result.filePath };
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存主题文件失败。";
      return { ok: false, canceled: false, error: message };
    }
  });

  ipcMain.handle(DIALOG_OPEN_THEME_FILE, async (event): Promise<OpenThemeFileResult> => {
    assertIpcSender(event, DIALOG_OPEN_THEME_FILE);
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
      const fileStats = await fs.stat(filePath);
      if (fileStats.size > MAX_THEME_FILE_BYTES) {
        throw new Error(`主题文件超过 ${MAX_THEME_FILE_BYTES} bytes 限制。`);
      }
      const contents = await fs.readFile(filePath, "utf8");
      validateThemeFileContents(contents);
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
