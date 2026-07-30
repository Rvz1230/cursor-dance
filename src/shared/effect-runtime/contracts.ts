export type RuntimeUnsubscribe = () => void;
export type RuntimeListener<T> = (value: T) => void | Promise<void>;

export interface RuntimeCursorEvent {
  type: string;
  x: number;
  y: number;
  buttons?: number;
  button?: number;
  deltaY?: number;
  timestamp: number;
}

export interface ScreenPointerEvent extends RuntimeCursorEvent {
  type: "mousemove" | "mousedown" | "mouseup" | "wheel";
}

export type ScreenPointerInputEvent = ScreenPointerEvent | (
  Omit<ScreenPointerEvent, "type"> & { type: "leave" }
);

export interface PointerInputEvent extends RuntimeCursorEvent {
  kind: "pointer";
  screenX: number;
  screenY: number;
  inside: boolean;
}

interface PointerLeaveInputEvent {
  kind: "pointer-leave";
  timestamp: number;
}

export interface KeyboardInputEvent {
  kind: "keyboard";
  type: "keydown" | "keyup";
  keycode: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  timestamp: number;
}

export type KeyboardEventPayload = Omit<KeyboardInputEvent, "kind">;

export type RuntimeInputEvent = PointerInputEvent | PointerLeaveInputEvent | KeyboardInputEvent;

export interface InputSource<TInput = RuntimeInputEvent> {
  subscribe(listener: RuntimeListener<TInput>): RuntimeUnsubscribe;
}

export interface ContextResolver<TContext> {
  getSnapshot(): TContext;
  subscribe(listener: RuntimeListener<TContext>): RuntimeUnsubscribe;
}

type EffectKind = "text" | "ripple" | "particle" | "animation" | "image" | "cursor";

export interface EffectSpec {
  kind: EffectKind;
  x: number;
  y: number;
  actionConfig: Readonly<Record<string, unknown>>;
  actionId?: string;
  runIndex?: number;
  particleMode?: "burst" | "orbital";
}

export interface EffectHandle {
  dispose(): void;
}

export interface EffectSurface {
  createNode(spec: EffectSpec): EffectHandle;
  clear(): void;
}

export interface AudioSpec {
  actionConfig: Readonly<Record<string, unknown>>;
  actionId: string;
  comboIndex?: number;
  runIndex?: number;
  comboWindowMs?: number;
}

export interface AudioOutput {
  play(spec: AudioSpec): Promise<void>;
}
