import {
  DIALOG_OPEN_THEME_FILE,
  DIALOG_SAVE_THEME_FILE,
} from "../../../shared/ipc-channels";
import type {
  OpenThemeFileResult,
  SaveThemeFileRequest,
  SaveThemeFileResult,
} from "../../../shared/desktop-ipc-contracts";
import { invokeDesktop } from "./typed-invoke";

export function createDialogBridge() {
  return {
    async saveThemeFile(request: SaveThemeFileRequest): Promise<SaveThemeFileResult> {
      return invokeDesktop(DIALOG_SAVE_THEME_FILE, request);
    },
    async openThemeFile(): Promise<OpenThemeFileResult> {
      return invokeDesktop(DIALOG_OPEN_THEME_FILE);
    },
  };
}
