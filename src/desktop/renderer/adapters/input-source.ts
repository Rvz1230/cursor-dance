import type {
  InputSource,
  KeyboardEventPayload,
  RuntimeInputEvent,
  RuntimeListener,
  ScreenPointerInputEvent,
} from "@/shared/effect-runtime/contracts";

export type DesktopCursorEventPayload = ScreenPointerInputEvent;
export type DesktopKeyboardEventPayload = KeyboardEventPayload;

export interface DesktopInputBridge {
  onCursorEvent(listener: (event: DesktopCursorEventPayload) => void): () => void;
  onKeyboardEvent?(listener: (event: DesktopKeyboardEventPayload) => void): () => void;
  setNativeCursorHidden?(hidden: boolean): Promise<void>;
}

export interface DesktopViewportSnapshot {
  screenX: number;
  screenY: number;
  width: number;
  height: number;
}

function notifyInputListener(listener: RuntimeListener<RuntimeInputEvent>, event: RuntimeInputEvent): void {
  Promise.resolve(listener(event)).catch((error) => {
    console.error("[cursordance] input source listener failed:", error);
  });
}

export function createDesktopInputSource(
  bridge: DesktopInputBridge,
  getViewport: () => DesktopViewportSnapshot,
): InputSource {
  return {
    subscribe(listener) {
      const unsubscribeCursor = bridge.onCursorEvent((payload) => {
        if (payload.type === "leave") {
          notifyInputListener(listener, { kind: "pointer-leave", timestamp: payload.timestamp });
          return;
        }
        const viewport = getViewport();
        const x = payload.x - viewport.screenX;
        const y = payload.y - viewport.screenY;
        notifyInputListener(listener, {
          kind: "pointer",
          type: payload.type,
          x,
          y,
          screenX: payload.x,
          screenY: payload.y,
          inside: x >= 0 && y >= 0 && x < viewport.width && y < viewport.height,
          buttons: payload.buttons,
          button: payload.button,
          deltaY: payload.deltaY,
          timestamp: payload.timestamp,
        });
      });
      const unsubscribeKeyboard = bridge.onKeyboardEvent?.((payload) => {
        notifyInputListener(listener, { kind: "keyboard", ...payload });
      }) ?? (() => {});
      return () => {
        unsubscribeCursor();
        unsubscribeKeyboard();
      };
    },
  };
}
