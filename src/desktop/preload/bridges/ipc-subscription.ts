import { ipcRenderer, type IpcRendererEvent } from "electron";

export type PayloadListener<T> = (payload: T) => void;

export function createIpcSubscription<T>(channel: string) {
  const handlers = new WeakMap<PayloadListener<T>, (event: IpcRendererEvent, payload: T) => void>();

  function off(callback: PayloadListener<T>): void {
    const handler = handlers.get(callback);
    if (!handler) return;
    ipcRenderer.off(channel, handler);
    handlers.delete(callback);
  }

  function on(callback: PayloadListener<T>): () => void {
    off(callback);
    const handler = (_event: IpcRendererEvent, payload: T) => callback(payload);
    handlers.set(callback, handler);
    ipcRenderer.on(channel, handler);
    return () => off(callback);
  }

  return { on, off };
}
