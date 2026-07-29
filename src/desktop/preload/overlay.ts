import { contextBridge } from "electron";
import { createOverlayAppBridge } from "./bridges/app";
import { createCursorEventsBridge } from "./bridges/cursor-events";
import { createOverlayStorageBridge } from "./bridges/storage";

contextBridge.exposeInMainWorld("cursorDanceAPI", createCursorEventsBridge());
contextBridge.exposeInMainWorld("cursorDanceStorage", createOverlayStorageBridge());
contextBridge.exposeInMainWorld("cursorDanceApp", createOverlayAppBridge());
