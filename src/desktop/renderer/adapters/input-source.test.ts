import { describe, expect, it, vi } from "vitest";
import { createDesktopInputSource, type DesktopInputBridge } from "./input-source";

describe("desktop input source", () => {
  it("normalizes IPC pointer and keyboard events and owns their subscriptions", () => {
    let cursorListener: Parameters<DesktopInputBridge["onCursorEvent"]>[0] = () => {};
    let keyboardListener: NonNullable<Parameters<NonNullable<DesktopInputBridge["onKeyboardEvent"]>>[0]> = () => {};
    const unsubscribeCursor = vi.fn();
    const unsubscribeKeyboard = vi.fn();
    const bridge: DesktopInputBridge = {
      onCursorEvent(listener) {
        cursorListener = listener;
        return unsubscribeCursor;
      },
      onKeyboardEvent(listener) {
        keyboardListener = listener;
        return unsubscribeKeyboard;
      },
    };
    const listener = vi.fn();
    const unsubscribe = createDesktopInputSource(bridge, () => ({
      screenX: 100,
      screenY: 50,
      width: 800,
      height: 600,
    })).subscribe(listener);

    cursorListener({ type: "mousemove", x: 120, y: 80, timestamp: 1 });
    cursorListener({ type: "mousedown", x: 99, y: 49, button: 0, timestamp: 2 });
    cursorListener({ type: "leave", x: 0, y: 0, timestamp: 3 });
    keyboardListener({
      type: "keydown",
      keycode: 13,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: true,
      timestamp: 4,
    });

    expect(listener.mock.calls.map(([event]) => event)).toEqual([
      expect.objectContaining({ kind: "pointer", type: "mousemove", x: 20, y: 30, screenX: 120, screenY: 80, inside: true }),
      expect.objectContaining({ kind: "pointer", type: "mousedown", x: -1, y: -1, inside: false, button: 0 }),
      { kind: "pointer-leave", timestamp: 3 },
      expect.objectContaining({ kind: "keyboard", type: "keydown", keycode: 13, shiftKey: true }),
    ]);

    unsubscribe();
    expect(unsubscribeCursor).toHaveBeenCalledOnce();
    expect(unsubscribeKeyboard).toHaveBeenCalledOnce();
  });
});
