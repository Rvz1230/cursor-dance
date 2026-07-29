// CursorDance 桌面 — 显示器枚举 / 监听
//
// overlay 窗口是「每个 display 一个」：每次新增 / 拔出 / 分辨率改变都需要同步增删
// overlay。本模块只负责把 Electron screen 模块的事件包装成简洁回调，避免
// main/index.ts 直接耦合 screen API（也方便未来在 Wayland / X11 平台调整实现）。

import { screen, type Display } from "electron";

export interface DisplayDelta {
  added: Display[];
  removed: Display[];
  /** metrics-changed 触发时给到（窗口大小 / 缩放因子改变） */
  changed: Display[];
}

export type DisplayChangeListener = (delta: DisplayDelta) => void;

/** 列出当前所有显示器。 */
export function getAllDisplays(): Display[] {
  return screen.getAllDisplays();
}

/**
 * uiohook reports physical screen coordinates on Windows while Electron
 * BrowserWindow bounds use DIP. Other platforms already share Electron's DIP
 * coordinate space, so conversion is intentionally Windows-only.
 */
export function nativePointToDip(point: { x: number; y: number }): { x: number; y: number } {
  return process.platform === "win32" ? screen.screenToDipPoint(point) : point;
}

/**
 * 监听显示器变化，组合 display-added / display-removed / display-metrics-changed
 * 三个事件，每次回调给出最小 delta（added/removed/changed）。返回退订函数。
 */
export function onDisplayChanges(listener: DisplayChangeListener): () => void {
  const onAdded = (_e: Electron.Event, display: Display): void => {
    listener({ added: [display], removed: [], changed: [] });
  };
  const onRemoved = (_e: Electron.Event, display: Display): void => {
    listener({ added: [], removed: [display], changed: [] });
  };
  const onMetricsChanged = (_e: Electron.Event, display: Display): void => {
    listener({ added: [], removed: [], changed: [display] });
  };

  screen.on("display-added", onAdded);
  screen.on("display-removed", onRemoved);
  screen.on("display-metrics-changed", onMetricsChanged);

  return () => {
    screen.off("display-added", onAdded);
    screen.off("display-removed", onRemoved);
    screen.off("display-metrics-changed", onMetricsChanged);
  };
}
