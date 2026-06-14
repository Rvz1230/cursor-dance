// 任务 4.3：首次启动 flag + 外链跳转
//
// 单独的 electron-store key（"firstRun"），不和 cursordance.config 混在一起。
// 默认认为是首次启动（key 不存在 → true），WelcomeDialog 关闭后写 false。
//
// 同样在这里挂 shell.openExternal IPC：WelcomeDialog 「了解快捷键」/「打开系统
// 设置」、应用规则面板「打开辅助功能设置」都走这个通道，限制只允许 https / 系统
// scheme（x-apple.systempreferences 等）以避免 renderer 注入任意命令。

import { ipcMain, shell } from "electron";
import ElectronStore from "electron-store";
import {
  APP_GET_FIRST_RUN,
  APP_MARK_FIRST_RUN_COMPLETE,
  APP_OPEN_EXTERNAL,
} from "../shared/ipc-channels";

const FIRST_RUN_KEY = "firstRun";

let store: ElectronStore | null = null;

function ensureStore(): ElectronStore {
  if (!store) {
    store = new ElectronStore({ name: "cursordance-app" });
  }
  return store;
}

export function isFirstRun(): boolean {
  // key 不存在视为 true。一旦 markFirstRunComplete 写入 false，后续永远是 false。
  const value = ensureStore().get(FIRST_RUN_KEY, undefined);
  return value === undefined;
}

export function markFirstRunComplete(): void {
  ensureStore().set(FIRST_RUN_KEY, "completed");
}

const ALLOWED_PROTOCOLS = new Set([
  "https:",
  "http:",
  "x-apple.systempreferences:",
  "ms-settings:",
]);

export async function openExternalSafe(target: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = new URL(target);
    if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
      return { ok: false, error: `protocol not allowed: ${url.protocol}` };
    }
    await shell.openExternal(target);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function registerFirstRunIpc(): void {
  ipcMain.handle(APP_GET_FIRST_RUN, () => isFirstRun());
  ipcMain.handle(APP_MARK_FIRST_RUN_COMPLETE, () => {
    markFirstRunComplete();
  });
  ipcMain.handle(APP_OPEN_EXTERNAL, (_event, target: unknown) => {
    if (typeof target !== "string") return { ok: false, error: "target must be a string" };
    return openExternalSafe(target);
  });
}

export function unregisterFirstRunIpc(): void {
  ipcMain.removeHandler(APP_GET_FIRST_RUN);
  ipcMain.removeHandler(APP_MARK_FIRST_RUN_COMPLETE);
  ipcMain.removeHandler(APP_OPEN_EXTERNAL);
}

export const __testing__ = {
  reset(): void {
    store = null;
  },
  injectStore(stub: ElectronStore | null): void {
    store = stub;
  },
};
