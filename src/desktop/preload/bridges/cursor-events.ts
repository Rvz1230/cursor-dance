import {
  CURSOR_EVENT,
  CURSOR_VISIBILITY_SET_HIDDEN,
  KEYBOARD_EVENT,
} from "../../../shared/ipc-channels";
import { createIpcSubscription } from "./ipc-subscription";
import { invokeDesktop } from "./typed-invoke";

export type CursorEventPayload = {
  type: "mousemove" | "mousedown" | "mouseup" | "wheel" | "leave";
  x: number;
  y: number;
  buttons?: number;
  button?: number;
  deltaY?: number;
  timestamp: number;
};

export type KeyboardEventPayload = {
  type: "keydown" | "keyup";
  keycode: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  timestamp: number;
};

export function createCursorEventsBridge() {
  const cursorEvents = createIpcSubscription<CursorEventPayload>(CURSOR_EVENT);
  const keyboardEvents = createIpcSubscription<KeyboardEventPayload>(KEYBOARD_EVENT);

  return {
    onCursorEvent: cursorEvents.on,
    offCursorEvent: cursorEvents.off,
    async setNativeCursorHidden(hidden: boolean): Promise<void> {
      await invokeDesktop(CURSOR_VISIBILITY_SET_HIDDEN, hidden);
    },
    onKeyboardEvent: keyboardEvents.on,
    offKeyboardEvent: keyboardEvents.off,
  };
}
