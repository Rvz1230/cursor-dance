// CursorDance 桌面 — 显示器枚举 / 监听
//
// overlay 窗口是「每个 display 一个」：每次新增 / 拔出 / 分辨率改变都需要同步增删
// overlay。本模块只负责把 Electron screen 模块的事件包装成简洁回调，避免
// windows.ts 直接耦合 screen API（也方便未来在 wayland / X11 平台调整实现）。

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

/**
 * 把屏幕坐标（uiohook 给到的 device pixel coords）转成 display-relative
 * window coords。Electron BrowserWindow.setBounds 用 DIP，event.x/y 用 device px；
 * window 内部渲染坐标按 DIP 计算更稳，因此这里把 device px 折成 DIP。
 *
 * scaleFactor 通常是 1 / 1.25 / 1.5 / 2；此处只关心当前 display.bounds
 * （DIP 单位）和 device px 坐标的对应关系。
 */
export function screenPointToDisplayLocal(
  display: Display,
  screenX: number,
  screenY: number,
): { x: number; y: number } {
  const { bounds, scaleFactor } = display;
  // uiohook 的 x/y 是 device px（macOS / Windows 实测一致）；
  // bounds 是 DIP。先减去 display.bounds（DIP）→ 得到 DIP 偏移；
  // device px 与 DIP 在同一 display 内是 scaleFactor 倍关系。
  // 注意：bounds 多 monitor 时是相对 primary 的全局 DIP 系。
  const localDipX = screenX / scaleFactor - bounds.x;
  const localDipY = screenY / scaleFactor - bounds.y;
  return { x: localDipX, y: localDipY };
}

/**
 * 给定一个 device-px 屏幕坐标，找到它所在的 Display。
 * 命中 display.bounds 的就返回；多显示器边界重合时优先 primary。
 */
export function findDisplayAtScreenPoint(screenX: number, screenY: number): Display {
  const all = screen.getAllDisplays();
  // bounds 是 DIP；先把屏幕坐标按 primary scaleFactor 兜底成 DIP 检索
  // —— 多 display 不同 scale 的情况下后续会再二次校正。
  const primary = screen.getPrimaryDisplay();
  const dipX = screenX / primary.scaleFactor;
  const dipY = screenY / primary.scaleFactor;
  for (const d of all) {
    const { x, y, width, height } = d.bounds;
    if (dipX >= x && dipX < x + width && dipY >= y && dipY < y + height) return d;
  }
  return primary;
}
