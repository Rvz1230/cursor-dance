import { describe, expect, it } from "vitest";
import {
  WORKSPACE_SHORTCUT_ORDER,
  isTypingContext,
  resolveShortcut,
  workspaceIdForCommand,
  type ShortcutEventLike,
} from "./shortcuts";

function press(key: string, overrides: Partial<ShortcutEventLike> = {}): ShortcutEventLike {
  return {
    key,
    metaKey: true,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    target: { tagName: "DIV" },
    ...overrides,
  };
}

describe("resolveShortcut: 快捷键表（决策 #6）", () => {
  it("映射出全部命令", () => {
    expect(resolveShortcut(press("z"))).toBe("undo");
    expect(resolveShortcut(press("z", { shiftKey: true }))).toBe("redo");
    expect(resolveShortcut(press("k"))).toBe("command-palette");
    expect(resolveShortcut(press("n"))).toBe("new-theme");
    expect(resolveShortcut(press("j"))).toBe("toggle-ai");
    expect(resolveShortcut(press("1"))).toEqual({ workspaceIndex: 0 });
    expect(resolveShortcut(press("5"))).toEqual({ workspaceIndex: 4 });
  });

  it("⌘⇧Z 是重做而不是又一次撤销", () => {
    expect(resolveShortcut(press("z", { shiftKey: true }))).toBe("redo");
    expect(resolveShortcut(press("z", { shiftKey: true }))).not.toBe("undo");
  });

  it("Ctrl 与 ⌘ 等价（Windows / Linux 用同一套表）", () => {
    expect(resolveShortcut(press("k", { metaKey: false, ctrlKey: true }))).toBe("command-palette");
  });

  it("没有修饰键就不拦截", () => {
    expect(resolveShortcut(press("z", { metaKey: false, ctrlKey: false }))).toBeNull();
    expect(resolveShortcut(press("1", { metaKey: false, ctrlKey: false }))).toBeNull();
  });

  it("带 Alt 不拦截（留给系统与其他绑定）", () => {
    expect(resolveShortcut(press("z", { altKey: true }))).toBeNull();
  });

  it("超出范围的数字不映射工作区", () => {
    expect(resolveShortcut(press("6"))).toBeNull();
    expect(resolveShortcut(press("0"))).toBeNull();
  });

  // 已改成自动保存，⌘S 不该被我们接管
  it("不接管 ⌘S", () => {
    expect(resolveShortcut(press("s"))).toBeNull();
  });
});

describe("resolveShortcut: 打字上下文", () => {
  for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
    it(`在 ${tagName} 里 ⌘Z 让给浏览器原生文本撤销`, () => {
      expect(resolveShortcut(press("z", { target: { tagName } }))).toBeNull();
    });
    it(`在 ${tagName} 里 ⌘1 不切工作区（要能打出「1」）`, () => {
      expect(resolveShortcut(press("1", { target: { tagName } }))).toBeNull();
    });
  }

  it("contenteditable 同样算打字上下文", () => {
    expect(resolveShortcut(press("z", { target: { tagName: "DIV", isContentEditable: true } }))).toBeNull();
  });

  it("非输入元素上正常触发", () => {
    expect(resolveShortcut(press("z", { target: { tagName: "BUTTON" } }))).toBe("undo");
  });

  it("target 缺失时按非打字处理", () => {
    expect(isTypingContext(null)).toBe(false);
    expect(isTypingContext(undefined)).toBe(false);
    expect(resolveShortcut(press("z", { target: null }))).toBe("undo");
  });

  it("tagName 大小写不敏感", () => {
    expect(resolveShortcut(press("z", { target: { tagName: "input" } }))).toBeNull();
  });
});

describe("workspaceIdForCommand", () => {
  it("按 ⌘1–5 的顺序映射 workspaceId", () => {
    expect(workspaceIdForCommand({ workspaceIndex: 0 })).toBe("workbench");
    expect(workspaceIdForCommand({ workspaceIndex: 4 })).toBe("diagnostics");
    expect(WORKSPACE_SHORTCUT_ORDER).toHaveLength(5);
  });

  it("非工作区命令返回 null", () => {
    expect(workspaceIdForCommand("undo")).toBeNull();
  });
});
