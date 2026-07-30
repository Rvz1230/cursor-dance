// electron-store 单例 + 内存 live preview
//
// 职责：
//   - 持久化 cursordance.config（写盘到 app.getPath("userData")/config.json）
//   - 维护一份进程内的 live preview（不写盘，符合扩展端 chrome.storage.session 语义）
//   - 暴露变更监听器（onConfigChange / onLivePreviewChange），供 ipc-handlers 在写入后广播
//
// 不在本模块职责：
//   - IPC 注册：留给 ipc-handlers
//   - 跨窗口广播：留给 ipc-handlers
//
// 设计决策：
//   - electron-store v11 是 ESM 默认导出 ElectronStore 类，schema 不强制
//   - config 整体作为单个 key（"config"）存放，对应 cursordance.config —— 不展开为多 key
//     是为了保持与 chrome.storage 单 key 语义一致，writeConfig 总是替换全部
//   - live preview 用普通对象引用 + 简单事件分发；进程退出即丢

import ElectronStore from "electron-store";

type Config = unknown;
type Listener<T> = (value: T) => void;

let store: ElectronStore | null = null;
let livePreview: Config | null = null;

const configListeners = new Set<Listener<Config>>();
const livePreviewListeners = new Set<Listener<Config | null>>();

const CONFIG_KEY = "config";

function ensureStore(): ElectronStore {
  if (!store) {
    store = new ElectronStore({
      name: "cursordance",
      // electron-store 默认会保存到 app.getPath("userData")，构造时 require electron。
      // app 在 whenReady 之前调 getPath 会报错，所以 ensureStore 必须在 whenReady 之后再触发。
    });
  }
  return store;
}

export function readConfig(): Config | null {
  const value = ensureStore().get(CONFIG_KEY, null);
  return value as Config | null;
}

export function writeConfig(next: Config): void {
  ensureStore().set(CONFIG_KEY, next as never);
  for (const listener of configListeners) {
    try {
      listener(next);
    } catch (error) {
      console.error("[cursordance] electron-store config listener error:", error);
    }
  }
}

export function readLivePreview(): Config | null {
  return livePreview;
}

export function writeLivePreview(next: Config): void {
  livePreview = next;
  for (const listener of livePreviewListeners) {
    try {
      listener(next);
    } catch (error) {
      console.error("[cursordance] live preview listener error:", error);
    }
  }
}

export function clearLivePreview(): void {
  livePreview = null;
  for (const listener of livePreviewListeners) {
    try {
      listener(null);
    } catch (error) {
      console.error("[cursordance] live preview listener error:", error);
    }
  }
}

export function onConfigChange(listener: Listener<Config>): () => void {
  configListeners.add(listener);
  return () => configListeners.delete(listener);
}

export function onLivePreviewChange(listener: Listener<Config | null>): () => void {
  livePreviewListeners.add(listener);
  return () => livePreviewListeners.delete(listener);
}

// 仅给单测用 —— 重置内部 state（store 实例 + listener + livePreview）
export const __testing__ = {
  reset(): void {
    store = null;
    livePreview = null;
    configListeners.clear();
    livePreviewListeners.clear();
  },
  injectStore(stub: ElectronStore | null): void {
    store = stub;
  },
};
