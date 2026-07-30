// 注册 store / live preview 的 ipcMain.handle + 跨窗口广播。
//
// 调用时机：必须在 createOverlayWindow / createWorkbenchWindow 之前，
// 否则首批 renderer 在启动时调 invoke 会拿不到 handler。

import { ipcMain } from "electron";
import {
  STORE_GET,
  STORE_SET,
  STORE_CHANGED,
  STORE_GET_LIVE_PREVIEW,
  STORE_SET_LIVE_PREVIEW,
  STORE_CLEAR_LIVE_PREVIEW,
  LIVE_PREVIEW_CHANGED,
} from "../../shared/ipc-channels";
import {
  readConfig,
  writeConfig,
  readLivePreview,
  writeLivePreview,
  clearLivePreview,
} from "./electron-store";
import { broadcastToWindows, type GetAllWindows } from "./broadcast";
import { validateConfigPayload } from "./ipc-contracts";
import { assertIpcSender } from "./ipc-security";
import {
  collectReferencedAssetIds,
  materializeConfigAssets,
  sweepUnreferencedAssets,
} from "./asset-repository";

let mutationQueue = Promise.resolve();

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function sweepCurrentAssets(): Promise<void> {
  const referenced = collectReferencedAssetIds(readConfig(), readLivePreview());
  try {
    await sweepUnreferencedAssets(referenced);
  } catch (error) {
    console.error("[cursordance] failed to sweep desktop assets:", error);
  }
}

async function persistAssetBackedConfig(payload: unknown, livePreview: boolean): Promise<unknown> {
  const validated = validateConfigPayload(payload);
  const materialized = await materializeConfigAssets(validated);
  const stored = validateConfigPayload(materialized);
  if (livePreview) writeLivePreview(stored);
  else writeConfig(stored);
  await sweepCurrentAssets();
  return stored;
}

export function registerStoreIpc(getAllWindows: GetAllWindows): void {
  ipcMain.handle(STORE_GET, (event) => {
    assertIpcSender(event, STORE_GET);
    return enqueueMutation(async () => {
      const current = readConfig();
      if (!current) return null;
      try {
        const validated = validateConfigPayload(current);
        const stored = validateConfigPayload(await materializeConfigAssets(validated));
        if (JSON.stringify(stored) !== JSON.stringify(current)) writeConfig(stored);
        return stored;
      } catch {
        // Renderer 端会按 v4-only 策略把损坏或旧配置恢复为最新默认配置。
        return current;
      }
    });
  });

  ipcMain.handle(STORE_SET, (event, payload: unknown) => {
    assertIpcSender(event, STORE_SET);
    return enqueueMutation(async () => {
      const stored = await persistAssetBackedConfig(payload, false);
      // 写后广播，包括 writer 自己——renderer 那边的 onChange 是幂等订阅，
      // 收到自己刚写的值时会用 normalizeStoredConfig 比对/重新 set，效果上无副作用。
      broadcastToWindows(getAllWindows, STORE_CHANGED, stored);
      return stored;
    });
  });

  ipcMain.handle(STORE_GET_LIVE_PREVIEW, (event) => {
    assertIpcSender(event, STORE_GET_LIVE_PREVIEW);
    return readLivePreview();
  });

  ipcMain.handle(STORE_SET_LIVE_PREVIEW, (event, payload: unknown) => {
    assertIpcSender(event, STORE_SET_LIVE_PREVIEW);
    return enqueueMutation(async () => {
      const stored = await persistAssetBackedConfig(payload, true);
      broadcastToWindows(getAllWindows, LIVE_PREVIEW_CHANGED, stored);
      return stored;
    });
  });

  ipcMain.handle(STORE_CLEAR_LIVE_PREVIEW, (event) => {
    assertIpcSender(event, STORE_CLEAR_LIVE_PREVIEW);
    return enqueueMutation(async () => {
      clearLivePreview();
      broadcastToWindows(getAllWindows, LIVE_PREVIEW_CHANGED, null);
      await sweepCurrentAssets();
    });
  });
}

export function unregisterStoreIpc(): void {
  ipcMain.removeHandler(STORE_GET);
  ipcMain.removeHandler(STORE_SET);
  ipcMain.removeHandler(STORE_GET_LIVE_PREVIEW);
  ipcMain.removeHandler(STORE_SET_LIVE_PREVIEW);
  ipcMain.removeHandler(STORE_CLEAR_LIVE_PREVIEW);
  mutationQueue = Promise.resolve();
}
