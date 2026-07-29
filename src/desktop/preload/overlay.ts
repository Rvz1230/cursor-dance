import { contextBridge } from "electron";
import { createOverlayAppBridge } from "./bridges/app";
import { createCursorEventsBridge } from "./bridges/cursor-events";
import { createOverlayStorageBridge } from "./bridges/storage";

export function exposeOverlayPreload(): void {
  contextBridge.exposeInMainWorld("cursorDanceAPI", createCursorEventsBridge());
  contextBridge.exposeInMainWorld("cursorDanceStorage", createOverlayStorageBridge());
  contextBridge.exposeInMainWorld("cursorDanceApp", createOverlayAppBridge());
}
