// CursorDance 键盘布局映射
//
// 将 uiohook UiohookKey 键码映射到：
//   1. 归一化水平位置 (0.0–1.0) —— 基于 ANSI QWERTY 布局
//   2. 显示字符 —— 按下该键时 overlay 上渲染的文字
//
// 位置比例与 Swift 版 KeyLayoutMap.swift 完全一致，
// 仅键码编号从 macOS kVK_* 换为 uiohook UiohookKey。
//
// 注意：uiohook 键码以字面量内联，避免 renderer bundle 依赖
// node-only 的 uiohook-napi 包（会触发 events/path/fs 浏览器外部化警告）。

// ═══════════════════════════════════════════════════════════════
// UiohookKey 常量（与 uiohook-napi `UiohookKey` 对齐）
// ═══════════════════════════════════════════════════════════════

const K = {
  Backspace: 14, Tab: 15, Enter: 28, CapsLock: 58, Escape: 1, Space: 57,
  PageUp: 3657, PageDown: 3665, End: 3663, Home: 3655,
  ArrowLeft: 57419, ArrowUp: 57416, ArrowRight: 57421, ArrowDown: 57424,
  Insert: 3666, Delete: 3667,
  Digit0: 11, Digit1: 2, Digit2: 3, Digit3: 4, Digit4: 5,
  Digit5: 6, Digit6: 7, Digit7: 8, Digit8: 9, Digit9: 10,
  A: 30, B: 48, C: 46, D: 32, E: 18, F: 33, G: 34, H: 35, I: 23,
  J: 36, K: 37, L: 38, M: 50, N: 49, O: 24, P: 25, Q: 16, R: 19,
  S: 31, T: 20, U: 22, V: 47, W: 17, X: 45, Y: 21, Z: 44,
  F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64,
  F7: 65, F8: 66, F9: 67, F10: 68, F11: 87, F12: 88,
  Semicolon: 39, Equal: 13, Comma: 51, Minus: 12, Period: 52, Slash: 53,
  Backquote: 41, BracketLeft: 26, Backslash: 43, BracketRight: 27, Quote: 40,
  Ctrl: 29, CtrlRight: 3613, Alt: 56, AltRight: 3640,
  Shift: 42, ShiftRight: 54, Meta: 3675, MetaRight: 3676,
  NumLock: 69, ScrollLock: 70,
} as const;

// ═══════════════════════════════════════════════════════════════
// QWERTY 布局 → 归一化水平位置
// ═══════════════════════════════════════════════════════════════

const qwertyLayout = new Map<number, number>([
  // Row 1: ` 1 2 3 4 5 6 7 8 9 0 - = Backspace
  [K.Backquote, 0.00],
  [K.Digit1, 0.07],
  [K.Digit2, 0.14],
  [K.Digit3, 0.21],
  [K.Digit4, 0.28],
  [K.Digit5, 0.36],
  [K.Digit6, 0.43],
  [K.Digit7, 0.50],
  [K.Digit8, 0.57],
  [K.Digit9, 0.64],
  [K.Digit0, 0.71],
  [K.Minus, 0.78],
  [K.Equal, 0.85],
  [K.Backspace, 0.93],

  // Row 2: Tab Q W E R T Y U I O P [ ] \
  [K.Tab, 0.00],
  [K.Q, 0.10],
  [K.W, 0.17],
  [K.E, 0.24],
  [K.R, 0.31],
  [K.T, 0.38],
  [K.Y, 0.45],
  [K.U, 0.52],
  [K.I, 0.59],
  [K.O, 0.66],
  [K.P, 0.73],
  [K.BracketLeft, 0.80],
  [K.BracketRight, 0.87],
  [K.Backslash, 0.93],

  // Row 3: CapsLock A S D F G H J K L ; ' Enter
  [K.CapsLock, 0.00],
  [K.A, 0.10],
  [K.S, 0.17],
  [K.D, 0.24],
  [K.F, 0.31],
  [K.G, 0.38],
  [K.H, 0.45],
  [K.J, 0.52],
  [K.K, 0.59],
  [K.L, 0.66],
  [K.Semicolon, 0.73],
  [K.Quote, 0.80],
  [K.Enter, 0.93],

  // Row 4: Shift Z X C V B N M , . / ShiftRight
  [K.Shift, 0.00],
  [K.ShiftRight, 0.93],
  [K.Z, 0.12],
  [K.X, 0.19],
  [K.C, 0.26],
  [K.V, 0.33],
  [K.B, 0.40],
  [K.N, 0.47],
  [K.M, 0.54],
  [K.Comma, 0.61],
  [K.Period, 0.68],
  [K.Slash, 0.75],

  // Row 5: Ctrl Alt Meta Space MetaRight AltRight ArrowLeft ArrowDown ArrowUp ArrowRight
  [K.Ctrl, 0.03],
  [K.CtrlRight, 0.93],
  [K.Alt, 0.10],
  [K.AltRight, 0.87],
  [K.Meta, 0.17],
  [K.MetaRight, 0.80],
  [K.Space, 0.50],
  [K.ArrowLeft, 0.73],
  [K.ArrowRight, 0.87],
  [K.ArrowDown, 0.80],
  [K.ArrowUp, 0.80],

  // Function keys
  [K.F1, 0.07],
  [K.F2, 0.14],
  [K.F3, 0.21],
  [K.F4, 0.28],
  [K.F5, 0.36],
  [K.F6, 0.43],
  [K.F7, 0.50],
  [K.F8, 0.57],
  [K.F9, 0.64],
  [K.F10, 0.71],
  [K.F11, 0.78],
  [K.F12, 0.85],

  // Navigation cluster
  [K.Escape, 0.00],
  [K.Delete, 0.93],
  [K.Home, 0.07],
  [K.End, 0.14],
  [K.PageUp, 0.21],
  [K.PageDown, 0.28],
  [K.Insert, 0.43],
]);

// ═══════════════════════════════════════════════════════════════
// 键码 → 显示字符
// ═══════════════════════════════════════════════════════════════

const keyDisplayMap = new Map<number, string>([
  // Letters
  [K.A, "A"], [K.B, "B"], [K.C, "C"],
  [K.D, "D"], [K.E, "E"], [K.F, "F"],
  [K.G, "G"], [K.H, "H"], [K.I, "I"],
  [K.J, "J"], [K.K, "K"], [K.L, "L"],
  [K.M, "M"], [K.N, "N"], [K.O, "O"],
  [K.P, "P"], [K.Q, "Q"], [K.R, "R"],
  [K.S, "S"], [K.T, "T"], [K.U, "U"],
  [K.V, "V"], [K.W, "W"], [K.X, "X"],
  [K.Y, "Y"], [K.Z, "Z"],
  // Numbers
  [K.Digit0, "0"], [K.Digit1, "1"], [K.Digit2, "2"],
  [K.Digit3, "3"], [K.Digit4, "4"], [K.Digit5, "5"],
  [K.Digit6, "6"], [K.Digit7, "7"], [K.Digit8, "8"],
  [K.Digit9, "9"],
  // Symbols
  [K.Backquote, "`"], [K.Minus, "-"],
  [K.Equal, "="], [K.BracketLeft, "["],
  [K.BracketRight, "]"], [K.Backslash, "\\"],
  [K.Semicolon, ";"], [K.Quote, "'"],
  [K.Comma, ","], [K.Period, "."],
  [K.Slash, "/"],
  // Special keys
  [K.Backspace, "⌫"], [K.Enter, "↩"],
  [K.Tab, "⇥"], [K.Space, "␣"],
  [K.Escape, "⎋"],
  [K.ArrowLeft, "←"], [K.ArrowRight, "→"],
  [K.ArrowUp, "↑"], [K.ArrowDown, "↓"],
  // Function keys
  [K.F1, "F1"], [K.F2, "F2"], [K.F3, "F3"],
  [K.F4, "F4"], [K.F5, "F5"], [K.F6, "F6"],
  [K.F7, "F7"], [K.F8, "F8"], [K.F9, "F9"],
  [K.F10, "F10"], [K.F11, "F11"], [K.F12, "F12"],
]);

// ═══════════════════════════════════════════════════════════════
// 修饰键集合
// ═══════════════════════════════════════════════════════════════

export const MODIFIER_KEYCODES = new Set<number>([
  K.Shift, K.ShiftRight,
  K.Ctrl, K.CtrlRight,
  K.Alt, K.AltRight,
  K.Meta, K.MetaRight,
  K.CapsLock, K.NumLock, K.ScrollLock,
]);

const modifierDisplayMap = new Map<number, string>([
  [K.Shift, "⇧"], [K.ShiftRight, "⇧"],
  [K.Ctrl, "⌃"], [K.CtrlRight, "⌃"],
  [K.Alt, "⌥"], [K.AltRight, "⌥"],
  [K.Meta, "⌘"], [K.MetaRight, "⌘"],
  [K.CapsLock, "⇪"], [K.NumLock, "Num"], [K.ScrollLock, "Scroll"],
]);

const shiftedDisplayMap = new Map<number, string>([
  [K.Backquote, "~"], [K.Digit1, "!"], [K.Digit2, "@"],
  [K.Digit3, "#"], [K.Digit4, "$"], [K.Digit5, "%"],
  [K.Digit6, "^"], [K.Digit7, "&"], [K.Digit8, "*"],
  [K.Digit9, "("], [K.Digit0, ")"], [K.Minus, "_"],
  [K.Equal, "+"], [K.BracketLeft, "{"], [K.BracketRight, "}"],
  [K.Backslash, "|"], [K.Semicolon, ":"], [K.Quote, "\""],
  [K.Comma, "<"], [K.Period, ">"], [K.Slash, "?"],
]);

// ═══════════════════════════════════════════════════════════════
// 组合键显示
// ═══════════════════════════════════════════════════════════════

export interface KeyDisplayEvent {
  keycode: number;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export interface KeyDisplayOptions {
  showModifierKeys?: boolean;
  keyDisplayMode?: "typed" | "physical";
}

function modifierPrefix(event: KeyDisplayEvent): string {
  return [
    event.metaKey ? "⌘" : "",
    event.ctrlKey ? "⌃" : "",
    event.altKey ? "⌥" : "",
    event.shiftKey ? "⇧" : "",
  ].join("");
}

function hasShortcutModifier(event: KeyDisplayEvent): boolean {
  return Boolean(event.metaKey || event.ctrlKey || event.altKey);
}

function isShiftOnly(event: KeyDisplayEvent): boolean {
  return Boolean(event.shiftKey && !hasShortcutModifier(event));
}

// ═══════════════════════════════════════════════════════════════
// 导出辅助函数
// ═══════════════════════════════════════════════════════════════

/** 返回键码对应的归一化水平位置 (0.0–1.0)，未映射键回退到 0.5（居中）。 */
export function keyLayoutNormalizedX(keycode: number): number {
  return qwertyLayout.get(keycode) ?? 0.5;
}

/** 返回键码对应的显示字符，未映射键返回 null（调用方应跳过）。 */
export function keyDisplayCharacter(keycode: number): string | null {
  return keyDisplayMap.get(keycode) ?? null;
}

/** 返回单独修饰键对应的显示字符，未映射键返回 null。 */
export function modifierKeyDisplayCharacter(keycode: number): string | null {
  return modifierDisplayMap.get(keycode) ?? null;
}

/** 返回带修饰键前缀的显示文本，例如 Shift+1 → !、Meta+K → ⌘K。 */
export function keyDisplayLabel(event: KeyDisplayEvent, options: KeyDisplayOptions = {}): string | null {
  const showModifierKeys = options.showModifierKeys ?? true;
  const keyDisplayMode = options.keyDisplayMode ?? "typed";

  if (MODIFIER_KEYCODES.has(event.keycode)) {
    return showModifierKeys ? modifierKeyDisplayCharacter(event.keycode) : null;
  }

  if (keyDisplayMode === "typed" && isShiftOnly(event)) {
    const shifted = shiftedDisplayMap.get(event.keycode);
    if (shifted) return shifted;
  }

  const base = keyDisplayCharacter(event.keycode);
  if (base === null) return null;

  if (keyDisplayMode === "typed" && isShiftOnly(event)) return base;
  return `${modifierPrefix(event)}${base}`;
}
