/**
 * 撤销 / 重做栈。纯数据，不碰 React——这样能在没有 DOM 测试环境的前提下单测。
 *
 * 三条设计约束都来自 docs/ui-spec/README.md 的走查结论：
 *
 * 1. **按主题分桶。** 在主题 A 改了 3 步、切到 B 再按 ⌘Z 去撤销 A 的改动是错的。
 *    每个主题各有自己的 undo/redo 栈，⌘Z 只作用于当前主题。
 * 2. **撤销与重做成对。** 撤销一步就把它移进 redo 栈，⌘⇧Z 再移回来。
 *    新的改动会清空 redo 栈（标准语义：分叉后旧的重做路径已经无效）。
 * 3. **连续同目标改动要合并。** `Slider` 已把一次拖动收敛成一次提交，但方向键、
 *    标签 scrub 与连续输入仍可能快速提交同一字段；⌘Z 应回到这轮调整前，
 *    而不是只退一格。
 *    合并按 `mergeKey` + 时间窗进行，保留最早的 before 与最新的 after。
 */

/** 同一目标的连续改动在这个时间窗内合并成一条。 */
export const UNDO_MERGE_WINDOW_MS = 600;

/**
 * 每个主题保留的撤销步数上限。
 * 每条记录都存整份 draft 快照（一套主题约 390 个配置决策），所以必须有上限。
 */
export const UNDO_MAX_DEPTH = 40;

export interface UndoEntry<S> {
  /** 展示给用户的动作名，用在 toast 与命令面板里（「撤销：字号」）。 */
  readonly label: string;
  /** 分桶键，当前就是 themeId。 */
  readonly bucket: string;
  /** 同一目标的连续改动合并用；不传则永不合并（例如「套用预设」这种一次性动作）。 */
  readonly mergeKey?: string;
  /** 记录时间（由调用方传入，便于测试）。 */
  readonly at: number;
  readonly before: S;
  readonly after: S;
}

interface Bucket<S> {
  readonly undo: readonly UndoEntry<S>[];
  readonly redo: readonly UndoEntry<S>[];
}

export type UndoStacks<S> = Readonly<Record<string, Bucket<S>>>;

export const EMPTY_UNDO_STACKS: UndoStacks<never> = Object.freeze({});

const EMPTY_BUCKET: Bucket<never> = Object.freeze({ undo: [], redo: [] });

function bucketOf<S>(stacks: UndoStacks<S>, bucket: string): Bucket<S> {
  return stacks[bucket] ?? (EMPTY_BUCKET as unknown as Bucket<S>);
}

function withBucket<S>(stacks: UndoStacks<S>, bucket: string, next: Bucket<S>): UndoStacks<S> {
  return { ...stacks, [bucket]: next };
}

/**
 * 记一步改动。会清空该主题的 redo 栈，并在满足合并条件时与栈顶合并。
 */
export function pushUndo<S>(stacks: UndoStacks<S>, entry: UndoEntry<S>): UndoStacks<S> {
  const current = bucketOf(stacks, entry.bucket);
  const top = current.undo[current.undo.length - 1];
  const mergeable = Boolean(
    top
    && entry.mergeKey !== undefined
    && top.mergeKey === entry.mergeKey
    && entry.at - top.at <= UNDO_MERGE_WINDOW_MS,
  );

  // 合并时保留最早的 before：撤销要一次退回这串连续改动之前的状态，不是退回上一帧。
  const nextUndo = mergeable
    ? [...current.undo.slice(0, -1), { ...top, after: entry.after, at: entry.at, label: entry.label }]
    : [...current.undo, entry];

  return withBucket(stacks, entry.bucket, {
    undo: nextUndo.slice(-UNDO_MAX_DEPTH),
    redo: [],
  });
}

export interface UndoStep<S> {
  readonly entry: UndoEntry<S>;
  /** 要恢复到的状态。撤销给 before，重做给 after。 */
  readonly restore: S;
  readonly stacks: UndoStacks<S>;
}

/** 取出当前主题最近一步并移进 redo 栈。没有可撤销的返回 null。 */
export function popUndo<S>(stacks: UndoStacks<S>, bucket: string): UndoStep<S> | null {
  const current = bucketOf(stacks, bucket);
  const entry = current.undo[current.undo.length - 1];
  if (!entry) return null;
  return {
    entry,
    restore: entry.before,
    stacks: withBucket(stacks, bucket, {
      undo: current.undo.slice(0, -1),
      redo: [...current.redo, entry],
    }),
  };
}

/** 与 popUndo 成对。 */
export function popRedo<S>(stacks: UndoStacks<S>, bucket: string): UndoStep<S> | null {
  const current = bucketOf(stacks, bucket);
  const entry = current.redo[current.redo.length - 1];
  if (!entry) return null;
  return {
    entry,
    restore: entry.after,
    stacks: withBucket(stacks, bucket, {
      undo: [...current.undo, entry],
      redo: current.redo.slice(0, -1),
    }),
  };
}

export function canUndo<S>(stacks: UndoStacks<S>, bucket: string): boolean {
  return bucketOf(stacks, bucket).undo.length > 0;
}

export function canRedo<S>(stacks: UndoStacks<S>, bucket: string): boolean {
  return bucketOf(stacks, bucket).redo.length > 0;
}

/** 栈顶动作名，用来把按钮写成「撤销：字号」而不是干巴巴的「撤销」。 */
export function peekUndoLabel<S>(stacks: UndoStacks<S>, bucket: string): string | null {
  const current = bucketOf(stacks, bucket);
  return current.undo[current.undo.length - 1]?.label ?? null;
}

export function peekRedoLabel<S>(stacks: UndoStacks<S>, bucket: string): string | null {
  const current = bucketOf(stacks, bucket);
  return current.redo[current.redo.length - 1]?.label ?? null;
}

/** 主题被删除时清掉它的桶，避免快照一直占着内存。 */
export function dropBucket<S>(stacks: UndoStacks<S>, bucket: string): UndoStacks<S> {
  if (!(bucket in stacks)) return stacks;
  const next = { ...stacks };
  delete next[bucket];
  return next;
}
