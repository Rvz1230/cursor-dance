import { describe, expect, it } from "vitest";
import {
  EMPTY_UNDO_STACKS,
  UNDO_MAX_DEPTH,
  UNDO_MERGE_WINDOW_MS,
  canRedo,
  canUndo,
  dropBucket,
  peekUndoLabel,
  popRedo,
  popUndo,
  pushUndo,
  type UndoStacks,
} from "./undoStack";

type Draft = { size: number };

function entry(overrides: Partial<Parameters<typeof pushUndo<Draft>>[1]> = {}) {
  return {
    label: "字号",
    bucket: "mono-geo",
    mergeKey: "leftClick:textSize",
    at: 1_000,
    before: { size: 28 } as Draft,
    after: { size: 32 } as Draft,
    ...overrides,
  };
}

describe("undo stack: 基本成对", () => {
  it("undo 恢复 before，redo 恢复 after", () => {
    const stacks = pushUndo<Draft>(EMPTY_UNDO_STACKS as UndoStacks<Draft>, entry());
    const undone = popUndo(stacks, "mono-geo");
    expect(undone?.restore).toEqual({ size: 28 });

    const redone = popRedo(undone!.stacks, "mono-geo");
    expect(redone?.restore).toEqual({ size: 32 });
  });

  it("没有可撤销 / 可重做时返回 null", () => {
    expect(popUndo(EMPTY_UNDO_STACKS as UndoStacks<Draft>, "mono-geo")).toBeNull();
    const stacks = pushUndo<Draft>(EMPTY_UNDO_STACKS as UndoStacks<Draft>, entry());
    expect(popRedo(stacks, "mono-geo")).toBeNull();
  });

  it("新的改动会清空 redo 栈（分叉后旧的重做路径已无效）", () => {
    let stacks = pushUndo<Draft>(EMPTY_UNDO_STACKS as UndoStacks<Draft>, entry());
    stacks = popUndo(stacks, "mono-geo")!.stacks;
    expect(canRedo(stacks, "mono-geo")).toBe(true);
    stacks = pushUndo(stacks, entry({ mergeKey: "leftClick:color", label: "颜色", at: 9_000 }));
    expect(canRedo(stacks, "mono-geo")).toBe(false);
  });
});

// 这是走查里明确点出的错误行为：在 A 改了几步，切到 B 按 ⌘Z 不该撤销 A 的改动。
describe("undo stack: 按主题分桶", () => {
  it("⌘Z 只作用于当前主题", () => {
    let stacks = pushUndo<Draft>(EMPTY_UNDO_STACKS as UndoStacks<Draft>, entry({ bucket: "mono-geo" }));
    stacks = pushUndo(stacks, entry({ bucket: "drift", label: "半径", mergeKey: "leftClick:radius" }));

    expect(canUndo(stacks, "drift")).toBe(true);
    const undone = popUndo(stacks, "drift")!;
    expect(undone.entry.label).toBe("半径");
    // mono-geo 的那一步还在
    expect(canUndo(undone.stacks, "mono-geo")).toBe(true);
    expect(peekUndoLabel(undone.stacks, "mono-geo")).toBe("字号");
  });

  it("切到没有改动过的主题时 ⌘Z 是空操作", () => {
    const stacks = pushUndo<Draft>(EMPTY_UNDO_STACKS as UndoStacks<Draft>, entry());
    expect(popUndo(stacks, "sunset")).toBeNull();
  });

  it("删除主题会丢掉它的桶", () => {
    const stacks = pushUndo<Draft>(EMPTY_UNDO_STACKS as UndoStacks<Draft>, entry());
    expect(canUndo(dropBucket(stacks, "mono-geo"), "mono-geo")).toBe(false);
  });
});

// Slider 拖动只在松手时提交，但方向键 / 标签 scrub 仍会连续改同一字段。
// 这些紧邻更新要合并成一轮调整，避免一次微调要按多次 ⌘Z。
describe("undo stack: 连续同目标改动合并", () => {
  it("一轮连续微调只产生一条记录，且能一步退回调整之前", () => {
    let stacks = EMPTY_UNDO_STACKS as UndoStacks<Draft>;
    // 模拟方向键或标签 scrub：28 → 29 → 30 → 31，每次间隔 16ms
    let previous = 28;
    for (let i = 0; i < 3; i += 1) {
      const next = previous + 1;
      stacks = pushUndo(stacks, entry({
        at: 1_000 + i * 16,
        before: { size: previous },
        after: { size: next },
      }));
      previous = next;
    }
    expect(stacks["mono-geo"].undo).toHaveLength(1);
    // 一步退回最初的 28，而不是退回 30
    expect(popUndo(stacks, "mono-geo")?.restore).toEqual({ size: 28 });
  });

  it("超过时间窗就另起一条", () => {
    let stacks = pushUndo<Draft>(EMPTY_UNDO_STACKS as UndoStacks<Draft>, entry({ at: 1_000 }));
    stacks = pushUndo(stacks, entry({ at: 1_000 + UNDO_MERGE_WINDOW_MS + 1 }));
    expect(stacks["mono-geo"].undo).toHaveLength(2);
  });

  it("不同目标不合并", () => {
    let stacks = pushUndo<Draft>(EMPTY_UNDO_STACKS as UndoStacks<Draft>, entry({ mergeKey: "a" }));
    stacks = pushUndo(stacks, entry({ mergeKey: "b", at: 1_010 }));
    expect(stacks["mono-geo"].undo).toHaveLength(2);
  });

  it("不带 mergeKey 的一次性动作永不合并", () => {
    let stacks = pushUndo<Draft>(EMPTY_UNDO_STACKS as UndoStacks<Draft>, entry({ mergeKey: undefined, label: "套用预设" }));
    stacks = pushUndo(stacks, entry({ mergeKey: undefined, label: "套用预设", at: 1_010 }));
    expect(stacks["mono-geo"].undo).toHaveLength(2);
  });
});

describe("undo stack: 深度上限", () => {
  it("超出上限时丢掉最旧的，保留最近的", () => {
    let stacks = EMPTY_UNDO_STACKS as UndoStacks<Draft>;
    for (let i = 0; i < UNDO_MAX_DEPTH + 10; i += 1) {
      stacks = pushUndo(stacks, entry({ mergeKey: `f${i}`, label: `第${i}步`, at: 1_000 + i * 5_000 }));
    }
    expect(stacks["mono-geo"].undo).toHaveLength(UNDO_MAX_DEPTH);
    expect(peekUndoLabel(stacks, "mono-geo")).toBe(`第${UNDO_MAX_DEPTH + 9}步`);
  });
});
