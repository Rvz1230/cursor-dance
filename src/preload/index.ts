import { contextBridge, ipcRenderer } from "electron";
import {
  CURSOR_EVENT,
  STORE_GET,
  STORE_SET,
  STORE_CHANGED,
  STORE_GET_LIVE_PREVIEW,
  STORE_SET_LIVE_PREVIEW,
  STORE_CLEAR_LIVE_PREVIEW,
  LIVE_PREVIEW_CHANGED,
  DIALOG_SAVE_THEME_FILE,
  DIALOG_OPEN_THEME_FILE,
  APP_GET_ACTIVE_WINDOW,
} from "../shared/ipc-channels";

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

// ============================================================
// 任务 3.0：cursorDanceStorage —— config + live preview 桥
//
// 职责：把 storage/config-io.ts / subscriptions.ts 等扩展端模块在 Electron
// renderer 里需要的存储能力，以稳定的 API 形态暴露出去。renderer 端
// 通过 window.cursorDanceStorage 访问；不存在时（扩展端 / 静态预览）
// 自动回落到 chrome.storage 或 localStorage 路径。
//
// 复用现有的 WeakMap-listener pattern，确保 onChange 返回的 unsubscribe
// 与 callback 一一对应，可被宿主多次注册/取消而不串扰。
// ============================================================

type ConfigChangeListener = (config: unknown) => void;
type LivePreviewChangeListener = (config: unknown | null) => void;

const configChangeListeners = new WeakMap<ConfigChangeListener, (_e: unknown, payload: unknown) => void>();
const livePreviewChangeListeners = new WeakMap<LivePreviewChangeListener, (_e: unknown, payload: unknown) => void>();

contextBridge.exposeInMainWorld("cursorDanceStorage", {
  async getConfig(): Promise<unknown | null> {
    return ipcRenderer.invoke(STORE_GET);
  },

  async setConfig(config: unknown): Promise<void> {
    await ipcRenderer.invoke(STORE_SET, config);
  },

  async getLivePreview(): Promise<unknown | null> {
    return ipcRenderer.invoke(STORE_GET_LIVE_PREVIEW);
  },

  async setLivePreview(config: unknown): Promise<void> {
    await ipcRenderer.invoke(STORE_SET_LIVE_PREVIEW, config);
  },

  async clearLivePreview(): Promise<void> {
    await ipcRenderer.invoke(STORE_CLEAR_LIVE_PREVIEW);
  },

  onChange(callback: ConfigChangeListener): () => void {
    const handler = (_e: unknown, payload: unknown) => callback(payload);
    configChangeListeners.set(callback, handler);
    ipcRenderer.on(STORE_CHANGED, handler);
    return () => {
      ipcRenderer.off(STORE_CHANGED, handler);
      configChangeListeners.delete(callback);
    };
  },

  offChange(callback: ConfigChangeListener): void {
    const handler = configChangeListeners.get(callback);
    if (handler) {
      ipcRenderer.off(STORE_CHANGED, handler);
      configChangeListeners.delete(callback);
    }
  },

  onLivePreviewChange(callback: LivePreviewChangeListener): () => void {
    const handler = (_e: unknown, payload: unknown) => callback(payload);
    livePreviewChangeListeners.set(callback, handler);
    ipcRenderer.on(LIVE_PREVIEW_CHANGED, handler);
    return () => {
      ipcRenderer.off(LIVE_PREVIEW_CHANGED, handler);
      livePreviewChangeListeners.delete(callback);
    };
  },

  offLivePreviewChange(callback: LivePreviewChangeListener): void {
    const handler = livePreviewChangeListeners.get(callback);
    if (handler) {
      ipcRenderer.off(LIVE_PREVIEW_CHANGED, handler);
      livePreviewChangeListeners.delete(callback);
    }
  },
});

// ============================================================
// 任务 3.1：cursorDanceDialog —— 文件对话框桥
//
// 把扩展端的「Blob + <a download>」（导出）和「<input type=file>」（导入）
// 在桌面端替换为原生 save/open dialog。
// renderer 只负责构造 JSON 字符串和默认文件名，所有磁盘 IO 都走主进程。
// ============================================================

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

contextBridge.exposeInMainWorld("cursorDanceDialog", {
  async saveThemeFile(request: SaveThemeFileRequest): Promise<SaveThemeFileResult> {
    return ipcRenderer.invoke(DIALOG_SAVE_THEME_FILE, request);
  },

  async openThemeFile(): Promise<OpenThemeFileResult> {
    return ipcRenderer.invoke(DIALOG_OPEN_THEME_FILE);
  },
});

// ============================================================
// 任务 3.2：cursorDanceApp —— 前台应用元数据桥
//
// renderer 通过 window.cursorDanceApp.getActiveWindow() 拉当前前台窗口快照，
// 给 app-matcher（应用规则匹配）和未来的应用规则面板使用。
//
// 返回 { authorized: true, owner: { name, bundleId? }, title, processName } 或
// { authorized: false, message }，调用方按 authorized 分支处理。
// ============================================================

type ActiveWindowSnapshot =
  | {
      authorized: true;
      owner: { name: string; bundleId?: string };
      title: string;
      processName: string;
    }
  | { authorized: false; message: string };

contextBridge.exposeInMainWorld("cursorDanceApp", {
  async getActiveWindow(): Promise<ActiveWindowSnapshot> {
    return ipcRenderer.invoke(APP_GET_ACTIVE_WINDOW);
  },
});
