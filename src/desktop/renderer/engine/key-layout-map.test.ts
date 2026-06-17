import { describe, it, expect } from "vitest";
import {
  keyLayoutNormalizedX,
  keyDisplayCharacter,
  MODIFIER_KEYCODES,
} from "./key-layout-map";

// uiohook UiohookKey 数值，与 key-layout-map.ts 内联的 K 对象保持一致
const A = 30;
const Z = 44;
const Space = 57;
const Enter = 28;
const Backspace = 14;
const ArrowLeft = 57419;
const F1 = 59;
const Shift = 42;
const Ctrl = 29;
const CapsLock = 58;

describe("keyLayoutNormalizedX", () => {
  it("returns 0..1 for mapped keys", () => {
    const ax = keyLayoutNormalizedX(A);
    expect(ax).toBeGreaterThanOrEqual(0);
    expect(ax).toBeLessThanOrEqual(1);
  });

  it("Z is to the right of A on QWERTY (Z 在 row4 比 A 在 row3 略偏右)", () => {
    // A=0.10, Z=0.12 — 微妙但顺序符合常识
    expect(keyLayoutNormalizedX(Z)).toBeGreaterThan(keyLayoutNormalizedX(A));
  });

  it("Space is centered (~0.5)", () => {
    expect(keyLayoutNormalizedX(Space)).toBeCloseTo(0.5, 2);
  });

  it("falls back to 0.5 (center) for unmapped keycode", () => {
    expect(keyLayoutNormalizedX(99999)).toBe(0.5);
  });
});

describe("keyDisplayCharacter", () => {
  it("returns letter glyphs for letters", () => {
    expect(keyDisplayCharacter(A)).toBe("A");
    expect(keyDisplayCharacter(Z)).toBe("Z");
  });

  it("returns special glyphs for editing keys", () => {
    expect(keyDisplayCharacter(Backspace)).toBe("⌫");
    expect(keyDisplayCharacter(Enter)).toBe("↩");
    expect(keyDisplayCharacter(Space)).toBe("␣");
    expect(keyDisplayCharacter(ArrowLeft)).toBe("←");
  });

  it("returns function key labels", () => {
    expect(keyDisplayCharacter(F1)).toBe("F1");
  });

  it("returns null for unmapped keycode (caller should skip)", () => {
    expect(keyDisplayCharacter(99999)).toBeNull();
  });
});

describe("MODIFIER_KEYCODES", () => {
  it("contains Shift / Ctrl / CapsLock", () => {
    expect(MODIFIER_KEYCODES.has(Shift)).toBe(true);
    expect(MODIFIER_KEYCODES.has(Ctrl)).toBe(true);
    expect(MODIFIER_KEYCODES.has(CapsLock)).toBe(true);
  });

  it("does not contain regular letters", () => {
    expect(MODIFIER_KEYCODES.has(A)).toBe(false);
    expect(MODIFIER_KEYCODES.has(Space)).toBe(false);
  });
});
