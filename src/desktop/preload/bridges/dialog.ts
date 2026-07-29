import { ipcRenderer } from "electron";
import {
  DIALOG_OPEN_THEME_FILE,
  DIALOG_SAVE_THEME_FILE,
} from "../../../shared/ipc-channels";

type SaveThemeFileRequest = {
  defaultFileName: string;
  contents: string;
};

type SaveThemeFileResult =
  | { ok: true; canceled: false; filePath: string }
  | { ok: true; canceled: true }
  | { ok: false; canceled: false; error: string };

type OpenThemeFileResult =
  | { ok: true; canceled: false; filePath: string; contents: string }
  | { ok: true; canceled: true }
  | { ok: false; canceled: false; error: string };

export function createDialogBridge() {
  return {
    async saveThemeFile(request: SaveThemeFileRequest): Promise<SaveThemeFileResult> {
      return ipcRenderer.invoke(DIALOG_SAVE_THEME_FILE, request);
    },
    async openThemeFile(): Promise<OpenThemeFileResult> {
      return ipcRenderer.invoke(DIALOG_OPEN_THEME_FILE);
    },
  };
}
