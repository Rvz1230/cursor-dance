import { describe, expect, it } from "vitest";
import { resolveNumberCommit } from "./number-field";

describe("resolveNumberCommit", () => {
  const commit = (raw: string, current = 28) => resolveNumberCommit(raw, current, 12, 96);

  // 这条是 NumberField 需要内部草稿状态的全部理由：
  // 如果每次按键都 clamp 并提交，min=12 时「50」永远输不进去——
  // 按下「5」就被 clamp 成 12，下一键变成 122。所以提交只发生在失焦 / Enter。
  it("accepts an in-range value whose first digit alone would be below min", () => {
    expect(commit("50")).toBe(50);
  });

  it("clamps out-of-range values into the bounds", () => {
    expect(commit("999")).toBe(96);
    expect(commit("-40")).toBe(12);
  });

  // 空串不能静默变成 min —— 那会把「清空想重输」变成「值被悄悄改了」
  it("does nothing for an empty or whitespace-only field", () => {
    expect(commit("")).toBeNull();
    expect(commit("   ")).toBeNull();
  });

  it("does nothing for non-numeric input", () => {
    expect(commit("abc")).toBeNull();
    expect(commit("1e")).toBeNull();
  });

  it("does nothing when the committed value equals the current one", () => {
    expect(commit("28")).toBeNull();
    // 越界值 clamp 后正好等于当前值，也不该触发一次多余的写入
    expect(commit("999", 96)).toBeNull();
  });

  it("treats a clamped edge value as a real change when it differs", () => {
    expect(commit("999", 40)).toBe(96);
  });
});
