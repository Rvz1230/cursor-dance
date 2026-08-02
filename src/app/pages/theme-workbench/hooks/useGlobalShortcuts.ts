import { useEffect, useRef } from "react";
import { resolveShortcut, workspaceIdForCommand } from "../lib/shortcuts";

/**
 * 全部可选。**只注册真的能履约的键位**——
 * 注册一个没有实现的快捷键会得到「按了 preventDefault 但什么也没发生」，
 * 比没有这个快捷键更糟：用户会以为功能坏了，而且原生行为也被吃掉了。
 */
export interface ShortcutHandlers {
  onUndo?: () => void;
  onRedo?: () => void;
  onCommandPalette?: () => void;
  onNewTheme?: () => void;
  onToggleAi?: () => void;
  onWorkspace?: (workspaceId: string) => void;
}

/**
 * 挂全局快捷键。键位表与「什么时候不该触发」的判断全在 `lib/shortcuts.ts`
 * （纯函数、有单测）；这里只负责监听、分派、以及只在真的接管时才 preventDefault。
 *
 * 用 ref 存 handlers：否则每次 render 都要重新解绑 / 绑定监听器，
 * 而 handlers 几乎每次 render 都是新函数（闭包捕获了最新 state）。
 */
export function useGlobalShortcuts(handlers: ShortcutHandlers, enabled = true) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as (HTMLElement | null);
      const command = resolveShortcut({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        target: target
          ? { tagName: target.tagName, isContentEditable: target.isContentEditable }
          : null,
      });
      if (command === null) return;

      const current = handlersRef.current;
      const workspaceId = workspaceIdForCommand(command);
      const run = workspaceId
        ? (current.onWorkspace ? () => current.onWorkspace?.(workspaceId) : undefined)
        : ({
          undo: current.onUndo,
          redo: current.onRedo,
          "command-palette": current.onCommandPalette,
          "new-theme": current.onNewTheme,
          "toggle-ai": current.onToggleAi,
        } as Record<string, (() => void) | undefined>)[command as string];

      // 没有对应实现就完全不介入，把键位留给浏览器 / 系统
      if (!run) return;
      event.preventDefault();
      run();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
