import {
  CURSOR_EVENT,
  CURSOR_VISIBILITY_SET_HIDDEN,
  KEYBOARD_EVENT,
} from "../../../shared/ipc-channels";
import { createIpcSubscription } from "./ipc-subscription";
import { invokeDesktop } from "./typed-invoke";
import type {
  KeyboardEventPayload,
  ScreenPointerInputEvent,
} from "../../../shared/effect-runtime/contracts";

export type CursorEventPayload = ScreenPointerInputEvent;
export type { KeyboardEventPayload };

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
