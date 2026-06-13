// CursorDance overlay 渲染进程
//
// 职责：
//   1. 装配效果引擎（visualEffects / cursorOverlay / audioRuntime / triggerHandlers）
//   2. 装配 configStore（当前阶段先用 in-memory 默认配置；任务 3.0 接 electron-store）
//   3. 装配 diagnostics
//   4. 监听主进程通过 cursorDanceAPI.onCursorEvent 转发的 NativeCursorEvent，
//      做坐标系转换（screen device-px → overlay DIP），分派到 trigger-handlers。
//
// overlay 窗口是全屏覆盖某个 display，其 (window.screenX, window.screenY) 就是
// display.bounds 在 DIP 坐标系下的左上角。事件坐标按 device px 给的，要除以 DPR
// 后减去 screenX/Y。

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
  deltaY?: number;
  timestamp: number;
};

type CursorDanceAPI = {
  onCursorEvent: (cb: (e: CursorEventPayload) => void) => () => void;
  offCursorEvent: (cb: (e: CursorEventPayload) => void) => void;
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

// 任务 3.0 之前先给一个内存版 ConfigStoreAdapter；返回 defaultConfig 即可，
// configStore 内部会自己 normalize。
const inMemoryAdapter: ConfigStoreAdapter = {
  async get() {
    return {
      [CONFIG_STORE_CONSTANTS.CONFIG_STORAGE_KEY]: defaultConfig,
      [CONFIG_STORE_CONSTANTS.LEGACY_ENABLED_STORAGE_KEY]: true,
    };
  },
  async set() {
    // overlay 不写配置——workbench 任务 3.0 之后才会接通写入路径
  },
};

const configStore = createConfigStore({
  window,
  state,
  constants: CONFIG_STORE_CONSTANTS,
  diagnostics,
  storeAdapter: inMemoryAdapter,
  // 桌面 active-app-info / app-rules：阶段二还没接 get-windows（任务 3.2），
  // 暂时不传，configStore 会回退到 config.enabled 全局开关。
});

const engine = createEffectEngine({
  window,
  document,
  constants,
  state,
  configStore,
});

// 把默认配置塞进去（同步），让 trigger-handlers 立刻可用。
configStore.setConfig(defaultConfig);
state.ready = true;

// 任务 3.0 之后这里会从 storeAdapter 拉真实配置；当前只是兜底初始化引擎根节点。
engine.visualEffects.ensureRoot();

// ============================================================
// IPC 鼠标事件 → 引擎分派
// ============================================================

const api = (globalThis as unknown as { cursorDanceAPI?: CursorDanceAPI }).cursorDanceAPI;
if (!api) {
  console.error("[cursordance] preload cursorDanceAPI 未注入；overlay 不会收到鼠标事件");
}

function toEngineCursorEvent(payload: CursorEventPayload): CursorEvent {
  // uiohook 给的是 device px 全局屏幕坐标。overlay window 是全屏覆盖某 display，
  // window.screenX/Y 是 DIP 系下的 display 左上角；devicePixelRatio 是当前 display 的缩放。
  const dpr = window.devicePixelRatio || 1;
  const localX = payload.x / dpr - window.screenX;
  const localY = payload.y / dpr - window.screenY;
  return {
    type: payload.type,
    x: localX,
    y: localY,
    buttons: payload.buttons,
    deltaY: payload.deltaY,
    timestamp: payload.timestamp,
  };
}

function isInsideThisOverlay(event: CursorEvent): boolean {
  return event.x >= 0 && event.y >= 0 && event.x <= window.innerWidth && event.y <= window.innerHeight;
}

function dispatch(payload: CursorEventPayload): void {
  const cursorEvent = toEngineCursorEvent(payload);
  if (!isInsideThisOverlay(cursorEvent)) return;

  // 软件光标跟随（不论站点是否启用都先维护节点存在；configStore 内部判定要不要画）
  if (payload.type === "mousemove") {
    engine.cursorOverlay.syncStateCursorOverlay(cursorEvent.x, cursorEvent.y, undefined);
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

// 退出时清理（renderer 内部 hot reload 也走这里）
window.addEventListener("beforeunload", () => {
  api?.offCursorEvent(dispatch);
  engine.cursorOverlay.clearStateCursorOverlay();
});

console.info("[cursordance] overlay engine wired");

export {};
