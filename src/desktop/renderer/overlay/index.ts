// CursorDance overlay 渲染进程
//
// 职责：
//   1. 装配效果引擎（visualEffects / cursorOverlay / audioRuntime / triggerHandlers）
//   2. 装配 configStore —— 任务 3.0 起从 cursorDanceStorage（IPC + electron-store）拉初始 config，
//      并订阅 STORE_CHANGED / LIVE_PREVIEW_CHANGED 实时刷新
//   3. 装配 diagnostics
//   4. 监听主进程通过 cursorDanceAPI.onCursorEvent 转发的 NativeCursorEvent，
//      做坐标系转换（全局 DIP → overlay 窗口本地坐标），分派到 trigger-handlers。
//
// overlay 窗口是全屏覆盖某个 display，其 (window.screenX, window.screenY) 就是
// display.bounds 在 DIP 坐标系下的左上角。uiohook（CGEventGetLocation /
// MSLLHOOKSTRUCT.pt）给出的坐标已经是 DIP，与 screenX/Y 同一坐标系，直接相减即可。

import {
  createEffectEngine,
  type CursorEvent,
  type EngineConstants,
  type EngineState,
} from "../engine/entry";
import { createConfigStore, type ConfigStoreAdapter } from "../engine/config-store";
import { createDiagnostics } from "../engine/diagnostics";
import { defaultConfig } from "../engine/default-config";

type CursorEventPayload = {
  type: "mousemove" | "mousedown" | "mouseup" | "wheel";
  x: number;
  y: number;
  buttons?: number;
  button?: number;
  deltaY?: number;
  timestamp: number;
};

type KeyboardEventPayload = {
  type: "keydown" | "keyup";
  keycode: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  timestamp: number;
};

type CursorDanceAPI = {
  onCursorEvent: (cb: (e: CursorEventPayload) => void) => () => void;
  offCursorEvent: (cb: (e: CursorEventPayload) => void) => void;
  onKeyboardEvent?: (cb: (e: KeyboardEventPayload) => void) => () => void;
  offKeyboardEvent?: (cb: (e: KeyboardEventPayload) => void) => void;
};

const constants: EngineConstants = {
  ROOT_ID: "cursordance-root",
  STYLE_ID: "cursordance-style",
  HIDE_CURSOR_CLASS: "cd-hide-native-cursor",
};

const CONFIG_STORE_CONSTANTS = {
  CONFIG_STORAGE_KEY: "cursordance.config",
  LEGACY_ENABLED_STORAGE_KEY: "cursordance.enabled",
  LIVE_PREVIEW_CONFIG_STORAGE_KEY: "cursordance.livePreviewConfig",
  CURSOR_ASSET_STORAGE_KEY_PREFIX: "cursordance.cursorAsset.",
  // 桌面端没有 DOM target，selector 给个无伤大雅的占位即可
  INTERACTIVE_SELECTOR: "",
  TEXT_EDITABLE_SELECTOR: "",
};

const state: EngineState = {
  activeEffects: 0,
};

const diagnostics = createDiagnostics({ window });

// 任务 3.0：从 preload 注入的 cursorDanceStorage 拉 config。
// adapter 内部完全独立于 chrome.storage —— overlay 进程不会回退到 localStorage,
// 因为 overlay 与 workbench 是不同 BrowserWindow,localStorage 不共享,只有 IPC 通。
// bridge 缺失时降级为 defaultConfig 兜底,保证引擎能跑起来.
const bridge = (typeof window !== "undefined" ? window.cursorDanceStorage : undefined) ?? null;

const electronBridgeAdapter: ConfigStoreAdapter = {
  async get() {
    const stored = bridge ? await bridge.getConfig() : null;
    return {
      [CONFIG_STORE_CONSTANTS.CONFIG_STORAGE_KEY]: stored ?? defaultConfig,
      [CONFIG_STORE_CONSTANTS.LEGACY_ENABLED_STORAGE_KEY]: true,
    };
  },
  async set() {
    // overlay 不写主 config —— 写入路径在 workbench；这里保留空实现。
  },
};

const configStore = createConfigStore({
  window,
  state,
  constants: CONFIG_STORE_CONSTANTS,
  diagnostics,
  storeAdapter: electronBridgeAdapter,
  // 桌面 active-app-info / app-rules：阶段二还没接 get-windows（任务 3.2），
  // 暂时不传，configStore 会回退到 config.enabled 全局开关。
});

// 缓存 cursor state 解析结果——桌面端永远 resolveCursorStateId(null) → "default"，
// 且 imageDataUrl/size/hotspot 只在 config 变更时才变，不需要每帧重算。
let cachedCursorState: { imageDataUrl: string; size: number; hotspotX: number; hotspotY: number } | undefined;
let cursorStateCacheDirty = true;

function invalidateCursorStateCache(): void {
  cursorStateCacheDirty = true;
}

function resolveCachedCursorState(): typeof cachedCursorState {
  if (!cursorStateCacheDirty) return cachedCursorState;
  cursorStateCacheDirty = false;
  cachedCursorState = undefined;
  if (configStore.isCurrentSiteEnabled?.() !== false) {
    const scheme = configStore.getActiveScheme?.();
    const stateId = configStore.resolveCursorStateId?.(null) ?? "default";
    const raw = configStore.getEffectiveCursorStateConfig?.(scheme, stateId) as
      | { imageDataUrl?: string; size?: number; hotspotX?: number; hotspotY?: number }
      | undefined
      | null;
    if (raw?.imageDataUrl) {
      cachedCursorState = { imageDataUrl: raw.imageDataUrl, size: raw.size, hotspotX: raw.hotspotX, hotspotY: raw.hotspotY };
    }
  }
  return cachedCursorState;
}

const engine = createEffectEngine({
  window,
  document,
  constants,
  state,
  configStore,
  diagnostics,
  reportRuntimeError: (scope, message) => diagnostics.log("runtime-error", { scope, message }),
});

// 启动时同步走一次：先用默认 config 让 trigger-handlers 立刻可用，
// 随后异步从 bridge 拉真实 config 并 setConfig 刷新。
configStore.setConfig(defaultConfig);
invalidateCursorStateCache();
state.ready = true;
engine.visualEffects.ensureRoot();

if (bridge) {
  bridge
    .getConfig()
    .then((stored) => {
      if (stored) { configStore.setConfig(stored); invalidateCursorStateCache(); }
    })
    .catch((error) => {
      console.error("[cursordance] overlay 初始 config 拉取失败:", error);
    });

  bridge.onChange((next) => {
    if (next) { configStore.setConfig(next); invalidateCursorStateCache(); }
  });

  bridge.onLivePreviewChange((next) => {
    if (next) {
      configStore.setConfig(next);
      invalidateCursorStateCache();
    } else {
      bridge
        .getConfig()
        .then((stored) => {
          if (stored) { configStore.setConfig(stored); invalidateCursorStateCache(); }
          else { configStore.setConfig(defaultConfig); invalidateCursorStateCache(); }
        })
        .catch(() => { configStore.setConfig(defaultConfig); invalidateCursorStateCache(); });
    }
  });
} else {
  console.warn("[cursordance] cursorDanceStorage bridge 未注入，overlay 只能用 defaultConfig");
}

// ============================================================
// IPC 鼠标事件 → 引擎分派
// ============================================================

const api = (globalThis as unknown as { cursorDanceAPI?: CursorDanceAPI }).cursorDanceAPI;
if (!api) {
  console.error("[cursordance] preload cursorDanceAPI 未注入；overlay 不会收到鼠标事件");
}

function toEngineCursorEvent(payload: CursorEventPayload): CursorEvent {
  // uiohook（CGEventGetLocation / MSLLHOOKSTRUCT.pt）返回 DIP 逻辑坐标，
  // 与 window.screenX/Y 同一坐标系，直接相减得到 overlay 窗口本地坐标。
  const localX = payload.x - window.screenX;
  const localY = payload.y - window.screenY;
  return {
    type: payload.type,
    x: localX,
    y: localY,
    buttons: payload.buttons,
    button: payload.button,
    deltaY: payload.deltaY,
    timestamp: payload.timestamp,
  };
}

function isInsideThisOverlay(event: CursorEvent): boolean {
  return event.x >= 0 && event.y >= 0 && event.x <= window.innerWidth && event.y <= window.innerHeight;
}

function dispatch(payload: CursorEventPayload): void {
  // 记录鼠标全局 DIP 坐标（用于键盘事件多显示器路由）
  state.lastMouseGlobalX = payload.x;
  state.lastMouseGlobalY = payload.y;

  const cursorEvent = toEngineCursorEvent(payload);
  if (!isInsideThisOverlay(cursorEvent)) return;

  if (payload.type === "mousemove") {
    engine.cursorOverlay.syncStateCursorOverlay(cursorEvent.x, cursorEvent.y, resolveCachedCursorState());
    return;
  }

  if (payload.type === "mousedown") {
    // PointerEvent.buttons 位掩码：1=left 2=right
    const isLeft = (payload.buttons ?? 0) & 1;
    const isRight = (payload.buttons ?? 0) & 2;
    if (isLeft) engine.triggerHandlers.handleLeftPointerDown(cursorEvent);
    else if (isRight) {
      engine.triggerHandlers.handleRightPointerDown(cursorEvent);
      engine.triggerHandlers.handleContextMenu(cursorEvent);
    }
    return;
  }

  if (payload.type === "mouseup") {
    engine.triggerHandlers.handlePointerUp(cursorEvent);
    return;
  }

  if (payload.type === "wheel") {
    engine.triggerHandlers.handleWheel(cursorEvent);
    return;
  }
}

api?.onCursorEvent(dispatch);

// ============================================================
// IPC 键盘事件 → 引擎分派
// ============================================================

function isMouseInThisOverlay(): boolean {
  const gx = state.lastMouseGlobalX;
  const gy = state.lastMouseGlobalY;
  if (gx === undefined || gy === undefined) {
    // 鼠标未移动过时，fallback 到主显示器（screenX/Y === 0）
    return window.screenX === 0 && window.screenY === 0;
  }
  const localX = gx - window.screenX;
  const localY = gy - window.screenY;
  // 半开区间：避免鼠标恰好停在屏幕拼接边界时两个 overlay 都判定 in-bounds 而双触发
  return localX >= 0 && localY >= 0 && localX < window.innerWidth && localY < window.innerHeight;
}

function dispatchKeyboard(payload: KeyboardEventPayload): void {
  if (!isMouseInThisOverlay()) return;
  const config = configStore.getKeyFeedbackConfig?.();
  if (!config?.enabled) return;
  engine.keyFeedback.handleKeyboardEvent(payload);
}

api?.onKeyboardEvent?.(dispatchKeyboard);

// 退出时清理（renderer 内部 hot reload 也走这里）
window.addEventListener("beforeunload", () => {
  api?.offCursorEvent(dispatch);
  api?.offKeyboardEvent?.(dispatchKeyboard);
  engine.cursorOverlay.clearStateCursorOverlay();
});

console.info("[cursordance] overlay engine wired");

export {};
