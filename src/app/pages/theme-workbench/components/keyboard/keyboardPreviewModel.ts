import type { KeySemanticKind } from "@/shared/effect-core/key-feedback-style";
import type { KeyFeedbackBounds } from "@/shared/effect-core/key-feedback-motion";

const LAYOUT_ROWS = [
  ["Backquote", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7", "Digit8", "Digit9", "Digit0", "Minus", "Equal", "Backspace"],
  ["Tab", "KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY", "KeyU", "KeyI", "KeyO", "KeyP", "BracketLeft", "BracketRight", "Backslash"],
  ["CapsLock", "KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Enter"],
] as const;

const LAYOUT_X = new Map<string, number>();
for (const row of LAYOUT_ROWS) {
  row.forEach((code, index) => LAYOUT_X.set(code, Math.min(0.93, index * (0.93 / (row.length - 1)))));
}
for (const [code, x] of Object.entries({ ShiftLeft: 0.05, KeyZ: 0.12, KeyX: 0.19, KeyC: 0.26, KeyV: 0.33, KeyB: 0.4, KeyN: 0.47, KeyM: 0.54, Comma: 0.61, Period: 0.68, Slash: 0.75, ShiftRight: 0.88, ControlLeft: 0.03, AltLeft: 0.1, MetaLeft: 0.17, Space: 0.5, MetaRight: 0.8, AltRight: 0.87, ControlRight: 0.93, ArrowLeft: 0.73, ArrowDown: 0.8, ArrowUp: 0.8, ArrowRight: 0.87, Escape: 0 })) {
  LAYOUT_X.set(code, x);
}

const MODIFIERS = new Set(["ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "MetaLeft", "MetaRight"]);
const GLYPHS: Record<string, string> = { ShiftLeft: "⇧", ShiftRight: "⇧", ControlLeft: "⌃", ControlRight: "⌃", AltLeft: "⌥", AltRight: "⌥", MetaLeft: "⌘", MetaRight: "⌘", Backspace: "⌫", Enter: "↩", Tab: "⇥", Space: "␣", Escape: "⎋", ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓" };

export function getPreviewLayoutX(code: string): number {
  return LAYOUT_X.get(code) ?? 0.5;
}

const PREVIEW_ANCHORS = {
  screen: { x: 0, y: 0, width: 1, height: 1 },
  window: { x: 0.52, y: 0.26, width: 0.42, height: 0.56 },
  caret: { x: 0.79, y: 0.58, width: 0, height: 0 },
} as const;

export function resolvePreviewAnchorBounds(
  anchorName: keyof typeof PREVIEW_ANCHORS,
  viewport: { width: number; height: number },
): KeyFeedbackBounds {
  const anchor = PREVIEW_ANCHORS[anchorName];
  return {
    x: anchor.x * viewport.width,
    y: anchor.y * viewport.height,
    width: anchor.width * viewport.width,
    height: anchor.height * viewport.height,
  };
}

export function getPreviewSemanticKind(event: Pick<KeyboardEvent, "code" | "metaKey" | "ctrlKey" | "altKey">): KeySemanticKind {
  if (MODIFIERS.has(event.code)) return "modifier";
  if (event.metaKey || event.ctrlKey || event.altKey) return "shortcut";
  if (GLYPHS[event.code]) return "special";
  return "character";
}

export function getPreviewKeyLabel(
  event: Pick<KeyboardEvent, "code" | "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">,
  mode: "typed" | "physical",
  showModifierKeys: boolean,
  uppercase: boolean,
): string | null {
  if (MODIFIERS.has(event.code)) return showModifierKeys ? GLYPHS[event.code] : null;
  if (GLYPHS[event.code]) return GLYPHS[event.code];
  const prefix = `${event.metaKey ? "⌘" : ""}${event.ctrlKey ? "⌃" : ""}${event.altKey ? "⌥" : ""}${event.shiftKey && (event.metaKey || event.ctrlKey || event.altKey) ? "⇧" : ""}`;
  const raw = mode === "physical"
    ? event.code.startsWith("Key") ? event.code.slice(3) : event.code.startsWith("Digit") ? event.code.slice(5) : event.key
    : event.key;
  if (raw.length !== 1) return null;
  const label = prefix ? `${prefix}${raw.toUpperCase()}` : raw;
  return uppercase ? label.toUpperCase() : label;
}
