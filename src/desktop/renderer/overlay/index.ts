// CursorDance overlay 渲染进程
//
// 职责：
//   1. 装配效果引擎（visualEffects / cursorOverlay / audioRuntime / triggerHandlers）
//   2. 装配 configStore —— 从 cursorDanceStorage（IPC + electron-store）拉初始 config，
//      并订阅 STORE_CHANGED / LIVE_PREVIEW_CHANGED 实时刷新
//   3. 装配 diagnostics
//   4. 通过 InputSource 接收主进程输入并完成坐标归一化，再分派到 trigger-handlers。
//   5. 通过 ContextResolver 维护前台应用快照，供桌面应用规则实时匹配。
//
// overlay 窗口是全屏覆盖某个 display，其 (window.screenX, window.screenY) 就是
// display.bounds 在 DIP 坐标系下的左上角。uiohook（CGEventGetLocation /
// MSLLHOOKSTRUCT.pt）给出的坐标已经是 DIP，与 screenX/Y 同一坐标系，直接相减即可。

import {
  createEffectEngine,
  type EngineConstants,
  type EngineState,
} from "../engine/entry";
import {
  createDesktopInputSource,
  type DesktopInputBridge,
} from "../adapters/input-source";
import {
  createDesktopContextResolver,
  type DesktopContextBridge,
} from "../adapters/context-resolver";
import { createConfigStore, type ConfigStoreAdapter } from "../engine/config-store";
import { createDiagnostics } from "../engine/diagnostics";
import { defaultConfig } from "@/shared/config/default-config";
import {
  activeAppInfoFromSnapshot,
  type ActiveWindowSnapshot,
} from "../../../shared/app-rules";
import type { CursorSkin, CursorSkinState } from "../../../shared/domain/cursor-dance";
// 桌面 overlay 只能产出 default 与 grabbing（无 DOM、无系统光标查询能力）。
import type { CursorStateId as CursorSkinStateId } from "../../../shared/cursor-states";
import { resolveDesktopImageSource } from "../../../shared/asset-reference";
import {
  cursorSkinStateToOverlayState,
  type CursorOverlayState,
} from "../../../shared/effect-runtime/cursor-overlay";
import type {
  KeyboardInputEvent,
  PointerInputEvent,
  RuntimeInputEvent,
} from "../../../shared/effect-runtime/contracts";

const constants: EngineConstants = {
  ROOT_ID: "cursordance-root",
  STYLE_ID: "cursordance-style",
  HIDE_CURSOR_CLASS: "cd-hide-native-cursor",
};

const CONFIG_STORE_CONSTANTS = {
  CONFIG_STORAGE_KEY: "cursordance.config",
  // 桌面端没有 DOM target，selector 给个无伤大雅的占位即可
  INTERACTIVE_SELECTOR: "",
  TEXT_EDITABLE_SELECTOR: "",
};

const state: EngineState = {
  activeEffects: 0,
};

const diagnostics = createDiagnostics({ window });

// 从 preload 注入的 cursorDanceStorage 拉 config。
// adapter 内部完全独立于 chrome.storage —— overlay 进程不会回退到 localStorage,
// 因为 overlay 与 workbench 是不同 BrowserWindow,localStorage 不共享,只有 IPC 通。
// bridge 缺失时降级为 defaultConfig 兜底,保证引擎能跑起来.
const bridge = (typeof window !== "undefined" ? window.cursorDanceStorage : undefined) ?? null;
const appBridge = (
  (typeof window !== "undefined" ? window.cursorDanceApp : undefined) ?? null
) as DesktopContextBridge<ActiveWindowSnapshot> | null;
let activeWindowSnapshot: ActiveWindowSnapshot | null = null;

const electronBridgeAdapter: ConfigStoreAdapter = {
  async get() {
    const stored = bridge ? await bridge.getConfig() : null;
    return {
      [CONFIG_STORE_CONSTANTS.CONFIG_STORAGE_KEY]: stored ?? defaultConfig,
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
  getActiveAppInfo: () => activeAppInfoFromSnapshot(activeWindowSnapshot),
});

// 缓存 cursor skin 解析结果——第一版 overlay 先支持 default 与 dragging/grabbing，
// 后续 detector 会把浏览器桥接、Accessibility 和应用规则接入 activeStateId。
let cachedCursorState: CursorOverlayState | undefined;
let cursorStateCacheDirty = true;
let activeCursorSkinStateId: CursorSkinStateId = "default";
let leftButtonDown = false;
let dragStarted = false;
let dragStartX = 0;
let dragStartY = 0;
let nativeCursorHidden = false;
let pointerInside = false;

const api = (globalThis as unknown as { cursorDanceAPI?: DesktopInputBridge }).cursorDanceAPI;

function invalidateCursorStateCache(): void {
  cursorStateCacheDirty = true;
}

function setActiveCursorSkinState(nextStateId: CursorSkinStateId): void {
  if (activeCursorSkinStateId === nextStateId) return;
  activeCursorSkinStateId = nextStateId;
  invalidateCursorStateCache();
}

function resolveCursorSkinState(cursorSkin: CursorSkin | undefined | null, stateId: CursorSkinStateId): CursorSkinState | null {
  if (!cursorSkin || cursorSkin.enabled === false) return null;
  return cursorSkin.states?.[stateId] || (stateId !== "default" ? cursorSkin.states?.default : null) || null;
}

function setNativeCursorHidden(hidden: boolean): void {
  if (nativeCursorHidden === hidden) return;
  nativeCursorHidden = hidden;
  api?.setNativeCursorHidden?.(hidden).catch((error) => {
    console.error("[cursordance] macOS 原生 cursor 显隐切换失败:", error);
  });
}

function resolveCachedCursorState(): typeof cachedCursorState {
  if (!cursorStateCacheDirty) return cachedCursorState;
  cursorStateCacheDirty = false;
  cachedCursorState = undefined;
  if (configStore.isCurrentSiteEnabled?.() !== false) {
    const theme = configStore.getActiveTheme?.();
    const cursorSkin = theme?.cursorSkin;
    cachedCursorState = cursorSkinStateToOverlayState(
      resolveCursorSkinState(cursorSkin, activeCursorSkinStateId),
      resolveDesktopImageSource,
    );
  }
  setNativeCursorHidden(Boolean(cachedCursorState) && pointerInside);
  return cachedCursorState;
}

const engine = createEffectEngine({
  window,
  document,
  constants,
  state,
  configStore,
  getActiveWindowBounds: () => activeWindowSnapshot?.authorized ? activeWindowSnapshot.bounds ?? null : null,
  diagnostics,
  reportRuntimeError: (scope, message) => diagnostics.log("runtime-error", { scope, message }),
});

function syncCursorSkinAtLastPosition(): void {
  const gx = state.lastMouseGlobalX;
  const gy = state.lastMouseGlobalY;
  if (gx === undefined || gy === undefined) {
    resolveCachedCursorState();
    return;
  }

  const x = gx - window.screenX;
  const y = gy - window.screenY;
  if (isInsideThisOverlay(x, y)) {
    engine.cursorOverlay.syncStateCursorOverlay(x, y, resolveCachedCursorState());
  } else {
    resolveCachedCursorState();
  }
}

function resetOverlayRuntime(): void {
  pointerInside = false;
  leftButtonDown = false;
  dragStarted = false;
  state.lastMouseGlobalX = undefined;
  state.lastMouseGlobalY = undefined;
  setActiveCursorSkinState("default");
  engine.triggerHandlers.reset();
  engine.effectSurface.clear();
  engine.cursorOverlay.clearStateCursorOverlay();
  engine.audioRuntime.suspend();
  state.lastSoundAtByAction = {};
  state.lastKeydownAtByKeycode?.clear();
  state.keyFeedbackCombo = undefined;
  state.activeKeyEffects = 0;
  setNativeCursorHidden(false);
}

function syncRuntimeAvailability(): void {
  if (configStore.isCurrentSiteEnabled?.() === false) {
    resetOverlayRuntime();
    return;
  }
  syncCursorSkinAtLastPosition();
}

function applyOverlayConfig(next: unknown, source: "stored" | "live-preview" | "default"): void {
  configStore.setConfig(next || defaultConfig);
  invalidateCursorStateCache();
  syncRuntimeAvailability();
  const theme = configStore.getActiveTheme?.();
  const cursorSkin = theme?.cursorSkin;
  const resolvedCursorState = resolveCachedCursorState();
  console.info("[cursordance] overlay cursorSkin config applied", {
    source,
    themeId: theme?.id,
    stateCount: cursorSkin?.states ? Object.keys(cursorSkin.states).length : 0,
    hasDefault: Boolean(resolveDesktopImageSource(cursorSkin?.states.default?.image)),
    activeCursorSkinStateId,
    hasResolvedCursor: Boolean(resolvedCursorState?.imageDataUrl),
    hidden: nativeCursorHidden,
  });
  diagnostics.log("app-rule.context", {
    source: `config:${source}`,
    authorized: activeWindowSnapshot?.authorized ?? null,
    processName: activeWindowSnapshot?.authorized ? activeWindowSnapshot.processName : null,
    title: activeWindowSnapshot?.authorized ? activeWindowSnapshot.title : null,
    action: configStore.getResolvedAppRule(),
  });
}

function applyActiveWindowSnapshot(next: ActiveWindowSnapshot): void {
  activeWindowSnapshot = next;
  invalidateCursorStateCache();
  syncRuntimeAvailability();
  diagnostics.log("app-rule.context", {
    source: "active-window",
    authorized: next.authorized,
    processName: next.authorized ? next.processName : null,
    title: next.authorized ? next.title : null,
    message: "message" in next ? next.message : null,
    action: configStore.getResolvedAppRule(),
  });
}

// 启动时同步走一次：先用默认 config 让 trigger-handlers 立刻可用，
// 随后异步从 bridge 拉真实 config 并 setConfig 刷新。
applyOverlayConfig(defaultConfig, "default");
state.ready = true;
engine.visualEffects.ensureRoot();

let hasLivePreviewConfig = false;

if (bridge) {
  bridge
    .getConfig()
    .then((stored) => {
      if (stored && !hasLivePreviewConfig) applyOverlayConfig(stored, "stored");
    })
    .catch((error) => {
      console.error("[cursordance] overlay 初始 config 拉取失败:", error);
    });

  bridge.onChange((next) => {
    if (next && !hasLivePreviewConfig) applyOverlayConfig(next, "stored");
  });

  bridge.onLivePreviewChange((next) => {
    hasLivePreviewConfig = Boolean(next);
    if (next) {
      applyOverlayConfig(next, "live-preview");
    } else {
      bridge
        .getConfig()
        .then((stored) => {
          applyOverlayConfig(stored || defaultConfig, stored ? "stored" : "default");
        })
        .catch(() => { applyOverlayConfig(defaultConfig, "default"); });
    }
  });
} else {
  console.warn("[cursordance] cursorDanceStorage bridge 未注入，overlay 只能用 defaultConfig");
}

let unsubscribeActiveWindow: (() => void) | null = null;
if (appBridge) {
  const contextResolver = createDesktopContextResolver(appBridge, (error) => {
    console.error("[cursordance] overlay 前台应用上下文读取失败:", error);
  });
  unsubscribeActiveWindow = contextResolver.subscribe((snapshot) => {
    if (snapshot) applyActiveWindowSnapshot(snapshot);
  });
} else {
  console.warn("[cursordance] cursorDanceApp bridge 未注入，应用规则退化为全局配置");
}

// ============================================================
// InputSource → 引擎分派
// ============================================================

if (!api) {
  console.error("[cursordance] preload cursorDanceAPI 未注入；overlay 不会收到鼠标事件");
}

function isInsideThisOverlay(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight;
}

function dispatchPointer(cursorEvent: PointerInputEvent): void {
  state.lastMouseGlobalX = cursorEvent.screenX;
  state.lastMouseGlobalY = cursorEvent.screenY;
  if (!cursorEvent.inside) return;
  pointerInside = true;

  if (cursorEvent.type === "mousemove") {
    if (leftButtonDown && !dragStarted) {
      const dx = cursorEvent.x - dragStartX;
      const dy = cursorEvent.y - dragStartY;
      dragStarted = (dx * dx + dy * dy) >= 16;
    }
    setActiveCursorSkinState(dragStarted ? "grabbing" : "default");
    engine.cursorOverlay.syncStateCursorOverlay(cursorEvent.x, cursorEvent.y, resolveCachedCursorState());
    return;
  }

  if (cursorEvent.type === "mousedown") {
    if (cursorEvent.button === 0) {
      leftButtonDown = true;
      dragStarted = false;
      dragStartX = cursorEvent.x;
      dragStartY = cursorEvent.y;
      engine.triggerHandlers.handleLeftPointerDown(cursorEvent);
    }
    else if (cursorEvent.button === 2) {
      engine.triggerHandlers.handleRightPointerDown(cursorEvent);
      engine.triggerHandlers.handleContextMenu(cursorEvent);
    }
    return;
  }

  if (cursorEvent.type === "mouseup") {
    if (cursorEvent.button === 0) {
      leftButtonDown = false;
      dragStarted = false;
      setActiveCursorSkinState("default");
    }
    engine.triggerHandlers.handlePointerUp(cursorEvent);
    return;
  }

  if (cursorEvent.type === "wheel") engine.triggerHandlers.handleWheel(cursorEvent);
}

function dispatchKeyboard(payload: KeyboardInputEvent): void {
  if (!pointerInside) return;
  if (!configStore.isCurrentSiteEnabled()) return;
  const config = configStore.getKeyFeedbackConfig?.();
  if (!config?.enabled) return;
  engine.keyFeedback.handleKeyboardEvent(payload);
}

function dispatchInput(event: RuntimeInputEvent): void {
  if (event.kind === "pointer-leave") {
    pointerInside = false;
    state.lastMouseGlobalX = undefined;
    state.lastMouseGlobalY = undefined;
    leftButtonDown = false;
    dragStarted = false;
    setActiveCursorSkinState("default");
    engine.triggerHandlers.handlePointerCancel();
    engine.cursorOverlay.clearStateCursorOverlay();
    setNativeCursorHidden(false);
    return;
  }
  if (event.kind === "keyboard") dispatchKeyboard(event);
  else dispatchPointer(event);
}

const unsubscribeInput = api
  ? createDesktopInputSource(api, () => ({
      screenX: window.screenX,
      screenY: window.screenY,
      width: window.innerWidth,
      height: window.innerHeight,
    })).subscribe(dispatchInput)
  : () => {};

// 退出时清理（renderer 内部 hot reload 也走这里）
window.addEventListener("beforeunload", () => {
  unsubscribeActiveWindow?.();
  unsubscribeInput();
  resetOverlayRuntime();
});

console.info("[cursordance] overlay engine wired");

export {};
