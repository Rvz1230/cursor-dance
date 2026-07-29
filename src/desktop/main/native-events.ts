// CursorDance 主进程：全局鼠标事件捕获 → CursorEvent 投递
//
// 抽象 IInputSource 接口，方便：
//   - 单元测试用 FakeInputSource 注入合成事件
//   - 未来切换到其它原生绑定（rdev / mouse-position-tracker / etc）
//   - 桌面 dev 模式下可临时塞 BrowserView mousemove 桥接
//
// IPC 出口最小化：只传 { type, x, y, buttons?, deltaY?, timestamp }，
// 与 src/renderer/engine/types.ts 的 CursorEvent 一致。

import { uIOhook, type UiohookMouseEvent, type UiohookWheelEvent, type UiohookKeyboardEvent } from "uiohook-napi";
import type {
  KeyboardEventPayload,
  ScreenPointerEvent,
} from "../../shared/effect-runtime/contracts";

/** 投递给渲染层的最小事件（与 engine CursorEvent 同形）。 */
export type NativeCursorEvent = ScreenPointerEvent;

/** 投递给渲染层的键盘事件。 */
export type NativeKeyboardEvent = KeyboardEventPayload;

export interface IInputSource {
  start(callback: (event: NativeCursorEvent) => void, onKeyboard?: (event: NativeKeyboardEvent) => void): void;
  stop(): void;
}

// ============================================================
// 按钮 / 滚轮辅助
// ============================================================

// uiohook 的 button 字段：1=left, 2=right, 3=middle（与 X11 风格一致，非位掩码）
function uiohookButtonToBitmask(button: unknown): number {
  switch (button) {
    case 1: return 1;
    case 2: return 2;
    case 3: return 4;
    default: return 0;
  }
}

// uiohook button → PointerEvent.button：0=left, 1=middle, 2=right
function uiohookButtonToDomButton(button: unknown): number {
  switch (button) {
    case 1: return 0;
    case 3: return 1;
    case 2: return 2;
    default: return -1;
  }
}

// macOS 触控板会以极小 rotation 高频触发 wheel；累积到阈值才下发，减轻渲染压力。
// Windows / 物理滚轮 rotation 通常 ±1，会立刻触发。
const WHEEL_THRESHOLD = 1;
// uiohook rotation 单位：每「咔哒」±1。乘 100 与 DOM WheelEvent.deltaY 风格的「100 像素一档」对齐。
const WHEEL_DELTA_MULTIPLIER = 100;

class WheelAccumulator {
  private accum = 0;
  feed(rotation: number): number | null {
    // uiohook rotation 单位：每「咔哒」±1。先按透传 → deltaY = rotation * 100，
    // 与 DOM WheelEvent 的「100 像素一档」量级对齐。
    // 真机验证（macOS 自然滚动 / Windows 物理滚轮）后若发现符号与 DOM
    // 「向下=正、向上=负」相反，再在这里翻一下。
    this.accum += rotation;
    if (Math.abs(this.accum) < WHEEL_THRESHOLD) return null;
    const delta = this.accum * WHEEL_DELTA_MULTIPLIER;
    this.accum = 0;
    return delta;
  }
}

// ============================================================
// uiohook 实现
// ============================================================

export class UiohookInputSource implements IInputSource {
  private callback: ((event: NativeCursorEvent) => void) | null = null;
  private keyboardCallback: ((event: NativeKeyboardEvent) => void) | null = null;
  private buttonsState = 0;
  private wheel = new WheelAccumulator();
  private started = false;

  start(callback: (event: NativeCursorEvent) => void, onKeyboard?: (event: NativeKeyboardEvent) => void): void {
    if (this.started) return;
    this.callback = callback;
    this.keyboardCallback = onKeyboard ?? null;

    uIOhook.on("mousemove", this.onMouseMove);
    uIOhook.on("mousedown", this.onMouseDown);
    uIOhook.on("mouseup", this.onMouseUp);
    uIOhook.on("wheel", this.onWheel);
    uIOhook.on("keydown", this.onKeyDown);

    uIOhook.start();
    this.started = true;
    console.log("[uiohook] started — listening for global mouse + keyboard events");

    // macOS 辅助功能权限检测：启动 2 秒后如果还没收到任何 mousemove，
    // 大概率是缺少辅助功能权限
    setTimeout(() => {
      if (this.eventCount === 0) {
        console.warn("[uiohook] NO events received after 2s — macOS may require Accessibility permission.");
        console.warn("[uiohook] Go to: System Settings → Privacy & Security → Accessibility → enable this app");
      }
    }, 2000);
  }

  private eventCount = 0;

  stop(): void {
    if (!this.started) return;
    uIOhook.off("mousemove", this.onMouseMove);
    uIOhook.off("mousedown", this.onMouseDown);
    uIOhook.off("mouseup", this.onMouseUp);
    uIOhook.off("wheel", this.onWheel);
    uIOhook.off("keydown", this.onKeyDown);

    try {
      uIOhook.stop();
    } catch {
      // uiohook stop 在 macOS 上偶尔抛 invalid state，吞掉即可——进程退出会清理。
    }

    this.callback = null;
    this.keyboardCallback = null;
    this.buttonsState = 0;
    this.started = false;
  }

  private onMouseMove = (e: UiohookMouseEvent): void => {
    this.eventCount++;
    this.callback?.({
      type: "mousemove",
      x: e.x,
      y: e.y,
      buttons: this.buttonsState,
      timestamp: e.time,
    });
  };

  private onMouseDown = (e: UiohookMouseEvent): void => {
    this.eventCount++;
    const bit = uiohookButtonToBitmask(e.button);
    this.buttonsState |= bit;
    this.callback?.({
      type: "mousedown",
      x: e.x,
      y: e.y,
      buttons: this.buttonsState,
      button: uiohookButtonToDomButton(e.button),
      timestamp: e.time,
    });
  };

  private onMouseUp = (e: UiohookMouseEvent): void => {
    const bit = uiohookButtonToBitmask(e.button);
    this.buttonsState &= ~bit;
    this.callback?.({
      type: "mouseup",
      x: e.x,
      y: e.y,
      buttons: this.buttonsState,
      button: uiohookButtonToDomButton(e.button),
      timestamp: e.time,
    });
  };

  private onWheel = (e: UiohookWheelEvent): void => {
    const deltaY = this.wheel.feed(e.rotation);
    if (deltaY === null) return;
    this.callback?.({
      type: "wheel",
      x: e.x,
      y: e.y,
      deltaY,
      buttons: this.buttonsState,
      timestamp: e.time,
    });
  };

  private onKeyDown = (e: UiohookKeyboardEvent): void => {
    if ((e.keycode >= 59 && e.keycode <= 68) || (e.keycode >= 87 && e.keycode <= 107)) {
      console.debug(`[uiohook] function keydown keycode=${e.keycode}`);
    }

    this.keyboardCallback?.({
      type: "keydown",
      keycode: e.keycode,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
      timestamp: e.time,
    });
  };
}

// ============================================================
// 顶层 API
// ============================================================

let activeSource: IInputSource | null = null;

/**
 * 启动全局鼠标 + 键盘捕获并把事件投递给 callback。
 * 返回 stop 函数；多次调用会先 stop 上一个 source。
 *
 * inputSource 选填——单元测试可注入 FakeInputSource 校验 IPC 链路。
 */
export function startGlobalMouseCapture(
  onEvent: (event: NativeCursorEvent) => void,
  onKeyboard?: (event: NativeKeyboardEvent) => void,
  inputSource?: IInputSource,
): () => void {
  if (activeSource) {
    activeSource.stop();
    activeSource = null;
  }
  const source = inputSource || new UiohookInputSource();
  source.start(onEvent, onKeyboard);
  activeSource = source;

  return () => {
    if (activeSource === source) {
      source.stop();
      activeSource = null;
    }
  };
}

// 仅给测试用：暴露内部辅助函数。
export const __testing__ = {
  uiohookButtonToBitmask,
  WheelAccumulator,
};
