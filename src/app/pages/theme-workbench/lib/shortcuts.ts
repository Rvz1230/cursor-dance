/**
 * 全局快捷键解析。纯函数：吃一个「像 KeyboardEvent 的东西」，吐一个命令名。
 *
 * 抽成纯函数是为了能单测——项目里没有 DOM 测试环境，而这里最容易写错的两件事
 * 恰恰都不需要真实 DOM 就能测：
 *   1. **正在打字时不能触发。** 输入框里按 ⌘Z 应该是「撤销这次输入」（浏览器原生行为），
 *      不是「撤销上一次配置改动」。⌘1 更是必须能在输入框里打出「1」。
 *   2. **⌘⇧Z 是重做，不是撤销。** 不判 shiftKey 的话按重做会得到又一次撤销。
 *
 * 快捷键表见 docs/ui-spec/README.md 决策 #6。刻意没有 ⌘S——已改成自动保存。
 */

export type ShortcutCommand =
  | "undo"
  | "redo"
  | "command-palette"
  | "new-theme"
  | "toggle-ai"
  | { workspaceIndex: number };

/** 与 workspaceId 的顺序对应：⌘1–5。 */
export const WORKSPACE_SHORTCUT_ORDER = [
  "workbench",
  "states",
  "keyboard",
  "sites",
  "diagnostics",
] as const;

export interface ShortcutEventLike {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  /** 事件目标的形态。取 DOM 里的 tagName / isContentEditable。 */
  readonly target?: {
    readonly tagName?: string;
    readonly isContentEditable?: boolean;
  } | null;
}

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * 是否处在「用户正在打字」的上下文里。
 *
 * 注意 `select` 也算：在下拉里按 ⌘1 应该走原生的首字母跳转，不该切工作区。
 */
export function isTypingContext(target: ShortcutEventLike["target"]): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  return TYPING_TAGS.has((target.tagName ?? "").toUpperCase());
}

/**
 * 解析成命令。返回 null 表示不拦截，交给浏览器 / 其他处理。
 *
 * 用 `metaKey || ctrlKey`：mac 是 ⌘，Windows / Linux 是 Ctrl，同一套表两边都成立。
 */
export function resolveShortcut(event: ShortcutEventLike): ShortcutCommand | null {
  const modifier = event.metaKey || event.ctrlKey;
  if (!modifier || event.altKey) return null;

  const key = event.key.toLowerCase();

  // 撤销 / 重做在输入框里必须让给浏览器原生的文本撤销
  if (key === "z") {
    if (isTypingContext(event.target)) return null;
    return event.shiftKey ? "redo" : "undo";
  }

  // 其余快捷键在打字时一律不触发（⌘1 要能在输入框里打出 1）
  if (isTypingContext(event.target)) return null;
  if (event.shiftKey) return null;

  if (key === "k") return "command-palette";
  if (key === "n") return "new-theme";
  if (key === "j") return "toggle-ai";

  const digit = Number(key);
  if (Number.isInteger(digit) && digit >= 1 && digit <= WORKSPACE_SHORTCUT_ORDER.length) {
    return { workspaceIndex: digit - 1 };
  }

  return null;
}

/** 把命令解析成 workspaceId；不是工作区命令则返回 null。 */
export function workspaceIdForCommand(command: ShortcutCommand): string | null {
  if (typeof command === "object" && "workspaceIndex" in command) {
    return WORKSPACE_SHORTCUT_ORDER[command.workspaceIndex] ?? null;
  }
  return null;
}
