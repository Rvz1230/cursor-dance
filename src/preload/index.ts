import { contextBridge, ipcRenderer } from "electron";
import { CURSOR_EVENT } from "../shared/ipc-channels";

type CursorEventPayload = {
  type: "mousemove" | "mousedown" | "mouseup" | "wheel";
  x: number;
  y: number;
  buttons?: number;
  deltaY?: number;
  timestamp: number;
};

type CursorEventListener = (event: CursorEventPayload) => void;

const cursorEventListeners = new WeakMap<CursorEventListener, (_e: unknown, payload: CursorEventPayload) => void>();

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
});

contextBridge.exposeInMainWorld("cursorDanceAPI", {
  /** 订阅全局鼠标事件流。返回退订函数；callback 也可以传给 offCursorEvent 显式取消。 */
  onCursorEvent(callback: CursorEventListener): () => void {
    const handler = (_e: unknown, payload: CursorEventPayload) => callback(payload);
    cursorEventListeners.set(callback, handler);
    ipcRenderer.on(CURSOR_EVENT, handler);
    return () => {
      ipcRenderer.off(CURSOR_EVENT, handler);
      cursorEventListeners.delete(callback);
    };
  },

  offCursorEvent(callback: CursorEventListener): void {
    const handler = cursorEventListeners.get(callback);
    if (handler) {
      ipcRenderer.off(CURSOR_EVENT, handler);
      cursorEventListeners.delete(callback);
    }
  },
});
